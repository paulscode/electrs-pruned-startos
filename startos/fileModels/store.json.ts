import { FileHelper, z } from '@start9labs/start-sdk'
import { BackendId, backendIds, defaultBackend } from '../backends'
import { sdk } from '../sdk'

export const storeJson = FileHelper.json(
  {
    base: sdk.volumes.main,
    subpath: '/store.json',
  },
  z.object({
    syncNotified: z.boolean().catch(false),
    everSynced: z.boolean().catch(false),
    /**
     * Which bitcoind flavor to index. Read by `dependencies.ts` to decide which
     * optional dependency becomes required, and by `main.ts` to decide which
     * volume to mount and whose bridge addresses to resolve.
     *
     * `.catch()` rather than a bare default so a hand-edited or stale value
     * repairs to the official service instead of leaving the package with no
     * resolvable backend.
     */
    backend: z.enum(backendIds as [BackendId, ...BackendId[]]).catch(defaultBackend),
    /**
     * The backend the current index was built against. Compared with `backend`
     * at startup: a mismatch means the index describes a different chain, so it
     * is wiped rather than reorganised. See init/backendGuard.ts.
     */
    indexedBackend: z.enum(backendIds as [BackendId, ...BackendId[]]).optional().catch(undefined),
  }),
)
