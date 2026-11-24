import { T } from '@start9labs/start-sdk'
import { backends, BackendId } from './backends'
import { i18n } from './i18n'
import { sdk } from './sdk'
import type { healthFns } from '@start9labs/start-sdk'

export const port = 50001

// Host id electrs binds its Electrum interface on. Exported so dependents
// (mempool/specter/canary) resolve electrs over the bridge without a literal.
export const electrumHostId = 'electrum'

/**
 * Left by the Reindex action, consumed by `main`: an empty file at the volume root, the same marker
 * upstream uses. `main` removes it only after the index is gone, so an interrupted delete is
 * repeated on the next start.
 */
export const reindexRequest = sdk.volumes.main.subpath('reindex.request')

export const logFilters = {
  ERROR: i18n('Error'),
  WARN: i18n('Warning'),
  INFO: i18n('Info'),
  DEBUG: i18n('Debug'),
  TRACE: i18n('Trace'),
}

export type LogFilters = keyof typeof logFilters

/**
 * The selected backend's RPC and P2P endpoints over the LXC bridge, for electrs.toml's
 * `daemon_rpc_addr` / `daemon_p2p_addr`. Two reactive bridge-address watches —
 * one per bitcoind host — each chained `.const()`, so main restarts only when
 * that address actually changes: a bitcoind update is 0 restarts, bitcoind
 * installed after electrs is one healing restart, and uninstall is one restart.
 * Each resolves null while bitcoind is absent; the caller omits the toml field
 * rather than writing a placeholder, so the `.const()` heals in the real
 * address once bitcoind appears.
 *
 * P2P resolves bitcoind's `peer-local` host, not `peer`. electrs fetches whole
 * blocks over p2p — for the index, and again for every history query on a
 * scripthash no client has subscribed to — and `peer` maps onto the plain
 * `bind` that anonymous inbound peers share, where that traffic earns no
 * permissions: bitcoind may evict the connection to seat another peer, or cut
 * it off under `maxuploadtarget`. electrs does not reconnect p2p; it exits.
 * `peer-local` is whitelisted (noban + download), so neither applies.
 *
 * Always resolve through getBridgeAddress rather than rebuilding an address
 * from `net.assignedPort`/`assignedSslPort`: which of those is populated is a
 * property of how bitcoind bound the port, not something to infer here.
 */
export const bitcoindBridge = async (
  effects: T.Effects,
  backend: BackendId,
) => {
  // Per backend, because `knots-blake2b` is a separate lineage on its own ports
  // rather than a fork that changed only its external port numbers.
  const { rpcHostId, rpcPort, peerLocalHostId, peerPortLocal } =
    backends[backend].endpoints

  const rpc = await sdk.host
    .getBridgeAddress(effects, {
      packageId: backend,
      hostId: rpcHostId,
      internalPort: rpcPort,
      ssl: false,
    })
    .const()
  const p2p = await sdk.host
    .getBridgeAddress(effects, {
      packageId: backend,
      hostId: peerLocalHostId,
      internalPort: peerPortLocal,
    })
    .const()
  return { rpc, p2p }
}

// ---- Bounded health checks ----

type Result = healthFns.HealthCheckResult

/**
 * How long one run of a health check may take before it is treated as
 * unanswered. Two minutes, because Sync Progress can legitimately take most
 * of one: once the index has been built it asks electrs up to three times,
 * each with a 10 s read timeout, and electrs routinely lets those run out
 * while it indexes a batch. On that path it then tests the node's cookie,
 * reads the port (5 s timeout) and reads the progress (two curls of up to
 * 5 s each), so about 50 s in all. Electrum Server is a port read and a
 * cookie test, a few seconds at most. Two minutes is more than twice the
 * longest of those; it runs out only when a call is not coming back (or
 * several commands each ran to `exec`'s 30 s kill, and that run's answer is
 * still reported on the next call, below). It is not a limit on electrs:
 * nothing is killed.
 */
export const CHECK_TIMEOUT_MS = 120_000

/**
 * How many runs in a row may go unanswered while the check keeps showing its
 * last real result. Anything but `success` pauses every daemon that
 * `requires` the check, so one slow answer must not stop them; a check
 * that stays unanswered must still say so.
 */
export const STALE_REPEATS = 2

/**
 * Wrap a health check's `fn` so a run that never returns cannot wedge it.
 *
 * Why this exists: start-sdk's `HealthDaemon.runHealthCheckLoop` awaits `fn()`
 * with no limit and only looks at its abort signal once `fn()` returns. When a
 * service stops, `Daemons` terms entries in reverse dependency order (`_term`,
 * and `stopEntries` when it reconciles), every check before the daemon it
 * requires, and each term waits for that loop to end. So one `fn()` that
 * never returns freezes its check at "Starting" for the life of the service,
 * and later blocks every stop, update and restart before electrs is ever
 * signalled. In Bitcoin Knots (BLAKE2b) Companion that left the node running
 * while an update sat at "Installing 80%" and the OS Restart hung
 * (knots-blake2b-startos#4). Both checks here run commands in the
 * subcontainer (the cookie test, the Electrum probe, the progress read), and
 * `SubContainer.exec`'s 30 s timeout is armed only after it has waited,
 * without a limit, for its file mounts to sync.
 *
 * At most one run is outstanding. If the previous one is still pending when
 * the check fires again, this waits on that run again rather than starting
 * another, so a call that never returns costs one pending promise, not one
 * per run. A run that finishes after it was given up on keeps its result for
 * the next call, which returns it rather than starting over, so a check that
 * always takes a little longer than the bound still reports.
 */
export function bounded(
  fn: () => Result | Promise<Result>,
  onTimeout: () => Result,
  ms: number = CHECK_TIMEOUT_MS,
): () => Promise<Result> {
  let inFlight: Promise<Result> | null = null
  let abandoned: Promise<Result> | null = null
  let late: Result | null = null
  let last: Result | null = null
  let misses = 0

  return async () => {
    if (!inFlight && late) {
      const res = late
      late = null
      misses = 0
      last = res
      return res
    }
    if (!inFlight) {
      const run = Promise.resolve()
        .then(fn)
        .finally(() => {
          if (inFlight === run) inFlight = null
        })
      inFlight = run
      run.then(
        (res) => {
          if (abandoned === run) late = res
        },
        () => {},
      )
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    const timedOut = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms)
    })
    const current = inFlight
    try {
      // The race also handles the run, so if it is abandoned here and rejects
      // later there is no unhandled rejection to take down the runtime.
      const res = await Promise.race([current, timedOut])
      if (res !== null) {
        // Answered here, so it is not kept for the next call as well.
        if (abandoned === current) abandoned = late = null
        misses = 0
        last = res
        return res
      }
    } catch (e) {
      // A thrown fn is the SDK's to report, exactly as before.
      misses = 0
      last = null
      throw e
    } finally {
      clearTimeout(timer)
    }

    abandoned = current
    misses += 1
    console.warn(
      `health check run unanswered after ${ms / 1000}s (${misses} in a row)`,
    )
    if (last && misses <= STALE_REPEATS) return last
    return onTimeout()
  }
}

// What a health check shows when a run of it has not finished in time:
// starting, never failure, so a slow answer does not read as a fault. The
// check shows its result again once that run finishes.
export const unanswered = () => ({
  result: 'starting' as const,
  message: i18n('This check has not finished after two minutes'),
})
