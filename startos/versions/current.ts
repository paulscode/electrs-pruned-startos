import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.11.1:31',
  releaseNotes: {
    en_US: `Select Node's first option is now called Bitcoin Knots rather than Bitcoin Core. Both are the same StartOS service and share one entry, so the name is only a label for whichever you have installed, including a BLAKE2b build sideloaded over either. It reads as Knots because that is what nearly everyone running this indexer is running. If you are on Core, this is still your option. Nothing about which service is selected has changed.`,
    es_ES: `Select Node's first option is now called Bitcoin Knots rather than Bitcoin Core. Both are the same StartOS service and share one entry, so the name is only a label for whichever you have installed, including a BLAKE2b build sideloaded over either. It reads as Knots because that is what nearly everyone running this indexer is running. If you are on Core, this is still your option. Nothing about which service is selected has changed.`,
    de_DE: `Select Node's first option is now called Bitcoin Knots rather than Bitcoin Core. Both are the same StartOS service and share one entry, so the name is only a label for whichever you have installed, including a BLAKE2b build sideloaded over either. It reads as Knots because that is what nearly everyone running this indexer is running. If you are on Core, this is still your option. Nothing about which service is selected has changed.`,
    pl_PL: `Select Node's first option is now called Bitcoin Knots rather than Bitcoin Core. Both are the same StartOS service and share one entry, so the name is only a label for whichever you have installed, including a BLAKE2b build sideloaded over either. It reads as Knots because that is what nearly everyone running this indexer is running. If you are on Core, this is still your option. Nothing about which service is selected has changed.`,
    fr_FR: `Select Node's first option is now called Bitcoin Knots rather than Bitcoin Core. Both are the same StartOS service and share one entry, so the name is only a label for whichever you have installed, including a BLAKE2b build sideloaded over either. It reads as Knots because that is what nearly everyone running this indexer is running. If you are on Core, this is still your option. Nothing about which service is selected has changed.`,
  },
  migrations: {
    // Nothing to migrate. This version changes one option's label; the stored
    // value behind it is the package id `bitcoind`, which has not moved, so no
    // install needs rewriting and no index is rebuilt.
    //
    // The `knots-rdts` remap that :30 needed lives in `v0_11_1_30.ts`, with the
    // version that introduced it, rather than being re-declared here.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
