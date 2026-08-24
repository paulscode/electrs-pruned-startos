import { defaultBackend, versionRange } from './backends'
import { storeJson } from './fileModels/store.json'
import { sdk } from './sdk'

/**
 * Exactly one backend is required; the other two are ignored.
 *
 * The manifest declares all three as `optional`, and this function, which the
 * SDK evaluates at runtime rather than at build time, returns a requirement for
 * only the one the user selected. So the UI shows a single dependency and does
 * not nag about the flavors they are not using.
 *
 * There is deliberately **no autoconfig task here.** Upstream `electrs-startos`
 * raises a `critical` task forcing `prune: 0`, because upstream electrs refuses
 * to start against a pruned node. This package exists to remove that
 * requirement: blocks below `getblockchaininfo.pruneheight` are fetched with
 * `getblock <hash> 0`, which btc-rpc-proxy answers from peers, and the bitcoind
 * package starts that proxy exactly when pruning is enabled. Pruning is
 * permitted, not merely tolerated, and an archival node is unaffected because
 * the routing is gated on `.pruned`.
 *
 * `txindex` is not required either. Nothing in electrs's block or transaction
 * path reads it.
 */
export const setDependencies = sdk.setupDependencies(async ({ effects }) => {
  const backend =
    (await storeJson.read((s) => s.backend).const(effects)) ?? defaultBackend

  // Health checks are named identically across the flavors because the forks
  // inherit them from the same upstream package.
  const requirement = {
    kind: 'running' as const,
    healthChecks: ['bitcoind', 'sync-progress'],
    versionRange: versionRange[backend],
  }

  // Return ONLY the selected backend. An earlier version listed every id and
  // set the unselected ones to `undefined`, which typechecks (the optional
  // dependencies are declared `T | undefined`) but fails at install: the host
  // iterates the returned keys and reads `.versionRange` off each value, so a
  // present-but-undefined entry is a null dereference rather than an absent
  // requirement. Omit the key instead of nulling the value.
  return { [backend]: requirement } as any
})
