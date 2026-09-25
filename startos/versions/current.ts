import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Three fixes for Electrs appearing to sync and re-sync. ' +
  ' ' +
  'Switching Select Node between the SHA256 and BLAKE2b nodes no longer ' +
  'rebuilds the index from scratch. The two chains share every block before ' +
  'the fork, so Electrs now keeps its index and indexes again only from the ' +
  'point where they split. One user waited 36 hours for a switch that rebuilt ' +
  'all 973,000 blocks; on a test server the same switch now indexed about ' +
  '12,000 blocks, the ones since the fork, in two minutes. Before it serves ' +
  'anything, Electrs checks its index against the node and steps back to the ' +
  'last block they agree on, so it never shows one chain as the other. ' +
  ' ' +
  'A new install no longer picks a node for you. With more than one Bitcoin ' +
  'node installed, Electrs asks which one to index before it starts, because ' +
  'that decides which chain your wallets see. With only one installed, it uses ' +
  'that one. ' +
  ' ' +
  'While your Bitcoin node restarts, for example after an update, Electrs now ' +
  'says it is waiting for the node to start. It used to say Electrs ' +
  'had exited and to check the logs, which made an ordinary restart look like ' +
  'a crash. ' +
  ' ' +
  'No reindex is needed and nothing is lost.'

export const current = VersionInfo.of({
  version: '0.11.1:43',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. The install-time node choice only runs on install, and
    // an existing index is kept exactly as it was.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
