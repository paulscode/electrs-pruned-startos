import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Renames one entry in the Bitcoin service picklist. The pre-RDTS companion ' +
  'node is now called "Bitcoin Knots (SHA256) Companion", and this picklist and ' +
  'the dependency prompt follow it. ' +
  ' ' +
  'Only the label changed. It is the same package with the same id, so an ' +
  'existing selection keeps working and nothing reindexes. ' +
  ' ' +
  'Its description now says what actually distinguishes it: it is a second node ' +
  'on the same chain as your main Bitcoin service that never enforces BIP-110, ' +
  'so if the network splits over that rule it follows the side that does not ' +
  'require it. The old wording said it followed "the chain most hashpower ' +
  'follows", which is true today and is exactly the thing that would stop being ' +
  'true in the case the node exists for.'

export const current = VersionInfo.of({
  version: '0.11.1:37',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. This changes how the daemon is launched and what one
    // health check says; no setting, stored value or on-disk layout changes, and
    // the address index is untouched.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
