import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Stop, updates and restarts can no longer be held up by a status check ' +
  'that never finishes: a check still unanswered after two minutes says so, ' +
  'and no longer keeps the service from stopping. The same problem made ' +
  'Bitcoin Knots (BLAKE2b) Companion updates hang before its 29.5.0:1. ' +
  'From 0.11.1:48: keeps indexing the BLAKE2b chain when the Bitcoin Knots (BLAKE2b) ' +
  'Companion moves to Knots 29.4.3. That release stops serving blocks past ' +
  'the chain split to any peer that does not say it follows the BLAKE2b ' +
  'chain, and Electrs did not say so, so it stopped at the last block it ' +
  'had while still answering wallets. It now says so whenever its node ' +
  'does. Update this package before updating that node. ' +
  'Uses version 3.1.0 of the packaging SDK.'

export const current = VersionInfo.of({
  version: '0.11.1:49',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate: nothing on disk changes.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
