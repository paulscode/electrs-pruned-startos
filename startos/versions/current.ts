import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.11.1:32',
  releaseNotes: {
    en_US: `Reports the BLAKE2b fork point to wallets that ask for it. This build could already index a chain whose blocks use the longer header, but it did not advertise where that chain forked, and it negotiated an older protocol version than the one that carries the field. A wallet cannot otherwise tell this chain from the one it split away from, because they share a genesis block, so a wallet that checks would refuse to connect. Sparrow (BLAKE2b) checks. Also adds a write timeout, so a client that stops reading cannot hold up the single loop that serves every other client and advances the index. Nothing you have set changes and no re-index is needed.`,
    es_ES: `Reports the BLAKE2b fork point to wallets that ask for it. This build could already index a chain whose blocks use the longer header, but it did not advertise where that chain forked, and it negotiated an older protocol version than the one that carries the field. A wallet cannot otherwise tell this chain from the one it split away from, because they share a genesis block, so a wallet that checks would refuse to connect. Sparrow (BLAKE2b) checks. Also adds a write timeout, so a client that stops reading cannot hold up the single loop that serves every other client and advances the index. Nothing you have set changes and no re-index is needed.`,
    de_DE: `Reports the BLAKE2b fork point to wallets that ask for it. This build could already index a chain whose blocks use the longer header, but it did not advertise where that chain forked, and it negotiated an older protocol version than the one that carries the field. A wallet cannot otherwise tell this chain from the one it split away from, because they share a genesis block, so a wallet that checks would refuse to connect. Sparrow (BLAKE2b) checks. Also adds a write timeout, so a client that stops reading cannot hold up the single loop that serves every other client and advances the index. Nothing you have set changes and no re-index is needed.`,
    pl_PL: `Reports the BLAKE2b fork point to wallets that ask for it. This build could already index a chain whose blocks use the longer header, but it did not advertise where that chain forked, and it negotiated an older protocol version than the one that carries the field. A wallet cannot otherwise tell this chain from the one it split away from, because they share a genesis block, so a wallet that checks would refuse to connect. Sparrow (BLAKE2b) checks. Also adds a write timeout, so a client that stops reading cannot hold up the single loop that serves every other client and advances the index. Nothing you have set changes and no re-index is needed.`,
    fr_FR: `Reports the BLAKE2b fork point to wallets that ask for it. This build could already index a chain whose blocks use the longer header, but it did not advertise where that chain forked, and it negotiated an older protocol version than the one that carries the field. A wallet cannot otherwise tell this chain from the one it split away from, because they share a genesis block, so a wallet that checks would refuse to connect. Sparrow (BLAKE2b) checks. Also adds a write timeout, so a client that stops reading cannot hold up the single loop that serves every other client and advances the index. Nothing you have set changes and no re-index is needed.`,
  },
  migrations: {
    // Nothing to migrate. This version only changes how blocks are fetched during indexing, not
    // what is stored: the index on disk is identical either way, so an existing one is resumed
    // rather than rebuilt.
    //
    // The `knots-rdts` remap that :30 needed lives in `v0_11_1_30.ts`, with the
    // version that introduced it, rather than being re-declared here.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
