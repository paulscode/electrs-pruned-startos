import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

export const shape = z.object({
  // Stripped: electrs exits if auth and cookie_file are both set
  auth: z.undefined().catch(undefined),
  // Where the selected backend writes its RPC cookie. Not a literal, because
  // bitcoind keeps a non-mainnet chain's data, cookie included, in a
  // subdirectory named for that chain: the official package is mainnet and puts
  // it at the datadir root, while `knots-blake2b` runs regtest or testnet4 and
  // puts it under `/mnt/bitcoind/regtest/` or `/mnt/bitcoind/testnet4/`.
  // main.ts derives this from the backend's own config; see `backendChain`.
  cookie_file: z.string().catch('/mnt/bitcoind/.cookie'),
  // Dynamic: main.ts writes bitcoind's LXC-bridge host:port at startup (see
  // bitcoindBridge in utils.ts). Optional and absent while bitcoind is
  // unresolved — main omits the field rather than writing a placeholder, and
  // the reactive .const() write lands the real address once bitcoind appears.
  daemon_rpc_addr: z.string().optional().catch(undefined),

  // A second node to read pruned blocks from, and the cookie for it. Optional and written together
  // or not at all: electrs ignores a half-set pair, and omitting both is what every single-node
  // install does. Absent rather than empty, like the addresses above, so an unresolved dependency
  // leaves no stale value behind.
  helper_rpc_addr: z.string().optional().catch(undefined),
  helper_cookie_file: z.string().optional().catch(undefined),
  daemon_p2p_addr: z.string().optional().catch(undefined),
  // Which chain to index. Was a literal 'bitcoin', which is right for the
  // official package and its two mainnet forks and wrong for `knots-blake2b`:
  // electrs would come up on mainnet magic bytes and never agree with the node.
  // main.ts derives it from the backend's own config.
  network: z
    .enum(['bitcoin', 'testnet', 'testnet4', 'signet', 'regtest'])
    .catch('bitcoin'),
  electrum_rpc_addr: z.literal('0.0.0.0:50001').catch('0.0.0.0:50001'),
  log_filters: z
    .enum(['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'])
    .catch('INFO'),
  index_batch_size: z.number().int().optional().catch(undefined),
  index_lookup_limit: z.number().int().optional().catch(undefined),
})

export const tomlFile = FileHelper.toml(
  {
    base: sdk.volumes.main,
    subpath: 'electrs.toml',
  },
  shape,
)
