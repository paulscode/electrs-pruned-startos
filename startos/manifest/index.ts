import { setupManifest } from '@start9labs/start-sdk'
import { bitcoindDescription, long, short } from './i18n'

export const manifest = setupManifest({
  id: 'electrs-pruned',
  title: 'Electrs Pruned',
  license: 'MIT',
  packageRepo: 'https://github.com/paulscode/electrs-pruned-startos',
  upstreamRepo: 'https://github.com/romanz/electrs/',
  marketingUrl: 'https://github.com/romanz/electrs/',
  donationUrl: null,
  description: { short, long },
  volumes: ['main'],
  images: {
    electrs: {
      source: {
        dockerBuild: {
          dockerfile: 'Dockerfile',
          workdir: '.',
        },
      },
      arch: ['x86_64', 'aarch64'],
      // Never run this image under emulation. Left unset, SDK 2.0.9's
      // buildManifest defaults it to 'x86_64' and then drops the architecture
      // requirement, so the package would offer itself to a riscv64 server and
      // run an x86_64 indexer there under emulation, which nobody has tested.
      // null keeps hardwareRequirements.arch at the two built above. Upstream's
      // SDK 3 spelling is `emulateMissing: false`.
      emulateMissingAs: null,
    },
  },
  // All four are optional here and exactly one is returned as required from
  // dependencies.ts, chosen by the user. The SDK evaluates setupDependencies at
  // runtime, so a conditional requirement is a supported shape. Declaring them
  // optional is what lets the UI show only the one in use.
  dependencies: {
    bitcoind: {
      description: bitcoindDescription,
      optional: true,
      metadata: {
        title: 'Bitcoin Knots',
        icon: 'https://raw.githubusercontent.com/Start9Labs/bitcoin-core-startos/refs/heads/30.x/dep-icon.svg',
      },
    },
    'knots-prerdts': {
      description: bitcoindDescription,
      optional: true,
      metadata: {
        title: 'Bitcoin Knots (SHA256) Companion',
        icon: 'https://raw.githubusercontent.com/paulscode/knots-prerdts-startos/main/dep-icon.png',
      },
    },
    // A different lineage from the three above: BLAKE2b test networks, on its
    // own ports, and with no btc-rpc-proxy, so a pruned node of this flavor has
    // nothing to serve the blocks it has dropped. See backends.ts.
    'knots-blake2b': {
      description: bitcoindDescription,
      optional: true,
      metadata: {
        title: 'Bitcoin Knots (BLAKE2b) Companion',
        icon: 'https://raw.githubusercontent.com/paulscode/knots-blake2b-startos/main/dep-icon.png',
      },
    },
  },
})
