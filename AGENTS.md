# AGENTS.md

This is a StartOS service-package repository — it builds a `.s9pk` for StartOS.

Develop it inside a StartOS packaging workspace created by `start-cli s9pk init-workspace`,
which provides the packaging guide and agent context one level up. If you're reading this in a
bare clone with no workspace, the full guide is at <https://docs.start9.com/packaging>.

**Start every task at the recipe index** — `../start-technologies/projects/start-sdk/docs/src/recipes.md`
(or <https://docs.start9.com/packaging/recipes.html>). It maps an intent ("prompt the user to create
admin credentials", "expose a web UI") to the constructs, the reference pages, and a named production
package to copy. Find the recipe before you read this package's neighbours: a package you reach by
grepping may be non-conformant, and the recipe outranks it.

Freshly scaffolded? Work the
[New Package Checklist](../start-technologies/projects/start-sdk/docs/src/new-package-checklist.md)
(or <https://docs.start9.com/packaging/new-package-checklist.html>) from top to bottom. It is a
guide page, not a file in this repo — read it, don't copy it in.

Keep `README.md` (technical reference for an AI support or administering agent) and
`instructions.md` (end-user docs) in sync with your changes.

**Bugs and feature requests are GitHub issues on this repo** — file them as you find them.
Don't record work in the repo instead: no `TODO.md`, no `NOTES.md`, no `PLAN.md`. What you
verified, tried, and decided belongs in the commit message and the PR body.

## This repo

This package is a fork of [`Start9-Community/electrs-startos`](https://github.com/Start9-Community/electrs-startos)
that **permits Bitcoin to stay pruned**. Everything below the first bullet is inherited from it and
still applies; read the upstream repo's notes too when touching shared code.

- **The whole point is that `dependencies.ts` raises no autoconfig task.** Upstream forces
  `prune: 0` with a `critical` task, because upstream electrs refuses to start against a pruned node.
  Here, `patches/0002` routes blocks below `getblockchaininfo.pruneheight` to `getblock <hash> 0`,
  which btc-rpc-proxy answers from peers. **Do not reintroduce a prune task.** If you find yourself
  wanting one, the bug is elsewhere.
- **`txindex` is not required and must not be requested.** Nothing in electrs's block or transaction
  path reads it.
- **The proxy is not this package's to start.** The bitcoind package puts btc-rpc-proxy on the RPC
  port (8332) exactly when pruning is enabled, and bitcoind itself moves to 58332. So
  `bitcoindBridge`'s `rpcHostId`/8332 resolves to the proxy when pruned and to bitcoind when
  archival, with no change here. That is why no packaging change was needed to reach the proxy.
- **A first index on an already-pruned node is slow, and users must be told.** Blocks below the
  prune height come one at a time over RPC from network peers: measured ~162 ms each on clearnet,
  and substantially worse over Tor. Indexing *alongside* bitcoind's own sync is far faster, because
  blocks are taken over p2p before they are pruned. Keep `instructions.md` honest about this.
- **`blockchain.transaction.get` with `verbose=true` fails for pruned blocks.** Its second leg is
  `getrawtransaction`, which the proxy does not intercept. Known gap, not a regression.
- **This package can index a BLAKE2b chain.** Patches `0004`-`0006` carry the header-v2 support:
  164-byte headers, BLAKE2b block identity, and a replacement for `bsl::Block::visit`, which reads
  the transaction count from a hardcoded offset 80 and silently indexes a v2 block as empty. Select
  `Bitcoin Knots BLAKE2b` as the backend. **Pruning and BLAKE2b do not compose yet**: that flavor
  ships no btc-rpc-proxy, and the proxy could not serve a v2 block anyway, so a pruned node of that
  flavor has nothing to serve the blocks it dropped.
- **Patches 0002 and 0003 have regtest coverage that lives elsewhere** — the harness in
  [paulscode/pruned-electrs](https://github.com/paulscode/pruned-electrs) (`spikes/harness/`). Run
  `query.py` and `failure_modes.sh` there after any submodule bump. `--fuzz=0` catches context drift;
  only those catch behavioural drift.

- **P2P must resolve bitcoind's `peer-local` host, never `peer`.** electrs pulls whole blocks over p2p — for the index, and again for every `blockchain.scripthash.get_history` on a scripthash the client never subscribed to. `peer` maps onto bitcoind's plain `bind`, shared with anonymous inbound peers, where the connection earns no permissions: bitcoind may evict it to seat another peer, or cut it off under `maxuploadtarget`. **electrs does not reconnect p2p** — `p2p_loop` exiting drops `new_block_send` and takes the process down by design — so one drop is a restart, and under a client polling unsubscribed scripthashes it is a restart loop. `peer-local` is a bridge-only binding onto bitcoind's `whitebind` listener, which grants `noban` + `download`. That host is why `dependencies.ts` gates bitcoind on the revision that introduced it.
- **Omit the address rather than defaulting it while bitcoind is unresolved.** The toml fields are `z.string().optional()` precisely so they can be absent until the reactive read heals them in.
- **Don't set `auth` in `electrs.toml`.** electrs exits if `auth` and `cookie_file` are both present; the model pins `auth` to undefined for that reason.
- **The sync check must confirm success positively, and a read timeout must fail the probe.** During an index build electrs services no RPC for minutes at a time (`server.rs`'s `while server_rx.is_empty()`), so a non-answer is the norm — without the `|| exit`, the trailing `printf`'s exit code masks the timeout and an empty reply reads as synced, reporting "Fully synced" all through the build.
- **Don't name a literal external port in docs.** StartOS assigns it and never changes it for an existing binding, so it is per-server — `start-cli package host binding list electrs electrum` reads the live value.
