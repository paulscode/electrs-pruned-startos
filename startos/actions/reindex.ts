import { writeFile } from 'fs/promises'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { reindexRequest } from '../utils'

/**
 * Delete the address index so electrs builds it again: the in-place replacement for uninstalling
 * and reinstalling. Ported from upstream electrs-startos (0d14817).
 *
 * The action only leaves a marker. `main` does the delete before electrs starts, so the index is
 * never removed from under a running process, and an interrupted delete repeats on the next start.
 * Only the current network's index goes, and the node selection is kept; see the block in main.ts.
 *
 * The status handling is upstream's, unchanged: while the service is starting it waits for the
 * start to complete, because a single restart requested mid-start is dropped.
 */
export const reindex = sdk.Action.withoutInput(
  'reindex',

  async () => ({
    name: i18n('Reindex'),
    description: i18n(
      'Delete the address index and build it again from Bitcoin. Use this only if the index is corrupted: Electrs keeps crashing and its logs show a database error such as "Corruption". A slow or busy index is not a reason to reindex, and neither is switching node, since Select Node keeps the index.',
    ),
    warning: i18n(
      'Electrs and every service that uses it are unavailable until the index is rebuilt, which takes as long as a first index: hours if Bitcoin still holds the blocks, and a day or more if Bitcoin has pruned them and they have to be fetched from the network again. If the logs show input/output errors, check your drive first: a rebuild on a failing drive fails the same way.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  async ({ effects }) => {
    await writeFile(reindexRequest, '')

    let status = await sdk.getStatus(effects).once()
    for (
      let i = 0;
      i < 60 && status?.desired.main === 'running' && !status.started;
      i++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1_000))
      status = await sdk.getStatus(effects).once()
    }

    if (
      status?.desired.main === 'running' ||
      status?.desired.main === 'restarting'
    ) {
      await sdk.restart(effects)
      // A single restart requested mid-start is dropped; a second one is kept.
      if (!status.started) await sdk.restart(effects)
      return {
        version: '1',
        title: i18n('Reindex'),
        message: i18n(
          'Electrs is restarting. It deletes its index and builds it again from Bitcoin, which takes as long as a first index.',
        ),
        result: null,
      }
    }

    return {
      version: '1',
      title: i18n('Reindex'),
      message: i18n(
        'Electrs deletes its index and builds it again from Bitcoin the next time it starts.',
      ),
      result: null,
    }
  },
)
