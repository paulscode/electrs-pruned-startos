# Carried patches

Deltas applied to the `electrs` submodule at build time, in filename order, by the
`patch -p1 --fuzz=0` step in the [Dockerfile](../Dockerfile). `--fuzz=0` is deliberate: after a
submodule bump a patch whose context has changed must fail the build, not apply anyway with the
mismatch ignored.

Each patch here is a liability — it forks the shipped binary from the upstream tag the submodule
names, and every electrs bump has to re-validate it. Add one only when the alternative is shipping
a known defect, and record below what retires it.

`0001` and `0002` are the reason this package exists, so unlike the others they are not waiting to
be retired — they are waiting to be upstreamed. Both are inert on an archival node.

`0003` through `0006` are the BLAKE2b header-v2 support, and they are not waiting to be retired
either. They are what lets this package index a chain whose blocks have 164-byte headers and BLAKE2b
identity. Inert on a SHA256d chain: `AnyHeader::parse` reads the header's own version field, and on a
chain that never sets bit 31 every path is the v1 one.

**These files are generated, not edited.** They come from `git format-patch` over the commits in the
`electrs-pruned` repo's `vendor/electrs`, which is the single source for this fork. Edit there, run the
regtest harness there, regenerate, and copy the result here.

That arrangement replaces one where each repo kept its own hand-maintained set at its own numbering.
They drifted in both directions and neither was a superset: the write-timeout patch existed only here,
while protocol 1.8 and the concurrent pruned fetch existed only in `vendor/electrs`. The shipped binary
was therefore missing `blake2b_fork` from `server.features` for weeks without anything failing, because
nothing exercised it until a client checked. Generating the set from one tree is what stops that
recurring: the code the harness tests and the code that ships are the same code.

## 0001 — route blocks below bitcoind's prune height to RPC

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

## 0002 — retry pruned-block RPCs, with separate budgets per caller

On a pruned node the block source is a separate process that restarts when its own dependency
updates, and individual peer fetches fail transiently — a stale pooled peer connection is enough.
Any of that took indexing down, because the error propagates out of `Index::sync` and ends the
process.

Retries with exponential backoff. The budget differs by caller and that distinction is load-bearing:
`handle_events` and `rpc.sync()` share one thread, so a query that waits freezes indexing and every
other client. An intermediate version used one 300s budget everywhere and a single query against a
downed proxy froze the whole server for five minutes. Indexing waits 300s, serving waits 10s.

**Retire when:** 0002 is upstreamed, since this is a fix to it rather than to upstream.

## 0003 — the BLAKE2b 164-byte header type and its hash

A self-contained `HeaderV2` plus an `AnyHeader` union, with the staged BLAKE2b block hash. Tested
against two independent oracles: the five vectors Knots publishes in `block_header_v2.json`, checked
stage by stage, and four headers taken off live testnet4. Adds one dependency, `blake2b_simd`.

**Retire when:** `rust-bitcoin` gains the format. It cannot be extended from outside: `block::Header`
is a fixed six-field struct.

## 0004 — wire it through chain, db, index, p2p, status and tracker

The substitution. Also replaces `bsl::Block::visit` on the block path, because `bitcoin_slices` reads
the transaction-count varint from a hardcoded offset 80 and on a 164-byte header that lands inside
`m_nonce2`. It does not reliably error: on our fixture it reads a count of zero, returns `Ok` and
visits nothing, so a four-transaction block indexes as empty with nothing logged anywhere.
`headerv2::visit_block_txs` reimplements the few lines that assume the offset using that crate's own
public `scan_len` and `Transaction`, so no fork was needed and the transaction parsing is unchanged.

**Retire when:** `bitcoin_slices` learns variable-length headers.

> [!WARNING]
> **That condition will not be met, and this patch needs rewriting at the next release rather than re-applying.** Upstream `master` has replaced `bitcoin_slices` with [`bindex`](https://crates.io/crates/bindex) (romanz/electrs `0fe14fdf`, "Switch to `bindex`"): `Cargo.toml` on `master` carries `bindex = "0.1.2"` where v0.11.1 carries `bitcoin_slices = "0.10.0"`. `headerv2::visit_block_txs` reimplements `bsl::Block::visit` against that crate's `scan_len` and `Transaction`, so it has nothing to attach to once the dependency is gone. Nothing is released yet — v0.11.1 (2026-02-22) is still the latest tag and `master` is 27 commits past it — so this is a heads-up for the next submodule bump, not a present problem. Checked 2026-09-04.

## 0005 — a test recording that rust-bitcoin cannot decode a v2 block

No behaviour change. It pins the assumption the other two rest on, and documents why
`btc-rpc-proxy` cannot serve a pruned v2 block: the proxy decodes peer blocks with `rust-bitcoin`'s
`Block` and checks a SHA256d `block_hash()`.

**Retire when:** 0004 is retired.

## 0006 — Electrum protocol 1.8 on a chain with v2 headers

The server half of `docs/electrum-header-v2.md`. Negotiates protocol 1.8, returns
`blockchain.block.headers` in the list form that can carry variable-length headers, and reports the
fork point in `server.features` as `blake2b_fork`.

That last field is chain identity, and it is not decoration: this chain and the one it forked from share
a genesis block, so `genesis_hash` cannot tell a client which it has reached. A client that checks it —
Sparrow (BLAKE2b) refuses a server that does not report it — cannot otherwise distinguish a server on
the other chain from this one.

**Retire when:** the proposal is adopted upstream, or the fork is abandoned.

## 0007 — bound client writes so a wedged peer cannot stall the server

Inherited unchanged from `Start9-Community/electrs-startos`. Sets a 60s `SO_SNDTIMEO` on accepted
client sockets, so a client that stops draining its receive window cannot hold the single `serve()`
loop — which also runs `rpc.sync()` — for as long as the kernel keeps retransmitting.

**Retire when:** upstream sets a write timeout (or makes the response write non-blocking) and the
submodule is bumped past it. Tracked at
[romanz/electrs#1326](https://github.com/romanz/electrs/issues/1326);
[#745](https://github.com/romanz/electrs/issues/745) is the same defect reported in 2022. Neither
`v0.11.1` nor `master` sets a timeout as of 2026-08.

## Verifying after a submodule bump

The pruning behaviour is covered by the regtest harness in the
[electrs-pruned](https://github.com/paulscode/electrs-pruned) repo — `spikes/harness/setup.sh up`,
then `query.py` and `failure_modes.sh`. Run both after any bump; `--fuzz=0` catches context drift,
but only tests catch behavioural drift.
