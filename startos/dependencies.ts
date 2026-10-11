import { T } from '@start9labs/start-sdk'
import { BackendId, backends, defaultBackend, versionRange } from './backends'
import { storeJson } from './fileModels/store.json'
import { bitcoindDescription } from './manifest/i18n'
import { sdk } from './sdk'

/**
 * Exactly one backend is required; the other two are ignored.
 *
 * Each backend is its own `optional` dependency, enabled only while it is the
 * one the user selected. The SDK writes all three into the manifest, but
 * publishes a requirement at runtime for the enabled one only, so the UI shows a
 * single dependency and does not nag about the flavors they are not using.
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

const icons: Record<BackendId, string> = {
  bitcoind:
    'https://raw.githubusercontent.com/Start9Labs/bitcoin-core-startos/refs/heads/30.x/dep-icon.svg',
  'knots-prerdts':
    'https://raw.githubusercontent.com/paulscode/knots-prerdts-startos/main/dep-icon.png',
  // A different lineage from the two above: on its own ports, and with no
  // btc-rpc-proxy, so a pruned node of this flavor has nothing to serve the
  // blocks it has dropped. See backends.ts.
  'knots-blake2b':
    'https://raw.githubusercontent.com/paulscode/knots-blake2b-startos/main/dep-icon.png',
}

const selected = async (effects: T.Effects) =>
  (await storeJson.read((s) => s.backend).const(effects)) ?? defaultBackend

const backend = (id: BackendId) =>
  sdk.Dependency.optional(id, {
    description: bitcoindDescription,
    metadata: { title: backends[id].title, icon: icons[id] },
    kind: 'running',
    versionRange: versionRange[id],
    // Not one list for every flavor. The two mainnet forks inherit their health
    // check ids from the official package, but `knots-blake2b` is a separate
    // lineage with its own, and requiring an id a package does not declare is
    // indistinguishable from requiring one that is failing: StartOS reads
    // `health[id]`, gets `undefined`, and shows "Required health check not
    // passing" forever, unable to even name the check. See `backends.ts`.
    healthChecks: [...backends[id].healthChecks],
    enabled: async ({ effects }) => (await selected(effects)) === id,
  })

export const dependencies = sdk.Dependencies.of()
  .addDependency(backend('bitcoind'))
  .addDependency(backend('knots-prerdts'))
  .addDependency(backend('knots-blake2b'))
