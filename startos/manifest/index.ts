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
        title: 'Bitcoin Core',
        icon: 'https://raw.githubusercontent.com/Start9Labs/bitcoin-core-startos/refs/heads/30.x/dep-icon.svg',
      },
    },
    'knots-prerdts': {
      description: bitcoindDescription,
      optional: true,
      metadata: {
        title: 'Bitcoin Knots (pre-RDTS) Companion',
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
        title: 'Knots (BLAKE2b) Companion',
        icon: 'https://raw.githubusercontent.com/paulscode/knots-blake2b-startos/main/dep-icon.png',
      },
    },
  },
})
