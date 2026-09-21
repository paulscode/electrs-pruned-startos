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
  'Raising the ten seconds on its own would have made every other wallet wait ' +
  'behind the slow one, so three things changed first: old blocks are now ' +
  'fetched several at a time rather than one after another, the connection to ' +
  'Bitcoin is a small pool rather than a single shared socket, and wallets are ' +
  'answered together rather than in turn, so a round of lookups takes as long ' +
  'as its slowest wallet instead of all of them added up. With those in place ' +
  'the wait is raised to sixty seconds, which is long enough for a peer fetch ' +
  'to finish. ' +
  ' ' +
  'One effect to expect: while a wallet is loading history from below the ' +
  'pruned point, the Sync Progress check can stop answering for the length of ' +
  'that lookup and report that Electrs is busy. That is the lookup being given ' +
  'time to finish rather than a problem, and it clears by itself. ' +
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
