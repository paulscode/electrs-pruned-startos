import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Sync Progress now says how far along the index actually is, rather than only ' +
  'that it is building. It reports a percentage and the block it has reached out ' +
  "of your node's height, and it keeps reporting throughout, including during the " +
  'long stretches when the server is too busy indexing to answer anything else. ' +
  ' ' +
  'That last part is why it could not say before. The check asks the Electrum ' +
  'server whether it is ready, and during a build that question goes unanswered ' +
  'for minutes at a time, because the server indexes a whole batch of blocks ' +
  'before it services any request. The progress figure is read from somewhere ' +
  'that does answer throughout, so a first index no longer looks the same at hour ' +
  'one as it does at hour six. ' +
  ' ' +
  'Nothing about how the index is built has changed, and nothing new is exposed ' +
  'outside the service to do this.'

export const current = VersionInfo.of({
  version: '0.11.1:34',
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
