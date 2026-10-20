import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Accepts the Bitcoin Knots (SHA256) Companion on its new 31.1 versions, ' +
  'which the previous release refused as an unmet dependency. Earlier ' +
  'versions of that node are still accepted. ' +
  'From 0.11.1:46: ' +
  'Rebuilt on version 3 of the StartOS packaging SDK, which needs StartOS ' +
  '0.4.0.2. Nothing you have set changes. ' +
  "Retropex's BLAKE2b Knots package, version 29.4.2:4 or later, is accepted " +
  'as the Bitcoin dependency again. Use it unpruned: when pruned, its RPC ' +
  'proxy cannot read BLAKE2b blocks, so indexing stalls below the prune ' +
  'height. The Bitcoin Knots (BLAKE2b) Companion works pruned. ' +
  'Restarting the service while it is still starting no longer leaves the ' +
  'old electrs process running.'

export const current = VersionInfo.of({
  version: '0.11.1:47',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate: the SDK changed, and nothing on disk does.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
