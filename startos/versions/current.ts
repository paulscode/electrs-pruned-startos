import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Keeps indexing the BLAKE2b chain when the Bitcoin Knots (BLAKE2b) ' +
  'Companion moves to Knots 29.4.3. That release stops serving blocks past ' +
  'the chain split to any peer that does not say it follows the BLAKE2b ' +
  'chain, and Electrs did not say so, so it stopped at the last block it ' +
  'had while still answering wallets. It now says so whenever its node ' +
  'does. Update this package before updating that node. ' +
  'Uses version 3.1.0 of the packaging SDK. ' +
  'From 0.11.1:47: accepts the Bitcoin Knots (SHA256) Companion on its 31.1 ' +
  'versions.'

export const current = VersionInfo.of({
  version: '0.11.1:48',
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
