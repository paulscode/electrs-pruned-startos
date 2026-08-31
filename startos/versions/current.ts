import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Fixes Sync Progress reading "Incorrect locale information provided" instead of ' +
  'how far the index has got. ' +
  ' ' +
  'The progress figures added in the previous version are the first numbers this ' +
  'service asks the platform to format, and it formats them against the language ' +
  'setting of the environment it runs in, which is one it does not accept. The ' +
  'numbers are now formatted before they are handed over. Grouping still follows ' +
  'your language where the setting is a usable one. ' +
  ' ' +
  'Sync Progress otherwise behaves as described for the previous version: a ' +
  'percentage and the block reached out of your node\'s height, reported ' +
  'throughout the build.'

export const current = VersionInfo.of({
  version: '0.11.1:35',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. This version only changes how blocks are fetched during indexing, not
    // what is stored: the index on disk is identical either way, so an existing one is resumed
    // rather than rebuilt.
    //
    // The `knots-rdts` remap that :30 needed lives in `v0_11_1_30.ts`, with the
    // version that introduced it, rather than being re-declared here.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
