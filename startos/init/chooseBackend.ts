import { selectBackend } from '../actions/selectBackend'
import { BackendId, backendIds, backends } from '../backends'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

/**
 * On install, settle which node to index rather than assume one.
 *
 * The store falls back to `defaultBackend` when nothing has been chosen, and until
 * this existed a fresh install simply used it. That is only right when the default is
 * the node the operator meant. A user with both the SHA256 and the BLAKE2b nodes
 * installed got the SHA256 one without being asked, indexed it for 19 days while their
 * wallet lived on the BLAKE2b chain, and only found out because their history was
 * missing; the switch then cost a rebuild. Which chain a wallet sees is not something
 * to guess. Nor can the default be made smarter by id: Retropex's BLAKE2b package takes
 * the official `bitcoind` id, so the same default is SHA256 on one server and BLAKE2b
 * on another.
 *
 * So, never guess when there is a choice:
 *
 *   - exactly one supported node installed: select it. There is nothing to ask, and it
 *     fixes the case where the only node present is the BLAKE2b companion while the
 *     default names a `bitcoind` that is not there;
 *   - several, or none yet: a critical task, which keeps the service stopped until the
 *     operator picks one.
 *
 * Install only. An update keeps the choice already made, and a restore brings its own.
 */
export const chooseBackend = sdk.setupOnInit(async (effects, kind) => {
  if (kind !== 'install') return

  const installed: BackendId[] = []
  for (const id of backendIds) {
    const { rpcHostId, rpcPort } = backends[id].endpoints
    // A null bridge means the package is not installed, the same test `main` uses to find
    // a helper node. Read once: this is a decision made at install, not a value to follow.
    const rpc = await sdk.host
      .getBridgeAddress(effects, {
        packageId: id,
        hostId: rpcHostId,
        internalPort: rpcPort,
        ssl: false,
      })
      .once()
      .catch(() => null)
    if (rpc) installed.push(id)
  }

  if (installed.length === 1) {
    await storeJson.merge(effects, { backend: installed[0] })
    return
  }

  await sdk.action.createOwnTask(effects, selectBackend, 'critical', {
    reason: i18n(
      'Choose which Bitcoin node Electrs should index. It decides which chain your wallets see, so it is not guessed.',
    ),
  })
})
