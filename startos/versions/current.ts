import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Renames the node picklist and one entry in it. The action is now called ' +
  '"Select Node" rather than "Select Bitcoin Service", which is what Mempool ' +
  'Pruned calls the same choice, so the two packages name it the same way. ' +
  ' ' +
  'The pre-RDTS companion node is now called "Bitcoin Knots (SHA256) ' +
  'Companion", and the picklist and the dependency prompt follow it. Its ' +
  'description now says what actually distinguishes it: it is a second node on ' +
  'the same chain as your main Bitcoin service that never enforces BIP-110, so ' +
  'if the network splits over that rule it follows the side that does not ' +
  'require it. The old wording said it followed "the chain most hashpower ' +
  'follows", which is true today and is exactly the thing that would stop being ' +
  'true in the case the node exists for. ' +
  ' ' +
  'Only labels changed. The packages behind them keep the same ids, so an ' +
  'existing selection keeps working and nothing reindexes. ' +
  ' ' +
  'The instructions also correct a claim about SSL. They said no plaintext ' +
  'port is reachable from off the server, so a wallet always needs SSL on. ' +
  'That holds for LAN, .local and domain addresses, but not for Tor: the Tor ' +
  'service points an onion at whichever bridge address its SSL toggle selects, ' +
  'so an onion added with that toggle off carries plain TCP and a wallet using ' +
  'it needs SSL off.'

export const current = VersionInfo.of({
  version: '0.11.1:38',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. Display strings only: the stored `backend` value is
    // the package id, not the label, so a selection made under the old wording
    // still resolves and the address index is untouched.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
