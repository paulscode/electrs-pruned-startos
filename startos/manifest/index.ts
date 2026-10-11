import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'electrs-pruned',
  title: 'Electrs Pruned',
  license: 'MIT',
  packageRepo: 'https://github.com/paulscode/electrs-pruned-startos',
  upstreamRepo: 'https://github.com/romanz/electrs/',
  marketingUrl: 'https://github.com/romanz/electrs/',
  donationUrl: null,
  description: { short, long },
  // StartOS 0.4.0.2, not the SDK's default, so the registry hides releases from
  // older servers. Every release from 2026-10-11 on targets 0.4.0.2.
  osVersion: '0.4.0.2',
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
      // Never run this image under emulation. Left unset, emulateMissing
      // defaults to true and buildManifest then drops the architecture
      // requirement, so the package would offer itself to a riscv64 server and
      // run an x86_64 indexer there under emulation, which nobody has tested.
      // false keeps hardwareRequirements.arch at the two built above.
      emulateMissing: false,
    },
  },
  // Dependencies are declared in dependencies.ts, which the SDK writes into
  // the manifest at build time.
})
