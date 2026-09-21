import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Fixes wallet history failing to load when it reaches back past the point ' +
  'Bitcoin pruned. ' +
  ' ' +
  'Blocks older than the pruned window are not on disk, so they are fetched ' +
  'from network peers, which takes seconds each rather than milliseconds. The ' +
  'server gave up after ten seconds, which was less than a single fetch often ' +
  'needed, so a wallet with older history was shown an error instead of its ' +
  'transactions. Sparrow and Electrum both report this as a failure to fetch ' +
  'history. ' +
  ' ' +
  'The ten seconds could not simply be raised, because a waiting lookup used ' +
  'to hold up indexing and every other connected wallet with it. Three changes ' +
  'remove that: each wallet is now answered on its own worker rather than one ' +
  'at a time, old blocks are fetched several at a time rather than one after ' +
  'another, and the connection to Bitcoin is a small pool rather than a single ' +
  'shared socket. With those in place the wait is raised to sixty seconds, ' +
  'which is long enough for a peer fetch to finish. ' +
  ' ' +
  'Wallets with recent history only were never affected, and are unchanged. ' +
  'Loading long histories over Tor is still slow, just no longer a failure. ' +
  ' ' +
  'No reindex is needed and nothing was lost.'

export const current = VersionInfo.of({
  version: '0.11.1:42',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. Everything here is about how blocks are fetched and
    // how clients are served; the index on disk is untouched.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
