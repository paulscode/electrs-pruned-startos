import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Fixes the indexer refusing to start against a node running Bitcoin Knots ' +
  '29.4.2.knots20260508. ' +
  ' ' +
  'That release stopped reporting a "difficulty" field for blocks with the new ' +
  'header format, because a BLAKE2b difficulty and a SHA256d one are different ' +
  'units and cannot be compared. On this chain every block above the ' +
  'activation has the new header, so the field is simply absent, and the ' +
  'library this indexer reads the response with treated it as mandatory and ' +
  'rejected the whole reply. ' +
  ' ' +
  'The symptom was a crash loop: the indexer started, loaded its headers, then ' +
  'exited reporting "daemon not available" with "missing field difficulty" ' +
  'underneath, and the health check reported the daemon as crashed. Nothing ' +
  'was wrong with the node, and nothing was wrong with the index. ' +
  ' ' +
  'It now reads only the fields it actually uses, none of which is difficulty, ' +
  'and ignores the rest. No reindex is needed and no data was lost: the ' +
  'indexer never got as far as writing anything. If yours is in this state, ' +
  'updating is all that is required.'

export const current = VersionInfo.of({
  version: '0.11.1:40',
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
