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
    title: 'Bitcoin',
    blurb: i18n('The official Bitcoin service, Core or Knots, either flavor.'),
    endpoints: officialEndpoints,
  },
  'knots-prerdts': {
    title: 'Bitcoin Knots (pre-RDTS) Companion',
    blurb: i18n(
      'A second node following the chain most hashpower follows, installed alongside your main Bitcoin service.',
    ),
    endpoints: officialEndpoints,
  },
  'knots-rdts': {
    title: 'Bitcoin Knots (RDTS) Companion',
    blurb: i18n(
      'A second node following the BIP-110 (RDTS) chain, installed alongside your main Bitcoin service.',
    ),
    endpoints: officialEndpoints,
  },
  'knots-blake2b': {
    title: 'Bitcoin Knots BLAKE2b',
    blurb: i18n(
      'A node on the BLAKE2b test networks, whose blocks use a different proof of work and a longer header.',
    ),
    endpoints: {
      rpcHostId: b2bRpcHostId,
      rpcPort: b2bRpcPort,
      peerLocalHostId: b2bPeerLocalHostId,
      peerPortLocal: b2bPeerPortLocal,
    },
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
  'knots-rdts': '>=29.4:6',
  // The release that added the whitelisted `peer-local` listener. Without it
  // electrs's p2p connection earns no permissions and is dropped the first time
  // it asks for an old block, which ends the process.
  'knots-blake2b': '>=1.0.0:13',
}
