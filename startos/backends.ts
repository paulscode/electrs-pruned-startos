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
 * both mainnet chains share magic bytes, port 8333 and every block up to 961631,
 * so a node with no peers on the fork sits one block below activation looking
 * perfectly synced. "Synced" is not the thing worth asserting there; which chain
 * the node is on is.
 *
 * `knots-blake2b` gained a `sync-progress` check of its own when it adopted the
 * official action set in 1.0.0:31, so requiring it here would now work. It is
 * deliberately not required: `chain` already fails while the node is below the
 * activation height, and adding a second check that goes amber through the whole
 * of IBD would only make the dependency look unsatisfied for longer without
 * saying anything new.
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
    // Named for Knots rather than Core, which is a deliberate departure from the
    // packaging guide's "call a multi-flavor dependency Bitcoin". Both flavors
    // share the `bitcoind` id, so this one entry is the only way to reach either,
    // and nearly everyone running this stack runs Knots. Naming the common case
    // costs a Core user one line of the blurb; naming the rare one would leave
    // the majority hunting for an option that is not there.
    title: 'Bitcoin Knots',
    blurb: i18n(
      'The official Bitcoin service, whichever flavor is installed: Knots, Core, or a BLAKE2b build sideloaded over either.',
    ),
    endpoints: officialEndpoints,
    healthChecks: officialHealthChecks,
  },
  // `knots-rdts` was here and is not any more. RDTS no longer has a chain of
  // its own: Knots rc4 removed the versionbits deployment and activates those
  // rules at the BLAKE2b fork height instead, so the RDTS variant and the
  // BLAKE2b one stopped being two things to choose between.
  // The id stays `knots-prerdts`; only its title changed. That package renamed
  // itself to SHA256 without touching its id or version flavor, both of which
  // are identity the registry indexes by.
  'knots-prerdts': {
    title: 'Bitcoin Knots (SHA256) Companion',
    blurb: i18n(
      'A second node on the same chain as your main Bitcoin service, installed alongside it. It never enforces BIP-110, so if the network splits over that rule this one follows the side that does not require it.',
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
  // MATCHED THROUGH `satisfies`, NOT DIRECTLY. That package's versions are
  // flavored (`#knotsprerdts:29.3:N`) and a flavored version never satisfies an
  // unflavored range, so this range does not match its version at all. It
  // matches the `29.4:13` entry on that package's own `satisfies` list, which is
  // how a flavored package declares the unflavored versions it stands in for.
  //
  // Checked with the SDK's comparator rather than reasoned about:
  //   #knotsprerdts:29.3:27 vs >=29.4:6  => false
  //   29.4:13               vs >=29.4:6  => true
  //
  // So this gate is only as stable as that list. If that package ever drops or
  // lowers its `satisfies('29.4:13')`, this stops matching and nothing here
  // changes to say so.
  'knots-prerdts': '>=29.4:6',
  // The release that added the whitelisted `peer-local` listener. Without it
  // electrs's p2p connection earns no permissions and is dropped the first time
  // it asks for an old block, which ends the process.
  'knots-blake2b': '>=1.0.0:13',
}
