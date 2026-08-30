import {
  peerLocalHostId as btcPeerLocalHostId,
  peerPortLocal as btcPeerPortLocal,
  rpcHostId as btcRpcHostId,
  rpcPort as btcRpcPort,
} from 'bitcoin-core-startos/startos/utils'
import {
  peerLocalHostId as b2bPeerLocalHostId,
  peerPortLocal as b2bPeerPortLocal,
  rpcHostId as b2bRpcHostId,
  rpcPort as b2bRpcPort,
} from 'knots-blake2b-startos/startos/utils'
import { i18n } from './i18n'

/** Where a backend's RPC and whitelisted p2p live inside its own container. */
type Endpoints = {
  rpcHostId: string
  rpcPort: number
  peerLocalHostId: string
  peerPortLocal: number
}

/**
 * The health checks a backend must be passing before electrs should index it.
 *
 * Per backend rather than one list for all of them, because the ids are not
 * shared. StartOS looks each id up in the dependency's own health results and
 * treats a miss exactly like a failure: `dep.statusInfo.health[id]` is
 * `undefined`, `undefined !== 'success'`, and the UI shows "Required health
 * check not passing" for a check that does not exist. Nothing clears it, and
 * the warning cannot even name the check, because there is no name to read.
 *
 * The official package and its two mainnet forks run a daemon `bitcoind` with a
 * `sync-progress` check beside it. `knots-blake2b` is a separate lineage and
 * runs a daemon `node` with a `chain` check, which answers a different question:
 * on testnet4 the fork shares magic bytes, port and genesis with ordinary
 * testnet4, so "synced" is not the thing worth asserting. Which chain the node
 * is on is.
 */
type BackendHealthChecks = readonly string[]

/**
 * Written out rather than imported, unlike the endpoints below: a health check
 * id is not exported by the packages that declare it, so this is the one thing
 * here that a rename upstream would break silently rather than at compile time.
 */
const officialHealthChecks: BackendHealthChecks = ['bitcoind', 'sync-progress']

/**
 * The official package and its two mainnet forks share these, because the forks
 * change only their host-side `preferredExternalPort` values. Imported rather
 * than written out, so a change upstream reaches us as a type error.
 */
const officialEndpoints: Endpoints = {
  rpcHostId: btcRpcHostId,
  rpcPort: btcRpcPort,
  peerLocalHostId: btcPeerLocalHostId,
  peerPortLocal: btcPeerPortLocal,
}

/**
 * The bitcoind flavors this package can index.
 *
 * All three are declared as optional dependencies in the manifest and exactly
 * one is returned as required from `dependencies.ts`, chosen by the user. The
 * SDK evaluates `setupDependencies` at runtime, so a conditional requirement is
 * a supported shape rather than a trick.
 *
 * The official package and its two mainnet forks share host ids, internal ports
 * and volume layout, because the forks change only their host-side
 * `preferredExternalPort` values. `knots-blake2b` does not: it is a separate
 * lineage on its own ports, which is why each entry now carries its own
 * endpoints rather than every backend borrowing one set of constants.
 */
export const backends = {
  bitcoind: {
    title: 'Bitcoin Core',
    blurb: i18n('The official Bitcoin service, Core or Knots, either flavor.'),
    endpoints: officialEndpoints,
    healthChecks: officialHealthChecks,
  },
  // `knots-rdts` was here and is not any more. RDTS no longer has a chain of
  // its own: Knots rc4 removed the versionbits deployment and activates those
  // rules at the BLAKE2b fork height instead, so the RDTS variant and the
  // BLAKE2b one stopped being two things to choose between.
  'knots-prerdts': {
    title: 'Bitcoin Knots (pre-RDTS) Companion',
    blurb: i18n(
      'A second node following the chain most hashpower follows, installed alongside your main Bitcoin service.',
    ),
    endpoints: officialEndpoints,
    healthChecks: officialHealthChecks,
  },
  'knots-blake2b': {
    title: 'Bitcoin Knots (BLAKE2b) Companion',
    blurb: i18n(
      'A node on the BLAKE2b chain, whose blocks use a different proof of work and a longer header.',
    ),
    endpoints: {
      rpcHostId: b2bRpcHostId,
      rpcPort: b2bRpcPort,
      peerLocalHostId: b2bPeerLocalHostId,
      peerPortLocal: b2bPeerPortLocal,
    },
    healthChecks: ['node', 'chain'] satisfies BackendHealthChecks,
  },
} as const

export type BackendId = keyof typeof backends

export const backendIds = Object.keys(backends) as BackendId[]

export const defaultBackend: BackendId = 'bitcoind'

/** Labels for the Select Backend form, keyed as the SDK's `select` expects. */
export const backendLabels = Object.fromEntries(
  backendIds.map((id) => [id, backends[id].title]),
) as Record<BackendId, string>

export function isBackendId(v: unknown): v is BackendId {
  return typeof v === 'string' && (backendIds as string[]).includes(v)
}

/**
 * Version ranges per backend.
 *
 * `bitcoind` inherits upstream electrs-startos' range, which gates on the
 * revisions that introduced the `peer-local` host. Our own forks have that host
 * by construction, since they inherit it, so they only need to exclude
 * pre-release versions of themselves.
 */
export const versionRange: Record<BackendId, string> = {
  bitcoind:
    '(>=28.4:17 && <29) || (>=29.4:4 && <30) || (>=30.3:4 && <31) || >=31.1:4',
  'knots-prerdts': '>=29.4:6',
  // The release that added the whitelisted `peer-local` listener. Without it
  // electrs's p2p connection earns no permissions and is dropped the first time
  // it asks for an old block, which ends the process.
  'knots-blake2b': '>=1.0.0:13',
}
