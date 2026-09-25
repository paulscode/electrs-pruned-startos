import { backendLabels, defaultBackend, isBackendId } from '../backends'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec, Value } = sdk

export const inputSpec = InputSpec.of({
  backend: Value.select({
    name: i18n('Select Node'),
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
    name: i18n('Select Node'),
    description: i18n(
      'Choose which installed Bitcoin service this Electrum server indexes.',
    ),
    // Changing this can change chain, but the two mainnet chains share every block
    // below their fork, so the index is kept and electrs re-indexes only from the
    // last block the index and the new node agree on. That used to be a full rebuild
    // (one user waited 36 hours to rebuild all 973,000 blocks when only the ~12,000
    // since the fork needed indexing; the same switch now takes minutes);
    // what made keeping it safe is electrs checking the index against the node
    // before serving, patch 0016. An index for another network still goes. See the
    // backend-change block in main.ts.
    warning: i18n(
      'Electrs keeps its address index and indexes again only from the last block the two services agree on. Between the SHA256 and BLAKE2b nodes that is the fork, so this is a small part of a full rebuild, though it can still take a while if the new node has already pruned those blocks. A service on a different network, such as a testnet, starts from scratch.',
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
