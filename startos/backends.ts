import { i18n } from './i18n'

/**
 * The bitcoind flavors this package can index.
 *
 * All three are declared as optional dependencies in the manifest and exactly
 * one is returned as required from `dependencies.ts`, chosen by the user. The
 * SDK evaluates `setupDependencies` at runtime, so a conditional requirement is
 * a supported shape rather than a trick.
 *
 * They share host ids, internal ports and volume layout, because the two forks
 * change only their host-side `preferredExternalPort` values. That is why one
 * set of constants imported from `bitcoin-core-startos` resolves any of them,
 * and why adding a fourth flavor here should cost nothing but an entry.
 */
export const backends = {
  bitcoind: {
    title: 'Bitcoin',
    blurb: i18n('The official Bitcoin service, Core or Knots, either flavor.'),
  },
  'knots-prerdts': {
    title: 'Bitcoin Knots (pre-RDTS) Companion',
    blurb: i18n(
      'A second node following the chain most hashpower follows, installed alongside your main Bitcoin service.',
    ),
  },
  'knots-rdts': {
    title: 'Bitcoin Knots (RDTS) Companion',
    blurb: i18n(
      'A second node following the BIP-110 (RDTS) chain, installed alongside your main Bitcoin service.',
    ),
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
}
