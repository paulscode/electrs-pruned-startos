import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'

/**
 * 0.11.1:30, spun off so its migration stays with the version that introduced it.
 *
 * The `knots-rdts` remap shipped in :30. A migration belongs to the version that
 * needed it and is not carried forward into a successor, so :31 declares a clean
 * one and the work stays here. An install below :30 still runs it on the way up:
 * `VersionGraph` synthesizes a range vertex beneath `current`, so the hop passes
 * through this node.
 */
export const v_0_11_1_30 = VersionInfo.of({
  version: '0.11.1:30',
  releaseNotes: {
    en_US:
      'Removed the RDTS node from Select Node, since the RDTS rules now take ' +
      'effect at the BLAKE2b fork rather than activating separately, and began ' +
      'noticing when the selected node changes chain without changing identity.',
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
