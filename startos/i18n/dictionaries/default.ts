export const DEFAULT_LANG = 'en_US'

const dict = {
  'Starting Electrs!': 0,
  'Electrum Server': 1,
  'Electrum server is ready and accepting connections': 2,
  'Electrum server is starting': 3,
  'Sync Progress': 4,
  'Electrs requires an archival bitcoin node.': 7,
  'Log Level': 8,
  'Select the level of log verbosity. Less is usually better.': 9,
  'Index Batch Size': 10,
  'Maximum number of blocks to request from bitcoind per batch.': 11,
  blocks: 12,
  'Index Lookup Limit': 13,
  'Number of transactions to lookup before returning an error, to prevent \'too popular\' addresses from causing the RPC server to time out. Enter \'0\' for no limit.': 14,
  transactions: 15,
  Configure: 16,
  'Customize your electrs Electrum server': 17,
  Error: 18,
  Warning: 19,
  Info: 20,
  Debug: 21,
  Trace: 22,
  'Electrs is building its address index. This can take several hours on first run.': 25,
  'Fully synced': 26,
  Default: 27,
  'no limit': 28,
  'Sync Complete': 29,
  'Electrs has finished building its address index. The Electrum server is ready.': 30,
  'Electrs is not responding. It is likely busy indexing; this usually clears on its own.': 31,
  'Electrum (SSL)': 32,
  'The Electrum protocol endpoint, served over SSL': 33,
  'Bitcoin Service': 34,
  'Which Bitcoin service to index. Choose the one whose chain you want this Electrum server to serve.': 35,
  'Select Bitcoin Service': 36,
  'Choose which installed Bitcoin service this Electrum server indexes.': 37,
  'Changing the Bitcoin service discards the address index and rebuilds it from scratch. The two services follow different chains, so the existing index does not describe the new one. Rebuilding can take hours, and considerably longer against a node that has already pruned the blocks being indexed.': 38,
  'The official Bitcoin service, whichever flavor is installed: Knots, Core, or a BLAKE2b build sideloaded over either.': 39,
  'A second node following the chain most hashpower follows, installed alongside your main Bitcoin service.': 40,
  'A second node following the BIP-110 (RDTS) chain, installed alongside your main Bitcoin service.': 41,
  'A node on the BLAKE2b chain, whose blocks use a different proof of work and a longer header.': 42,
  'Electrs is building its address index: ${percent}%, block ${indexed} of ${total}. This can take several hours on first run.': 43,
  'Electrs is not responding. It is likely busy indexing, at block ${indexed} of ${total} (${percent}%). This usually clears on its own.': 44,
  'Electrs is not running. It exited and is being restarted; if this persists, check the logs.': 45,
  'A second node on the same chain as your main Bitcoin service, installed alongside it. It never enforces BIP-110, so if the network splits over that rule this one follows the side that does not require it.': 46,
} as const

/**
 * Plumbing. DO NOT EDIT.
 *
 * Maintained by scripts/gen-i18n-dict.py, which only ever appends: the
 * indices are the join key for translations.ts and renumbering them would
 * silently mistranslate rather than fail.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
