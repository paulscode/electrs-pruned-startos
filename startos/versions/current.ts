import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'

export const current = VersionInfo.of({
  version: '0.11.1:28',
  releaseNotes: {
    en_US: `The Bitcoin Knots (RDTS) Companion has been removed from Select Node. It no longer has a chain of its own: those rules now take effect at the BLAKE2b fork rather than activating separately, so that option and Knots (BLAKE2b) Companion had become two names for the same destination. An indexer pointed at it now points at Knots (BLAKE2b) Companion, and rebuilds its index, because the old one describes a chain this can no longer reach.

Also fixes a case where the index was rebuilt without saying so. The address index is discarded and rebuilt when you change which node backs it, but a node can change chain without changing which node it is, and that was not noticed. The result was a rebuild that reported itself as a resync and never sent the notification for finishing. It is now noticed and reported correctly.`,
    es_ES: `The Bitcoin Knots (RDTS) Companion has been removed from Select Node. It no longer has a chain of its own: those rules now take effect at the BLAKE2b fork rather than activating separately, so that option and Knots (BLAKE2b) Companion had become two names for the same destination. An indexer pointed at it now points at Knots (BLAKE2b) Companion, and rebuilds its index, because the old one describes a chain this can no longer reach.

Also fixes a case where the index was rebuilt without saying so. The address index is discarded and rebuilt when you change which node backs it, but a node can change chain without changing which node it is, and that was not noticed. The result was a rebuild that reported itself as a resync and never sent the notification for finishing. It is now noticed and reported correctly.`,
    de_DE: `The Bitcoin Knots (RDTS) Companion has been removed from Select Node. It no longer has a chain of its own: those rules now take effect at the BLAKE2b fork rather than activating separately, so that option and Knots (BLAKE2b) Companion had become two names for the same destination. An indexer pointed at it now points at Knots (BLAKE2b) Companion, and rebuilds its index, because the old one describes a chain this can no longer reach.

Also fixes a case where the index was rebuilt without saying so. The address index is discarded and rebuilt when you change which node backs it, but a node can change chain without changing which node it is, and that was not noticed. The result was a rebuild that reported itself as a resync and never sent the notification for finishing. It is now noticed and reported correctly.`,
    pl_PL: `The Bitcoin Knots (RDTS) Companion has been removed from Select Node. It no longer has a chain of its own: those rules now take effect at the BLAKE2b fork rather than activating separately, so that option and Knots (BLAKE2b) Companion had become two names for the same destination. An indexer pointed at it now points at Knots (BLAKE2b) Companion, and rebuilds its index, because the old one describes a chain this can no longer reach.

Also fixes a case where the index was rebuilt without saying so. The address index is discarded and rebuilt when you change which node backs it, but a node can change chain without changing which node it is, and that was not noticed. The result was a rebuild that reported itself as a resync and never sent the notification for finishing. It is now noticed and reported correctly.`,
    fr_FR: `The Bitcoin Knots (RDTS) Companion has been removed from Select Node. It no longer has a chain of its own: those rules now take effect at the BLAKE2b fork rather than activating separately, so that option and Knots (BLAKE2b) Companion had become two names for the same destination. An indexer pointed at it now points at Knots (BLAKE2b) Companion, and rebuilds its index, because the old one describes a chain this can no longer reach.

Also fixes a case where the index was rebuilt without saying so. The address index is discarded and rebuilt when you change which node backs it, but a node can change chain without changing which node it is, and that was not noticed. The result was a rebuild that reported itself as a resync and never sent the notification for finishing. It is now noticed and reported correctly.`,
  },
  migrations: {
    up: async ({ effects }) => {
      // `knots-rdts` is no longer offered, so an install pointed at it would
      // fall back to the default on read and start indexing a different chain
      // by list order rather than by intent. Map it to `knots-blake2b`, the
      // node that replaced it: Knots rc4 activates the RDTS rules at the
      // BLAKE2b fork height instead of through versionbits, so there is no
      // separate RDTS chain left to index.
      //
      // This does mean a full rebuild, which main.ts triggers when it sees
      // `indexedBackend` disagree. There is no way to avoid that: the old index
      // describes a chain this package can no longer reach.
      const backend = await storeJson.read((s) => s.backend).once()
      if ((backend as string) === 'knots-rdts') {
        await storeJson.merge(effects, { backend: 'knots-blake2b' })
      }
    },
    down: IMPOSSIBLE,
  },
})
