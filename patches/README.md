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

`0008` through `0011` are the archival-block helper and the fixes to it, plus tolerating a node that
no longer reports `difficulty`. `0012` through `0015` are throughput: they exist because a pruned
node's block reads cost seconds rather than milliseconds, and the serving path was built for the
latter. Read them together, and read `0014` before `0015`: `0015` raises a timeout, `0014` reduces
what waiting on it costs, and neither is the whole story on its own.

`0016` is what lets the package keep the index when the operator switches node; see its entry.

`0017` and `0018` are upstream's own protocol fixes from electrs 0.12.0, backported. 0.12 itself is
not an option: it moves indexing to `bindex`, which needs Bitcoin Core 31 and its REST interface, and
rebuilds the index.

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

Retries with exponential backoff, on a budget that differs by caller. An intermediate version used
one 300s budget everywhere, and a single query against a downed proxy froze the whole server for
five minutes, because `handle_events` and `rpc.sync()` shared one thread. Indexing waits 300s.

Serving waited 10s for the same reason, until `0015` raised it to 60s — see that entry for why 10s
had stopped being a trade-off and become a bug. Note that `0014` reduced what waiting costs but did
not remove it: the loop is still held for the length of a batch.

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
client sockets, so a client that stops draining its receive window cannot hold the thread writing
to it for as long as the kernel keeps retransmitting.

Since `0014` that thread is a worker rather than the `serve()` loop itself, but the loop waits for
the worker, so a wedged client still holds up `rpc.sync()` and every client behind it. The reason
for bounding it is unchanged.

**Retire when:** upstream sets a write timeout (or makes the response write non-blocking) and the
submodule is bumped past it. Tracked at
[romanz/electrs#1326](https://github.com/romanz/electrs/issues/1326);
[#745](https://github.com/romanz/electrs/issues/745) is the same defect reported in 2022. Neither
`v0.11.1` nor `master` sets a timeout as of 2026-08.

## 0008 — read pruned blocks from an archival node when one is available

A fork's two chains share every block below the split, so a second full node on the same machine
already holds most of what this pruned node has discarded. Reading one off local disk beats pulling
it off the network by orders of magnitude. Optional: absent unless both `helper_rpc_addr` and
`helper_cookie_file` are given, and refused unless that node verifies as archival.

Deliberately cross-chain, which is the part that looks like a bug and is not. The helper is on the
*other* side of the split, so it must be asked only for heights below it — and the split height is
not configured but learned. The first hash the helper answers "Block not found" (`-5`) for marks
where the chains diverged, and that becomes a ceiling no height at or above is offered to again.
Every answer is checked by hash before it is used, so a wrong-chain block cannot be returned even
before the ceiling settles.

**Retire when:** never, on a forked chain. Inert without the config.

## 0009, 0010 — tolerate a node that reports no `difficulty`

Bitcoin Knots 29.4.2.knots20260508 (knots#420) stopped reporting `difficulty` for header-v2 blocks,
on the grounds that a BLAKE2b difficulty and a SHA256d one are different units, and deleted the
`getdifficulty` RPC. On a BLAKE2b chain every block above 961640 is header-v2, so the field is
simply absent.

electrs never reads it. It broke anyway: `bitcoincore-rpc-json` declares `difficulty` a required
`f64` on `GetBlockchainInfoResult`, `GetBlockResult` and `GetBlockHeaderResult`, so serde failed the
whole response. `0009` covers `getblockchaininfo`, which surfaced as a crash loop reporting "daemon
not available"; `0010` covers `getblock` and `getblockheader`, which are on the indexing path and so
stalled rather than crashed. Both replace the crate's struct with one naming only the fields this
indexer actually uses, ignoring the rest.

The lesson is in which search finds this: "what deserializes a Knots RPC response", not "what reads
`difficulty`". Grepping this tree for the field name finds nothing, because the requirement is in a
dependency. Parts 2 and 3 of the maturity fork land Oct 2026 and Aug 2027; re-run the deserializer
sweep then.

**Retire when:** `bitcoincore-rpc` makes these fields optional, or the submodule stops using it.

## 0011 — make the helper ceiling monotone, and read the RPC code

Two fixes to `0008`. The ceiling was set with `swap`, so a later, higher "not found" could raise it
back above the split and reopen wrong-chain lookups; `fetch_min` makes it only ever descend. And
"has this chain diverged here" was decided by matching the string "Block not found", which a
reworded message upstream would silently turn into "never diverged" — now read from the RPC code
(`-5`) in the error's source chain, with the string kept only as a fallback.

`-5` is distinguished from `-1` ("Block not available (pruned data)") deliberately: the second means
the node has the block and discarded the data, which is a different thing and must not move the
ceiling.

**Retire when:** with `0008`.

## 0012 — hold a pool of RPC connections rather than one

`jsonrpc`'s `SimpleHttpTransport` keeps a single socket behind a mutex, so every RPC through one
`Client` serialises however many threads call it. On a pruned node each call can be a multi-second
block fetch, so that mutex was the ceiling on everything else here. Four connections, handed out one
at a time and returned on drop.

Four rather than more because on a pruned node each slot becomes peer connections opened by the
proxy, and a node has only so many peers worth asking.

**Retire when:** `jsonrpc` gains a connection pool of its own.

## 0013 — fetch pruned blocks through a sliding window

Every block on this path is one the node has discarded, so each is a round trip to the helper or a
peer fetch through the proxy measured in seconds. Fetched one after another, a wallet whose history
reaches back past the prune height paid that per block. Now several are kept in flight, bounded by
`0012`'s pool, and delivered in request order as each completes.

**A window, not fixed batches, and that is the whole of it.** This was first written as chunks
joined before the next chunk began, and that version was deployed and reverted for indexing *slower*
than fetching serially: 571-601s per 2000-block batch against ~488s. At a barrier one slow fetch —
or one retry, which backs off a whole second — leaves every other worker idle until the slowest item
in the chunk lands, so a batch costs its worst member rather than its average. That attempt also
predated `0012`, so its concurrency was not real: `jsonrpc` holds one socket behind a mutex and
serialised the fetches it thought it was running in parallel. It paid the barrier and bought
nothing. If this is ever rewritten, keep N in flight and deliver in order as they complete.

Delivery is otherwise unchanged: one block at a time, in request order, and a failure still ends the
run at the first error in that order. The window bounds memory, which matters when blocks are
megabytes and an indexing run is thousands of them.

The window is `pipeline`, separate from the block fetching so it can be tested alone. One of its
tests is a liveness check that work continues past an item still outstanding; it fails against the
batching implementation, which is why it is there.

**Retire when:** upstream fetches concurrently.

## 0014 — answer a batch of clients together

`handle_events` walked its batch one client after another, so the batch cost the *sum* of its
clients and one request reaching for a pruned block made every other client in the batch wait for it
in turn. Split into three phases: connects and disconnects stay serial because they mutate the peer
map, answering runs across clients in parallel, survivors go back in the map serially. That is the
same split `notify_peers` upstream has always used. A batch now costs its slowest client.

> [!IMPORTANT]
> **This does not take the work off the server loop.** `serve()` still calls `handle_events` inline
> between calls to `rpc.sync()`, and does not drain `server_rx` again until it returns. So a slow
> batch still stalls indexing for its duration, and a request arriving once a batch is under way
> still waits for that batch to end. Only the cost *within* a batch is addressed. That is why
> `0015` raising the serving budget to 60s raises the worst-case indexing stall with it, which is
> a deliberate trade and not an oversight. Moving this work onto its own thread is the remaining
> piece and is not attempted here.

Per client nothing changes: its requests are answered in one batch, in arrival order, and a
disconnect still discards whatever was queued behind it.

`0007`'s write timeout still matters for the reason it always did. A wedged peer holds a worker
rather than the loop directly, but the loop waits for that worker, so it holds up everything behind
it either way.

**Retire when:** upstream stops serving clients from the sync loop.

## 0015 — ration time spent retrying, not wall clock

The serving allowance from `0002` was 10s against a default `jsonrpc_timeout` of 15s, and it was
measured from the start of the call — so it was already spent by the time the opening attempt could
fail, and every failure gave up without retrying. A no-retry policy that did not look like one.
Underneath that, electrs stopped waiting at 15s while the proxy keeps working on the block until its
own `peer_timeout`, 30s by default, and caches the result — so the fetch being abandoned was often
one the proxy went on to complete.

Raised to 60s, which spans several attempts and keeps trying past that 30s, so a later attempt finds
the block already cached.

**What is rationed is time spent retrying, measured from the first failure.** Getting this wrong is
easy and both wrong answers were tried:

- *A fresh allowance per call* lets a run spend it again at every stage. A run is several RPCs —
  prune height, every height, then each block — so a source that recovers just long enough to get
  past one stage can burn the allowance again at the next.
- *One deadline from the start of the run* charges time spent **succeeding**. A query that had been
  fetching happily for longer than the allowance hit its first transient error already past the
  deadline and gave up with no retry at all. On a deep history over Tor, running longer than the
  allowance is ordinary, so this turned a stale peer connection into precisely the "failed to fetch
  history" the patch exists to remove. A slow query is not a failing query.

So the run shares one allowance and only failures are charged to it. A run that is merely slow has
spent nothing. Indexing keeps a fresh allowance per call, where it is there to ride out a restart
rather than bound a wait and a 2000-block Tor batch outlasts anything worth setting. Concurrent
fetchers each charge their own retrying, so the total charged can exceed the allowance while several
are in flight — intended, since they retry at the same time and the wall clock is still about one
allowance.

What that costs is stated rather than waved away. `0014` makes a batch cost its slowest client
instead of the sum, but `handle_events` still runs inline on the loop that drives `rpc.sync()`, so
going from 10s to 60s raises the worst-case indexing stall to match — for a *failing* query. One
that is succeeding holds the loop for as long as it takes, and always has. The trade is deliberate: the
stall is bounded, nothing is lost because indexing resumes where it was, and it only happens when
fetches are genuinely failing. Against that, the 10s bought a wallet that could not load its history
at all.

A retry is also meant to be nearly free, because btc-rpc-proxy collapses concurrent requests for the
same block and a retry therefore joins the fetch already in flight rather than starting a second
one. **That part is not in a published proxy image yet** — it ships with the next one. Against an
older proxy this patch is still correct and still fixes the reported failure; a retry just costs a
duplicate fetch instead of joining one.

**Retire when:** with `0002`.

## 0016 — reconcile the loaded chain with the node before serving

What makes it safe for **Select Node** to keep the index across a switch instead of wiping it. At
startup, before the server loop handles anything, the index tip is checked against the node: one
`getblockhash` in the usual case, and if the node's active chain does not contain it, a binary search
(about twenty calls on mainnet) for the highest height both agree on, and the header chain is trimmed
back to there. Sound because agreement is monotone: a block hash commits to its ancestors, so two
chains that diverge never agree again, and a shorter node agrees with nothing above its tip.

**Where it matters, precisely.** For two independently synced nodes on different chains, plain
`getheaders` already finds the fork, because neither node knows the other's post-split blocks and
skips them in electrs's locator. There this only adds precision: the locator thins out exponentially,
so the node's answer overshoots the split by up to its depth again, and this lands on it exactly. The
case it is needed for is a node that *knows* the indexed tip, has it off its active chain, and has it
descending from its own tip, which is what `invalidateblock` leaves, the usual way an operator picks
a side of a fork. Core answers that locator with nothing. Without this, electrs keeps the rejected
chain, advertises its tip to wallets, and the first query needing one of those blocks asks the node
for it: the node stays silent and electrs hangs, or drops the connection and electrs exits, then
reloads the same chain on restart.

I first described the hazard more broadly, as any switch to a node that is behind the fork, and the
regtest run corrected me. The entry says only what the run showed.

Rows written for discarded blocks stay in the database, as they do for every electrs reorg: rows are
keyed by height, and a lookup scans this chain's block at that height, so a leftover row costs a
wasted scan and never a wrong answer. Nothing is persisted; until indexing writes a new tip, a restart
reloads the old chain and trims it again.

**Retire when:** upstream reconciles with the node at startup. Not proposed upstream yet.

## 0017 — fix the `server.features` host map

Upstream 414dc90. `hosts` in a `server.features` reply is a dictionary keyed by host name, each value
holding that host's ports. electrs sent `{"tcp_port": 50001}`, which is not a host map at all, and a
client that parses the reply strictly refuses the whole thing. Now keyed by the address electrs binds,
as upstream does. The `blake2b_fork` field this fork adds is unaffected.

**Retire when:** the submodule moves to a release that has it, which is 0.12.0 or later.

## 0018 — accept `transaction.id_from_pos` without `merkle`

Upstream 1222d36. The protocol makes `merkle` optional, defaulting to false, and electrs refused a
call that left it out. It also answers `merkle: false` with a bare transaction hash, as the protocol
specifies, where it used to wrap the hash in an object. The block lookup stays on this fork's chain
rather than 0.12's header iterator.

**Retire when:** as `0017`.

## 0019 — advertise `NODE_BLAKE2B` when the node does

Bitcoin Knots 29.4.3 hides every block past the chain split from a peer that does not advertise
`NODE_BLAKE2B` (`1 << 28`; knots 18430434ab, "Hide (approaching) BLAKE2b blocks from stale peers"):
headers and blocks stop at 961631, the last block both chains share. Whitelist permissions do not
exempt a peer; the check reads only the services the peer advertised. electrs advertised none, so
against a 29.4.3 BLAKE2b node it stopped indexing at the first block it lacked while its RPC side kept
answering. Found on the test server the moment its node moved to 29.4.3: the node had received 72 KB
of requests from electrs and sent back 2 KB.

electrs now reads the node's own `localservices` from `getnetworkinfo`, which it already calls at
startup, and advertises `NODE_BLAKE2B` exactly when the node does. A SHA256 node advertises no such
bit and sees `NONE`, as before, so nothing changes there.

**Retire when:** never, while this fork indexes a BLAKE2b chain; upstream electrs has no BLAKE2b.

## What has tests, and what does not

Each patch carries its own, and every patch in the set builds and passes standalone — 50 tests at
`0012`, 55 at `0013`, 60 at `0014`, 68 at `0015`, 74 at `0016`, 75 at `0017`, 77 at `0018`, 79 at `0019`. The ones worth knowing about:

| area | covered by |
| --- | --- |
| connection pool | hands each connection out once, blocks when all are busy, takes one back after an error |
| fetch window | in order and bounded in flight, first error in request order wins, **work continues past an item still outstanding**, every run length × every concurrency, a `deliver` error ends the run |
| serving a batch | request order kept, a disconnect discards what is behind it, a new connection is picked up with its requests, and the full truth table for what becomes of a peer afterwards |
| retry loop | a transient failure is retried at all, a clean call costs nothing, a spent allowance gives up at once, an interrupt mid-backoff stops the loop |
| retry allowance | a long *working* run keeps its allowance, retrying is charged across the run, indexing does not carry a charge between calls, the allowance outlasts a stalled fetch |
| reconcile with the node (`0016`) | the tip fast path costs one call, a switch lands on the last shared block, a node behind the index lands on its tip, genesis-only, every boundary for every tip up to 69, a failed call is an error rather than a disagreement |
| protocol replies (`0017`, `0018`) | the host map's shape for IPv4 and IPv6 binds and never the flat form; `id_from_pos` with and without `merkle`, malformed arities refused, both accepted by the dispatcher |

Two of those are there specifically because the obvious implementation was wrong and shipped once
before: *work continues past an item still outstanding* fails against the batch-and-wait fetch, and
*a long working run keeps its allowance* fails against a deadline measured from the start of the
run. Both were confirmed to fail against those implementations, not assumed to.

Every test above was checked by mutation — break the thing, watch the right test catch it — rather
than trusted because it passes.

**End to end, `0016` is also driven against real nodes.** `spikes/harness/chain_switch.py` in the
electrs-pruned repo builds two regtest nodes that share 150 blocks and then diverge, and switches one
index between them: across the fork, back again, onto a node that has invalidated a block below the
fork, and after it reconsiders. 13/13 checks with `0016`. Against a build without it, the same run
shows the rejected tip advertised and the next history query hanging the server. Run it after any
change to how the index loads or syncs.

**What is not covered here.** `fetch_block_raw` in btc-rpc-proxy needs an RPC client, peers and real
I/O, so the single-flight integration is exercised by the regtest harness rather than by unit tests;
`SingleFlight` itself is tested in isolation. Nothing in this set is covered against a live pruned
node except by the harness below.

## Verifying after a submodule bump

The pruning behaviour is covered by the regtest harness in the
[electrs-pruned](https://github.com/paulscode/electrs-pruned) repo — `spikes/harness/setup.sh up`,
then `query.py` and `failure_modes.sh`. Run both after any bump; `--fuzz=0` catches context drift,
but only tests catch behavioural drift.
