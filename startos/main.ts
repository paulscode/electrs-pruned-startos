import { FileHelper } from '@start9labs/start-sdk'
import { rm } from 'fs/promises'
import { manifest } from 'bitcoin-core-startos/startos/manifest'
import { backends, defaultBackend, backendIds } from './backends'
import { tomlFile } from './fileModels/electrs.toml'
import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import { bitcoindBridge, port } from './utils'

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

  // Discard the index if it was built against a different flavor.
  //
  // The two Knots flavors share history only to the RDTS split, and mainnet and
  // a testnet share none at all, so an index built against one does not
  // describe the other. electrs would cope with the first case by reorganising,
  // but a reorg thousands of blocks deep on a large index is slow and rarely
  // exercised, and the second case is not well defined. Rebuilding is slower and
  // always correct.
  //
  // Done here rather than in the action so an interrupted action cannot leave a
  // half-deleted index, and so a backup restored onto a different selection is
  // caught too. electrs's db_dir defaults to ./db and the image's WORKDIR is
  // /data, which is where the main volume mounts.
  const indexedBackend = await storeJson.read((s) => s.indexedBackend).once()
  if (indexedBackend !== undefined && indexedBackend !== backend) {
    console.warn(
      `Bitcoin service changed from ${indexedBackend} to ${backend}. Discarding the address index; it describes a different chain and will be rebuilt.`,
    )
    await rm(`${rootfs}/data/db`, { recursive: true, force: true })
    await storeJson.merge(effects, { syncNotified: false, everSynced: false })
    syncNotified = false
    everSynced = false
  }
  if (indexedBackend !== backend) {
    await storeJson.merge(effects, { indexedBackend: backend })
  }

  /**
   * Which chain the backend is on, read from its own generated config.
   *
   * The official package and the pre-RDTS fork are always mainnet, where bitcoind
   * keeps its data at the datadir root and electrs' `network` is `bitcoin`.
   * `knots-blake2b` may be either: it offers regtest and, since it repinned to
   * Knots rc4, mainnet. bitcoind puts a non-mainnet chain's data, its RPC cookie
   * included, in a subdirectory named for that chain, and electrs has to be told
   * which network it is on or it comes up with the wrong magic bytes and never
   * agrees with the node.
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
  const indexedNetwork = await storeJson.read((s) => s.indexedNetwork).once()
  const currentNetwork = chain ?? 'bitcoin'
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

  const readProgress = async (): Promise<{
    indexed: string
    total: string
    percent: string
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
      indexed: group(Math.min(Math.round(indexed), total_)),
      total: group(total_),
      percent: Math.min(100, (indexed / total) * 100).toFixed(1),
    }
  }

  return sdk.Daemons.of(effects)
    .addDaemon('electrs', {
      subcontainer: electrsContainer,
      exec: { command: ['electrs'] },
      ready: {
        display: i18n('Electrum Server'),
        fn: async () => {
          // checkPortListening reads /proc/net/tcp* — it succeeds as soon as
          // electrs binds the Electrum port, which it does at startup BEFORE
          // blocking on the bitcoind IBD wait (electrs/src/server.rs binds the
          // listener before Rpc::new connects to bitcoind). So the port is open
          // throughout that wait; a not-listening result just means electrs hasn't
          // bound the socket yet — it's still starting, not blocked on bitcoind.
          const result = await sdk.healthCheck.checkPortListening(
            effects,
            port,
            {
              successMessage: i18n(
                'Electrum server is ready and accepting connections',
              ),
              errorMessage: i18n('Electrum server is starting'),
            },
          )

          return result.result === 'success'
            ? result
            : {
                result: 'starting',
                message: i18n('Electrum server is starting'),
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
              if (!everSynced) {
                await storeJson.merge(effects, { everSynced: true })
                everSynced = true
              }
              return { message: i18n('Fully synced'), result: 'success' }
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
                    progress,
                  )
                : i18n(
                    'Electrs is not responding. It is likely busy indexing; this usually clears on its own.',
                  )
              : progress
                ? i18n(
                    'Electrs is building its address index: ${percent}%, block ${indexed} of ${total}. This can take several hours on first run.',
                    progress,
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
