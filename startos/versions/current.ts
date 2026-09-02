import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

const notes =
  'Stops the Electrum server crash-looping when the node restarts, and stops the ' +
  'health check blaming indexing for it. ' +
  ' ' +
  'The dependency on the node is satisfied when its container is up, which is not ' +
  'the same as the node having written the credentials file this server reads. On a ' +
  'node restart or update there is a window where one is true and the other is not, ' +
  'and the server treated that as fatal and exited. It was restarted, hit the same ' +
  'window, and exited again, so every node restart produced a burst of crashes that ' +
  'cleared only once the timing happened to work out. It now waits for the file ' +
  'before starting, and still reports the error if it never appears. ' +
  ' ' +
  'The Sync Progress check called every failed probe indexing, which is right while ' +
  'an index is building and wrong when the server has exited. It reported "likely ' +
  'busy indexing; this usually clears on its own" throughout a crash loop, which is ' +
  'advice to wait for something that had already died. It now says when the server ' +
  'is not running, so the two cases can be told apart: one is worth waiting out, the ' +
  'other is worth reading the logs over. ' +
  ' ' +
  'No change to the index. Nothing is rebuilt and no reindex is needed.'

export const current = VersionInfo.of({
  version: '0.11.1:36',
  releaseNotes: {
    en_US: notes,
    es_ES: notes,
    de_DE: notes,
    pl_PL: notes,
    fr_FR: notes,
  },
  migrations: {
    // Nothing to migrate. This changes how the daemon is launched and what one
    // health check says; no setting, stored value or on-disk layout changes, and
    // the address index is untouched.
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
