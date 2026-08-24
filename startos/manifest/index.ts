import { setupManifest } from '@start9labs/start-sdk'
import { bitcoindDescription, long, short } from './i18n'

export const manifest = setupManifest({
  id: 'pruned-electrs',
  title: 'Pruned Electrs',
  license: 'MIT',
  packageRepo: 'https://github.com/paulscode/pruned-electrs',
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
  dependencies: {
    bitcoind: {
      description: bitcoindDescription,
      optional: false,
      metadata: {
        title: 'Bitcoin',
        icon: 'https://raw.githubusercontent.com/Start9Labs/bitcoin-core-startos/refs/heads/30.x/dep-icon.svg',
      },
    },
  },
})
