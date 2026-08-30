import { backendLabels, defaultBackend, isBackendId } from '../backends'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec, Value } = sdk

export const inputSpec = InputSpec.of({
  backend: Value.select({
    name: i18n('Bitcoin Service'),
    description: i18n(
      'Which Bitcoin service to index. Choose the one whose chain you want this Electrum server to serve.',
    ),
    values: backendLabels,
    default: defaultBackend,
  }),
})

export const selectBackend = sdk.Action.withInput(
  'select-backend',

  async ({ effects }) => ({
    name: i18n('Select Bitcoin Service'),
    description: i18n(
      'Choose which installed Bitcoin service this Electrum server indexes.',
    ),
    // Changing this changes chain, and the two chains share no history beyond
    // their fork point, so the existing index describes something else. The
    // index is discarded and rebuilt rather than reorganised: a very deep reorg
    // is a slow and poorly exercised path, and between mainnet and a testnet
    // there is no common history at all, so it is not even well defined.
    warning: i18n(
      'Changing the Bitcoin service discards the address index and rebuilds it from scratch. The two services follow different chains, so the existing index does not describe the new one. Rebuilding can take hours, and considerably longer against a node that has already pruned the blocks being indexed.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => ({
    backend: (await storeJson.read((s) => s.backend).once()) ?? defaultBackend,
  }),

  async ({ effects, input }) => {
    if (!isBackendId(input.backend)) return
    // Only the selection is written here. The wipe is done by the init step,
    // which compares this against `indexedBackend`: doing it there means an
    // interrupted action cannot leave a half-deleted index behind, and a
    // restore from backup onto a different backend is caught too.
    await storeJson.merge(effects, { backend: input.backend })
  },
)
