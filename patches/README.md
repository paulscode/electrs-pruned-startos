# Carried patches

Deltas applied to the `electrs` submodule at build time, in filename order, by the
`patch -p1 --fuzz=0` step in the [Dockerfile](../Dockerfile). `--fuzz=0` is deliberate: after a
submodule bump a patch whose context has changed must fail the build, not apply anyway with the
mismatch ignored.

Each patch here is a liability — it forks the shipped binary from the upstream tag the submodule
names, and every electrs bump has to re-validate it. Add one only when the alternative is shipping
a known defect, and record below what retires it.

`0002` and `0003` are the reason this package exists, so unlike the others they are not waiting to
be retired — they are waiting to be upstreamed. Both are inert on an archival node.

**Not carried yet: the BLAKE2b header-v2 type.** [pruned-electrs](https://github.com/paulscode/pruned-electrs)
carries it as its `patches/0003`, but it is dead code — it adds `HeaderV2`, `AnyHeader` and a
`blake2b_simd` dependency, and nothing calls them. Carrying it here would grow the image and force a
rebuild for no behaviour change. It belongs in this package when the substitution across
`chain`/`index`/`status`/`electrum` lands and the package can actually index a v2 chain. **Add both
together, or neither.**

Numbering differs between the two repos: `pruned-electrs` numbers from its own first patch, this
package prepends the inherited `0001`. So `pruned-electrs` 0001 and 0002 are this package's 0002 and
0003.

## 0001 — bound client writes so a wedged peer cannot stall the server

Inherited unchanged from `Start9-Community/electrs-startos`. Sets a 60s `SO_SNDTIMEO` on accepted
client sockets, so a client that stops draining its receive window cannot hold the single `serve()`
loop — which also runs `rpc.sync()` — for as long as the kernel keeps retransmitting.

**Retire when:** upstream sets a write timeout (or makes the response write non-blocking) and the
submodule is bumped past it. Tracked at
[romanz/electrs#1326](https://github.com/romanz/electrs/issues/1326);
[#745](https://github.com/romanz/electrs/issues/745) is the same defect reported in 2022. Neither
`v0.11.1` nor `master` sets a timeout as of 2026-08.

## 0002 — route blocks below bitcoind's prune height to RPC

Upstream refuses to start against a pruned node. Removing that guard alone does not help: bitcoind
answers a `getdata` for a pruned block with *silence* — no block, no `notfound`, no disconnect — and
`Connection::for_blocks` consumes replies positionally on an untimed blocking `recv`, so electrs
hangs forever on the first batch. A batch straddling the prune height is worse: replies shift out of
position and it dies with `got unexpected block`.

There is therefore no error to detect and no fallback to trigger. The routing is decided *before*
asking, from `getblockchaininfo.pruneheight`, which is exact: bitcoind serves every block at or above
it and none below. Pruned runs go to `getblock <hash> 0` — the verbosity btc-rpc-proxy intercepts and
satisfies from peers.

Archival nodes take an early return on `!pruned` and are byte-for-byte upstream.

**Retire when:** upstream gains a pruned-node block source. Not proposed upstream yet.

## 0003 — retry pruned-block RPCs, with separate budgets per caller

On a pruned node the block source is a separate process that restarts when its own dependency
updates, and individual peer fetches fail transiently — a stale pooled peer connection is enough.
Any of that took indexing down, because the error propagates out of `Index::sync` and ends the
process.

Retries with exponential backoff. The budget differs by caller and that distinction is load-bearing:
`handle_events` and `rpc.sync()` share one thread, so a query that waits freezes indexing and every
other client. An intermediate version used one 300s budget everywhere and a single query against a
downed proxy froze the whole server for five minutes. Indexing waits 300s, serving waits 10s.

**Retire when:** 0002 is upstreamed, since this is a fix to it rather than to upstream.

## Verifying after a submodule bump

The pruning behaviour is covered by the regtest harness in the
[pruned-electrs](https://github.com/paulscode/pruned-electrs) repo — `spikes/harness/setup.sh up`,
then `query.py` and `failure_modes.sh`. Run both after any bump; `--fuzz=0` catches context drift,
but only tests catch behavioural drift.
