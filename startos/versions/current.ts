import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Finishes the fix that 0.11.1:40 started. ' +
  ' ' +
  'Bitcoin Knots 29.4.2.knots20260508 stopped reporting a "difficulty" field ' +
  'for blocks with the new header format. 0.11.1:40 fixed the call that ' +
  'stopped the indexer starting, but two more calls read the same removed ' +
  'field, so a started indexer then stalled on the first block it tried to ' +
  'index, logging "resolving block heights failed ... missing field ' +
  'difficulty" and retrying every thirty seconds. ' +
  ' ' +
  'Block heights and block transaction lists are now read without it, the same ' +
  'way the first fix did. ' +
  ' ' +
  'No reindex is needed and nothing was lost. An index stuck at this point ' +
  'simply resumes from the block it stopped at.'

export const current = VersionInfo.of({
  version: '0.11.1:41',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. The change is in how one RPC reply is parsed; the
    // index on disk is untouched and was never reached by the failure.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
