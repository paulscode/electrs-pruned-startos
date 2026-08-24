import { autoconfig } from 'bitcoin-core-startos/startos/actions/config/autoconfig'
import { i18n } from './i18n'
import { sdk } from './sdk'

/**
 * No autoconfig task.
 *
 * Upstream `electrs-startos` raises a `critical` task here forcing `prune: 0`,
 * because upstream electrs refuses to start against a pruned node. This package
 * exists precisely to remove that requirement: blocks below bitcoind's
 * `pruneheight` are fetched with `getblock <hash> 0`, which btc-rpc-proxy —
 * which the bitcoind package puts on the RPC port whenever pruning is on —
 * satisfies from peers.
 *
 * So pruning is permitted, not merely tolerated, and an archival node keeps
 * working unchanged: the routing is gated on `getblockchaininfo.pruned`, and on
 * an archival node the block path is byte-for-byte upstream's.
 *
 * `txindex` is NOT required. Nothing in electrs's block or transaction path
 * needs it — see DISCOVERY.md §4.1 in the pruned-electrs repo.
 *
 * One caveat worth knowing before changing this: a *pruned* bitcoind whose RPC
 * port is NOT the proxy cannot serve historical blocks at all. On StartOS that
 * cannot happen — the bitcoind package starts the proxy exactly when pruning is
 * enabled — but it is why this package gates on the bitcoind revisions that
 * ship it.
 */
export const setDependencies = sdk.setupDependencies(async ({ effects }) => {
  return {
    bitcoind: {
      healthChecks: ['bitcoind', 'sync-progress'],
      kind: 'running',
      versionRange:
        '(>=28.4:17 && <29) || (>=29.4:4 && <30) || (>=30.3:4 && <31) || >=31.1:4',
    },
  }
})
