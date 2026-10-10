import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'A new Reindex action deletes the address index and builds it again, for an ' +
  'index that is corrupted. Until now the only way out of a corrupted index was ' +
  'to uninstall and reinstall Electrs. Use it only when Electrs keeps crashing ' +
  'with a database error such as "Corruption" in its logs: the rebuild takes as ' +
  'long as a first index, which on a pruned node can be a day or more. Switching ' +
  'node does not need it, since Select Node keeps the index. ' +
  ' ' +
  'The Log Level setting now explains what each level records, and the Bitcoin ' +
  'dependency now says what Electrs takes from the node. The package no longer ' +
  'offers to run under emulation on a server architecture it is not built for. ' +
  ' ' +
  'Nothing changes for an existing index.'

export const current = VersionInfo.of({
  version: '0.11.1:44',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. Reindex acts only when its action is run, and an
    // existing index is kept exactly as it was.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
