import { FileHelper } from '@start9labs/start-sdk'
import { existsSync } from 'fs'
import { rm } from 'fs/promises'
import { manifest } from 'bitcoin-core-startos/startos/manifest'
import { backends, defaultBackend, backendIds } from './backends'
import { tomlFile } from './fileModels/electrs.toml'
import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import { bitcoindBridge, port, reindexRequest } from './utils'
import { isListening } from './listening'

export const main = sdk.setupMain(async ({ effects }) => {
  /**
   * ======================== Setup (optional) ========================
   */
  console.info(i18n('Starting Electrs!'))

  let syncNotified =
    (await storeJson.read((s) => s.syncNotified).once()) ?? false
  let everSynced = (await storeJson.read((s) => s.everSynced).once()) ?? false

  // bitcoind's RPC + P2P over the LXC bridge, written into electrs.toml before
  // the daemon reads it. Resolved reactively (see bitcoindBridge): the bridge
  // address changes only on bitcoind install / uninstall / port-change, so main
  // re-fires and restarts electrs to heal on those — and never on a plain
  // bitcoind update. While bitcoind is absent each resolves null and we omit the
  // field, letting electrs fail to connect until the .const() heals it in.
  // Which flavor to index. All three share host ids, internal ports and volume
  // layout, because the forks change only their host-side preferred ports, so
  // one set of constants resolves any of them.
  const backend =
    (await storeJson.read((s) => s.backend).const(effects)) ?? defaultBackend
  console.info(`Indexing ${backends[backend].title} (${backend})`)

  const bitcoind = await bitcoindBridge(effects, backend)
  await tomlFile.merge(effects, {
    ...(bitcoind.rpc && { daemon_rpc_addr: bitcoind.rpc }),
    ...(bitcoind.p2p && { daemon_p2p_addr: bitcoind.p2p }),
  })

  // A second node that might hold the blocks the selected one has pruned.
  //
  // The two chains of the fork share every block below the split, so an operator running a
  // pruned node of one and a full node of the other already has most of the missing history on
  // local disk. Reading it from there costs a local RPC instead of pulling each block off the
  // network through the proxy, one at a time.
  //
  // Only the address is decided here. Whether a candidate is usable — archival rather than
  // pruned, and synced far enough to hold what is being asked for — is checked by electrs
  // against the node itself, because those are facts only the node can answer and they change
  // while it runs. An unusable candidate is refused there with a reason and indexing proceeds
  // exactly as it does without one.
  //
  // The first installed candidate wins. A null bridge means that dependency is not installed,
  // which is the common case: most installs have one node and get no helper at all.
  const helperCandidates = await Promise.all(
    backendIds
      .filter((id) => id !== backend)
      .map(async (id) => ({
        id,
        rpc: (await bitcoindBridge(effects, id)).rpc,
      })),
  )
  const helper = helperCandidates.find((c) => c.rpc)

  const electrsContainer = sdk.SubContainer.of(
    effects,
    { imageId: 'electrs' },
    sdk.Mounts.of()
      .mountVolume({
        volumeId: 'main',
        subpath: null,
        mountpoint: '/data',
        readonly: false,
      })
      .mountDependency<typeof manifest>({
        // Any of the three; they share volume id and layout. The mountpoint is
        // constant so electrs.toml's cookie_file never has to move.
        dependencyId: backend as 'bitcoind',
        volumeId: 'main',
        subpath: null,
        mountpoint: '/mnt/bitcoind',
        readonly: true,
      })
      .mountDependency<typeof manifest>({
        // The helper's own volume, for its cookie. Mounted whether or not a helper was found:
        // whether electrs is *told* to use it is decided below, and mounting the selected
        // backend a second time is harmless on an install that has only one node.
        dependencyId: (helper?.id ?? backend) as 'bitcoind',
        volumeId: 'main',
        subpath: null,
        mountpoint: '/mnt/helper',
        readonly: true,
      }),
    'electrs',
  )

  const rootfs = await electrsContainer.rootfs

  /**
   * Which chain the backend is on, read from its own generated config.
   *
   * Every backend this package offers is mainnet today: the official package
   * unless its operator chose otherwise, the SHA256 companion always, and
   * `knots-blake2b` since it dropped its chain selector in 1.0.0:30. bitcoind
   * puts a non-mainnet chain's data, its RPC cookie included, in a subdirectory
   * named for that chain, and electrs has to be told which network it is on or
   * it comes up with the wrong magic bytes and never agrees with the node.
   *
   * The probe below stays regardless, because the official package still offers
   * every chain and an operator can put it on one.
   *
   * Deriving it from the absence of a chain line rather than from the backend id
   * is what made that repin a non-event here: mainnet writes no such line, so it
   * falls through to `bitcoin` without this file knowing anything changed.
   *
   * Read rather than configured here, so the two cannot drift: the backend
   * regenerates that file on every start, and the reactive read below restarts
   * electrs when it changes.
   */
  const backendConf = await FileHelper.string(
    `${rootfs}/mnt/bitcoind/bitcoin.conf`,
  )
    .read(
      (c) => c,
      (prev, next) => next === null || prev === next,
    )
    .const(effects)

  // Every network electrs can be configured for, spelled as electrs names its database
  // directory for each (`config.rs`, `db_subdir`) -- which is also how `network` is written below.
  const electrsNetworks = [
    'bitcoin',
    'testnet',
    'testnet4',
    'regtest',
    'signet',
  ] as const

  const chain =
    (['regtest', 'testnet4', 'testnet', 'signet'] as const).find((c) =>
      backendConf?.split('\n').some((l) => l.trim() === `${c}=1`),
    ) ?? null

  // Mainnet's cookie is at the datadir root; every other chain nests it. Named once
  // because two things authenticate to the node with it now: electrs, through
  // `cookie_file` below, and the sync health check, which asks the node how tall it
  // is. Two copies of this rule would be two places to get a chain switch wrong.
  const cookiePath = chain
    ? `/mnt/bitcoind/${chain}/.cookie`
    : '/mnt/bitcoind/.cookie'

  // The helper's cookie sits under its own datadir on the same rule as the backend's: at the root
  // on mainnet, in a subdirectory named for the chain otherwise. Read from the helper's config
  // rather than assumed to match the backend's, because the whole point of a helper is that it is
  // a different node, and on a fork it is following a different chain.
  const helperConf = helper
    ? await FileHelper.string(`${rootfs}/mnt/helper/bitcoin.conf`)
        .read(
          (c) => c,
          (prev, next) => next === null || prev === next,
        )
        .const(effects)
    : null
  const helperChain =
    (['regtest', 'testnet4', 'testnet', 'signet'] as const).find((c) =>
      helperConf?.split('\n').some((l) => l.trim() === `${c}=1`),
    ) ?? null

  await tomlFile.merge(effects, {
    network: chain ?? 'bitcoin',
    cookie_file: cookiePath,
    // Absent unless a second node was found, which is the usual case. electrs treats the pair as
    // all-or-nothing, so both fields move together.
    ...(helper?.rpc && {
      helper_rpc_addr: helper.rpc,
      helper_cookie_file: helperChain
        ? `/mnt/helper/${helperChain}/.cookie`
        : '/mnt/helper/.cookie',
    }),
  })

  const currentNetwork = chain ?? 'bitcoin'

  // Keep the index when the Bitcoin service changes; only an index for another network goes.
  //
  // This used to delete the whole index on any change of service, on the grounds that the two
  // Knots flavors share history only to the fork. True, and it was also the wrong trade: the
  // shared part is nearly the entire index. One user who moved from the SHA256 node to the
  // BLAKE2b one waited 36 hours to rebuild all 973,000 blocks, when only the ~12,000 since the
  // fork needed indexing; the same switch on a test server now takes about two minutes.
  //
  // electrs now checks its index against the node before it serves anything and trims back to
  // the last block the two agree on (patch 0016), so keeping the index cannot serve one chain's
  // history as the other's. That check is what makes this safe; without it, a node that had
  // rejected the indexed tip would leave electrs advertising it and hanging on the first query
  // that needed one of its blocks.
  //
  // What still goes is an index for a different *network*. electrs keeps one database
  // directory per network, named exactly as it is configured below, and a mainnet index moved
  // onto a testnet node shares nothing but a lot of disk -- on a machine that is pruned
  // precisely to save it. Deleting those is what the old wipe did for that case, so it stays.
  //
  // Done here rather than in the action so an interrupted action cannot leave a half-deleted
  // index, and so a backup restored onto a different selection is caught too.
  const indexedBackend = await storeJson.read((s) => s.indexedBackend).once()
  const indexedNetwork = await storeJson.read((s) => s.indexedNetwork).once()
  if (indexedBackend !== undefined && indexedBackend !== backend) {
    console.warn(
      indexedNetwork === undefined || indexedNetwork === currentNetwork
        ? `Bitcoin service changed from ${indexedBackend} to ${backend}. Keeping the address index; electrs re-indexes from the last block the two agree on.`
        : `Bitcoin service changed from ${indexedBackend} to ${backend}, which is on ${currentNetwork} rather than ${indexedNetwork}. The ${indexedNetwork} index is discarded; this network starts from nothing.`,
    )
    for (const network of electrsNetworks) {
      if (network !== currentNetwork) {
        await rm(`${rootfs}/data/db/${network}`, { recursive: true, force: true })
      }
    }
    // A fresh "Sync Complete" once it has caught up on the new chain. `everSynced` stays: the
    // index is built, and the catch-up wording ("busy indexing, at block X of Y") is the true one
    // for re-indexing the blocks since a fork, where the first-build wording would promise hours.
    await storeJson.merge(effects, { syncNotified: false })
    syncNotified = false
  }
  if (indexedBackend !== backend) {
    await storeJson.merge(effects, { indexedBackend: backend })
  }

  // A backend can change chain without changing its id, and the check above
  // compares ids only. `knots-blake2b` did exactly that when it moved from
  // testnet4 to mainnet: same package, different chain.
  //
  // electrs itself copes, because it appends the network to its database
  // directory and so starts a fresh one rather than reading a mismatched
  // index. What does not cope is the pair of flags recording that an index
  // had finished: left standing, the health check describes a first-time
  // build as a resync, and the notification for the new chain never fires
  // because it already fired for the old one.
  if (indexedNetwork !== undefined && indexedNetwork !== currentNetwork) {
    console.warn(
      `Chain changed from ${indexedNetwork} to ${currentNetwork} on the same Bitcoin service. electrs indexes each chain separately, so this one starts from nothing.`,
    )
    await storeJson.merge(effects, { syncNotified: false, everSynced: false })
    syncNotified = false
    everSynced = false
  }
  if (indexedNetwork !== currentNetwork) {
    await storeJson.merge(effects, { indexedNetwork: currentNetwork })
  }

  // A Reindex request, left by the action. Only the index for the network electrs is about to
  // open goes: that is the one it would crash on. `backend`, `indexedBackend` and
  // `indexedNetwork` stay, because the index is rebuilt against the same node, and clearing them
  // would make the next start misread the rebuild as a node switch.
  //
  // Both flags reset, so the rebuild reports "building its address index" rather than "busy",
  // and the completion notification fires again. The marker goes last, so a delete interrupted
  // part way is repeated on the next start rather than leaving half an index behind.
  if (existsSync(reindexRequest)) {
    console.warn(
      `Reindex requested. Deleting the ${currentNetwork} index; electrs builds it again from the first block.`,
    )
    await rm(sdk.volumes.main.subpath(`db/${currentNetwork}`), {
      recursive: true,
      force: true,
    })
    await storeJson.merge(effects, { everSynced: false, syncNotified: false })
    everSynced = false
    syncNotified = false
    await rm(reindexRequest, { force: true })
  }

  // Restart only when the backend writes a replacement cookie; an absent cookie
  // means it is down.
  await FileHelper.string(
    chain
      ? `${rootfs}/mnt/bitcoind/${chain}/.cookie`
      : `${rootfs}/mnt/bitcoind/.cookie`,
  )
    .read(
      (cookie) => cookie,
      (prev, next) => next === null || prev === next,
    )
    .const(effects)

  /**
   * ======================== Daemons ========================
   */
  /**
   * How far the index has got, and how far it has to go.
   *
   * Read from electrs's Prometheus endpoint, not its Electrum RPC, and that is the
   * whole reason this can report a number at all. The Electrum RPC is precisely
   * what is unavailable during a build: the sync loop indexes a whole ~2000-block
   * batch before servicing a request, which is why the check below has to treat a
   * non-answer as normal. The metrics server is a separate thread and answers
   * throughout. Confirmed against a live build, where the Electrum probe timed out
   * and this returned immediately.
   *
   * `index_height` is set per block as each is indexed, so it moves during a batch
   * rather than only between batches.
   *
   * The target has to come from the node, because electrs publishes no metric for
   * it: `index_height` is where indexing has reached, and during a build its header
   * chain stops at the same place, so nothing electrs knows is the finish line.
   *
   * Null on any doubt, and every caller has a message that reads correctly without
   * a number. A health message is not worth being wrong about.
   */
  /**
   * A locale `Intl` will actually accept, for grouping the block numbers.
   *
   * Everything here is a string by the time it reaches `i18n`, and that is not
   * incidental. `i18n` formats a **number** param with
   * `Intl.NumberFormat(process.env.LANG)`, and StartOS runs services with
   * `LANG=C.UTF-8`, which `Intl` rejects: `RangeError: Incorrect locale
   * information provided`. The health check displayed that sentence where the
   * progress was meant to be. Number params are the only thing that reaches that
   * call and these were the first in this package, so nothing had exercised it.
   *
   * Grouping is still done by locale where the runtime offers a usable one,
   * falling back to en-US rather than to no grouping, since "962698" is harder to
   * read at a glance than "962,698" in any locale.
   */
  const groupLocale = (() => {
    const fromEnv = process.env.LANG?.replace(/\.UTF-8$/i, '').replace('_', '-')
    try {
      if (fromEnv) {
        new Intl.NumberFormat(fromEnv)
        return fromEnv
      }
    } catch {
      // Not a locale Intl knows; fall through.
    }
    return 'en-US'
  })()

  const group = (n: number) => n.toLocaleString(groupLocale)

  // `params` holds strings only, because it is handed to i18n, and SDK 2.0.9's i18n throws a
  // RangeError on a number parameter. `behind` is the number, kept beside it.
  const readProgress = async (): Promise<{
    params: { indexed: string; total: string; percent: string }
    behind: number
  } | null> => {
    const probe = `IDX=$(curl -s --max-time 5 http://127.0.0.1:4224/metrics 2>/dev/null \
| awk '$1 == "electrs_index_height{type=\\"tip\\"}" { print $2 }' | tail -1)
TGT=$(curl -s --max-time 5 --user "$(cat ${cookiePath})" -H 'content-type: text/plain;' \
--data-binary '{"jsonrpc":"1.0","id":"h","method":"getblockchaininfo","params":[]}' \
http://${bitcoind.rpc}/ 2>/dev/null | sed -n 's/.*"blocks":\\([0-9]*\\).*/\\1/p')
printf '%s %s' "\${IDX:-}" "\${TGT:-}"`

    const res = await electrsContainer.exec(['bash', '-c', probe], {})
    if (res.exitCode !== 0) return null

    // Prometheus renders a gauge as a float, so a height can arrive as `7.7e+05`.
    // Number handles that; parseInt would silently read it as 7.
    const [rawIndexed, rawTotal] = res.stdout.toString().trim().split(/\s+/)
    const indexed = Number(rawIndexed)
    const total = Number(rawTotal)
    if (
      !Number.isFinite(indexed) ||
      !Number.isFinite(total) ||
      total <= 0 ||
      indexed < 0
    ) {
      return null
    }

    // Clamped because the two numbers are read a moment apart and from different
    // services, so a block landing in between can put the index a hair past the
    // height it was measured against. Both the percentage and the block number are
    // clamped, for the same reason: "100.2%" and "block 962,700 of 962,698" each
    // read as a fault rather than as the one-block race they are.
    const total_ = Math.round(total)
    return {
      params: {
        indexed: group(Math.min(Math.round(indexed), total_)),
        total: group(total_),
        percent: Math.min(100, (indexed / total) * 100).toFixed(1),
      },
      behind: Math.max(0, total_ - Math.round(indexed)),
    }
  }

  /**
   * Whether the node's RPC cookie is there, i.e. whether the node is up.
   *
   * The daemon below holds electrs back until this is true, and the node deletes its cookie
   * whenever it stops, so while it is false electrs is not running *on purpose*. Both health
   * checks ask it before saying anything about electrs, so a restart of the node reads as
   * waiting for the node rather than as a crash. The same bash test the daemon's loop makes, so
   * the two cannot disagree. If the exec itself fails, report the node as up and let the caller
   * say what it would have said anyway.
   */
  const nodeCookiePresent = () =>
    electrsContainer
      .exec(['bash', '-c', `[ -r ${JSON.stringify(cookiePath)} ]`], {})
      .then((r) => r.exitCode === 0)
      .catch(() => true)

  const waitingForNode = () =>
    i18n(
      'Waiting for ${node} to start. Electrs starts as soon as the node is up; if it is already running and this persists, check the logs.',
      { node: backends[backend].title },
    )

  return sdk.Daemons.of(effects)
    .addDaemon('electrs', {
      subcontainer: electrsContainer,
      // Wait for the node's cookie before starting electrs, rather than starting
      // and dying on it.
      //
      // The dependency is satisfied when the node's container is up, which is not
      // the same as bitcoind having written its cookie: on a node restart or an
      // update there is a window where the mount is present and the file is not.
      // electrs treats that as fatal ("failed to open bitcoind cookie file"), exits
      // 1, and gets restarted, so every node restart produced a burst of crashes
      // that cleared only once the timing happened to work out. Observed on a live
      // node: five crashes in 36 seconds after a node update, and 119 in one hour
      // during setup.
      //
      // Bounded, and it execs anyway when the wait runs out. A cookie that never
      // appears is a real fault (wrong chain, missing mount, node not running), and
      // the error electrs gives for it is a better report than hanging here would
      // be. Waiting is only meant to cover the seconds a restart takes.
      exec: {
        command: [
          'bash',
          '-c',
          `for i in $(seq 1 300); do
  [ -r ${JSON.stringify(cookiePath)} ] && break
  [ "$i" = 1 ] && echo "waiting for the node's cookie at ${cookiePath}"
  sleep 1
done
exec electrs`,
        ],
      },
      ready: {
        display: i18n('Electrum Server'),
        fn: async () => {
          // A LISTEN socket on the Electrum port appears as soon as electrs
          // binds it, which it does at startup BEFORE
          // blocking on the bitcoind IBD wait (electrs/src/server.rs binds the
          // listener before Rpc::new connects to bitcoind). So the port is open
          // throughout that wait; a not-listening result just means electrs hasn't
          // bound the socket yet — it's still starting, not blocked on bitcoind.
          //
          // `isListening` rather than the SDK's `checkPortListening`, which counts any socket on
          // the port in any state: the TIME_WAIT connections left by an electrs that just exited
          // made this report ready while electrs was still waiting for the node. See listening.ts.
          if (await isListening(port)) {
            return {
              result: 'success',
              message: i18n(
                'Electrum server is ready and accepting connections',
              ),
            }
          }
          // Not ready yet. While the node is down this is the line the operator sees -- the
          // Sync check does not run until this one passes -- so it is the one that has to say so.
          return {
            result: 'starting',
            message: (await nodeCookiePresent())
              ? i18n('Electrum server is starting')
              : waitingForNode(),
          }
        },
      },
      requires: [],
    })
    .addHealthCheck('sync', {
      ready: {
        display: i18n('Sync Progress'),
        fn: async () => {
          // Probe electrs's Electrum RPC with server.banner. Until the index is
          // ready, electrs replies with {"code": -32603, "message": "unavailable
          // index"} — but far more often during a build it does not reply at all
          // within the timeout, because its sync loop indexes a whole ~2000-block
          // batch (~2 min each) before servicing any RPC and only answers between
          // batches (electrs/src/server.rs `while server_rx.is_empty()`).
          //
          // So sync must be confirmed POSITIVELY — only a real JSON-RPC `result`
          // counts as synced. A read timeout must fail the script (`|| exit`),
          // otherwise the trailing printf's exit code masks it and an empty reply
          // is misread as synced, reporting "Fully synced" all through the build.
          const probe = `exec 3<>/dev/tcp/127.0.0.1/${port} || exit 1
printf '%s\\n' '{"jsonrpc":"2.0","id":1,"method":"server.banner","params":[]}' >&3
IFS= read -t 10 -r line <&3 || exit 2
exec 3<&- 2>/dev/null
printf '%s' "$line"`

          // Before the first success a non-answer is the norm, so one attempt
          // says all it can. Afterwards it is surprising enough to be worth
          // re-asking: on modest hardware indexing a single block, or the
          // RocksDB compaction behind it, blocks the RPC loop past the read
          // timeout, and one such blip is not evidence of a sync regression.
          for (let attempt = everSynced ? 3 : 1; attempt > 0; attempt--) {
            const res = await electrsContainer.exec(['bash', '-c', probe], {})

            if (
              res.exitCode === 0 &&
              res.stdout.toString().includes('"result"')
            ) {
              // An answer is not the same as caught up. Once an index has been built, electrs
              // answers between indexing batches, so after Select Node moves it to a node with
              // blocks it has not indexed, server.banner succeeds while it is still working
              // through them, and this used to say "Fully synced" and fire Sync Complete with
              // thousands of blocks to go. Upstream made the same correction. One block behind is
              // allowed: the node and the index are read a moment apart, and a block found in
              // between is not a sync in progress. No reading at all counts as caught up, as an
              // answer always did before.
              const progress = await readProgress()
              if (progress && progress.behind > 1) {
                return {
                  message: i18n(
                    'Electrs is catching up: block ${indexed} of ${total} (${percent}%).',
                    progress.params,
                  ),
                  result: 'loading',
                }
              }
              if (!everSynced) {
                await storeJson.merge(effects, { everSynced: true })
                everSynced = true
              }
              return { message: i18n('Fully synced'), result: 'success' }
            }
          }

          // Before guessing at a cause, find out why electrs did not answer. Three reasons, and
          // they call for three different responses, so each gets its own message.
          //
          // First, the node. The daemon holds electrs back until the node's cookie exists, and the
          // node deletes its cookie whenever it stops, so every restart of the node spends a while
          // with electrs not running at all. This used to read "exited and is being restarted;
          // check the logs", and in one user's log all ten times it said so were that wait during
          // a Knots restart: it is how a working setup came to be reported as unstable. Asked
          // first and on its own, because it must not depend on a port reading -- see below.
          // This check only runs once the daemon's ready check has passed, so in practice the
          // daemon's line is what says this during an outage; this covers the node going away
          // while the check is already running.
          if (!(await nodeCookiePresent())) {
            return { message: waitingForNode(), result: 'loading' }
          }

          // Then whether electrs is running. Every failure of the probe used to be reported as
          // indexing, which is the right guess during a build and the wrong one after a crash:
          // a crash loop on a missing cookie once reported "likely busy indexing" for as long as
          // it lasted. electrs binds its listener before anything else, so no listener means it
          // is not up, and a listener that will not answer is the busy case below.
          //
          // A real LISTEN check, not the SDK's `checkPortListening`: that one counts the
          // TIME_WAIT connections an exited electrs leaves behind, and on a live server it said
          // "busy indexing" 34 seconds after electrs had died. See listening.ts.
          if (!(await isListening(port))) {
            return {
              message: i18n(
                'Electrs is not running. It exited and is being restarted; if this persists, check the logs.',
              ),
              result: 'failure',
            }
          }

          // A built index is never rebuilt, so past the first success the
          // build message would promise a fully-synced user hours of work
          // that is not happening — and send them to reindex a good index.
          // Asked only once the Electrum probe has already failed, which is the
          // only time there is anything to report. A synced server answers on the
          // first attempt and never pays for this.
          const progress = await readProgress()

          return {
            message: everSynced
              ? progress
                ? i18n(
                    'Electrs is not responding. It is likely busy indexing, at block ${indexed} of ${total} (${percent}%). This usually clears on its own.',
                    progress.params,
                  )
                : i18n(
                    'Electrs is not responding. It is likely busy indexing; this usually clears on its own.',
                  )
              : progress
                ? i18n(
                    'Electrs is building its address index: ${percent}%, block ${indexed} of ${total}. This can take several hours on first run.',
                    progress.params,
                  )
                : i18n(
                    'Electrs is building its address index. This can take several hours on first run.',
                  ),
            result: 'loading',
          }
        },
      },
      requires: ['electrs'],
    })
    .addOneshot('synced-true', {
      subcontainer: null,
      exec: {
        fn: async () => {
          // The SDK re-fires this oneshot every time the sync health check
          // dips out of success and recovers (TCP probe blips). The closure
          // flag is the source of truth within a main lifecycle; the on-disk
          // flag re-seeds it on next startup.
          if (syncNotified) return null
          await sdk.notification.create(effects, {
            level: 'success',
            title: i18n('Sync Complete'),
            message: i18n(
              'Electrs has finished building its address index. The Electrum server is ready.',
            ),
          })
          await storeJson.merge(effects, { syncNotified: true })
          syncNotified = true
          return null
        },
      },
      requires: ['sync'],
    })
})
