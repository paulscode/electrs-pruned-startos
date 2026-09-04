# Electrs Pruned

An Electrum server that works with a **pruned** Bitcoin node, so you do not need a full copy of the blockchain on disk.

This is a fork of the standard Electrs package. The difference is the whole point: standard Electrs requires an archival Bitcoin node and will force pruning off. This one permits pruning. Blocks that Bitcoin has already discarded are fetched on demand from the Bitcoin network through the RPC proxy your Bitcoin service already runs whenever pruning is enabled — verified against the block hash before use, so nothing is trusted just because it came from a peer.

An archival node still works normally. Nothing changes for you if you are not pruning.

**Read "How long the first index takes" below before you install** — it is the one thing that will surprise you.

## Documentation

- [Start9 Bitcoin Guides](https://docs.start9.com/bitcoin-guides/) — pointing a wallet at your own Electrum server — certificates, SSL and Tor — which wallets work, and archival versus pruned Bitcoin nodes.
- [Electrs upstream README](https://github.com/romanz/electrs/blob/master/README.md) — the upstream project's documentation, including configuration reference and protocol notes.

## What you get on StartOS

- An **Electrum protocol server** that indexes the Bitcoin blockchain and answers wallet queries.
- An **Electrum (SSL)** interface exposing the Electrum protocol, reachable over LAN, `.local`, Tor, and any custom domains you've configured. Every address StartOS shows for it is an `ssl://` one — StartOS terminates TLS with the device's certificate — so your wallet needs SSL turned on.
- Automatic wiring to your StartOS Bitcoin node — RPC, P2P, and cookie authentication are all configured for you. You do not point Electrs at Bitcoin yourself.
- A RocksDB address index stored under the `main` volume (excluded from backups; it rebuilds itself if you restore).

## Getting set up

1. Install **Bitcoin** first if it isn't already installed. Pruning may be on or off; both work.
2. Start Electrs Pruned. On first run it will report **Electrum server is starting** until it has bound its port, and it will not begin indexing until your Bitcoin node has completed its initial block download.
3. Once Bitcoin is fully synced, it will switch to **building its address index**, and **Sync Progress** will show how far it has got: a percentage, and the block it has reached out of your node's height. Those figures keep moving during the build, so you can tell progress from a stall without reading the logs.
4. When the **Sync Progress** health check reports **Fully synced**, point your wallet at the **Electrum (SSL)** interface — copy the address from the **Interfaces** page rather than typing a port from memory.

## How long the first index takes

This depends enormously on **when** you install it, and the difference is hours against days.

- **Best case — install before or during Bitcoin's own sync.** Blocks are indexed as Bitcoin validates them, over its fast local connection, before pruning ever discards them. This costs little more than a normal Electrs index.
- **Worst case — install onto a node that has been pruned for a long time.** Every block below the prune point has to be re-fetched one at a time from the Bitcoin network. Measured at roughly 160 ms per block over a normal internet connection, that is on the order of **a day or more** for the full chain, and considerably longer if your Bitcoin node is configured for Tor only.

Either way it happens once, and it survives restarts — if it is interrupted it resumes where it left off rather than starting over. But if you are setting up a new node and know you will want an Electrum server, install this one early.

Once that first **Fully synced** appears, the index is built and is never rebuilt. If **Sync Progress** later reports that Electrs is not responding and is likely busy indexing, that is a busy moment — Electrs answers wallet queries only between indexing batches — and it clears by itself, normally within a minute or two. It does not mean the index is being rebuilt, and it is not a reason to reindex.

## What running against a pruned node costs you

Nothing here is free, and one cost is worth stating plainly because it is the reason upstream Electrs
does not offer this.

To index a chain your node no longer stores, blocks are fetched from the Bitcoin peer-to-peer
network. A peer that serves you a block learns that you wanted it. During the first index that tells
a peer only that you are syncing, which is what any node reveals while it catches up. After the index
is built, though, a few kinds of request can still reach for a block on demand — looking up the full
details of an old transaction, or opening an old block in a block explorer — and those are triggered
by something you asked for. A peer watching closely could learn which blocks interest you.

Two things bound it:

- **Ordinary wallet use does not fetch anything.** Address balances, history and unspent outputs are
  answered from the index this server builds. Your wallet's addresses are not sent to peers, and
  querying them touches no peer at all.
- **If your Bitcoin node runs over Tor, so do these fetches.** They go out over the node's existing
  peer connections. That is slower, sometimes much slower, but the peer does not learn where the
  request came from.

If this tradeoff is not one you want to make, the answer is an archival node with the official
Electrs. It stores the whole chain so that nothing ever has to be fetched, and it is the more private
option. This package exists for people who want an Electrum server on a machine that cannot hold a
second full copy of the chain, and it is honest about what that costs.

## Using Electrs

### Electrum (SSL) interface

Copy an address from the **Interfaces** page into your wallet's server settings. It is shown as an `ssl://` URL, and the host and port in it are what your wallet needs — **take the port from that address rather than assuming one**, since StartOS assigns it and it is not always the same number on every server.

Only the encrypted endpoint is reachable from off this server, so your wallet's SSL option has to be on, and it has to be told to trust the certificate StartOS serves. The one exception is a Tor address you add with its **SSL** toggle turned off: that address alone is plain TCP, so turn SSL **off** in your wallet when you connect over it. Both steps, and where the settings live in each wallet, are in the [Start9 guide to connecting a wallet](https://docs.start9.com/bitcoin-guides/connecting-wallets). The Electrum desktop wallet needs a file placed by hand and is covered there too.

Once connected, Electrs serves all standard Electrum protocol queries: balances, history, transaction lookups, mempool tracking.

### Actions

- **Configure** — adjust the log verbosity and two indexer tuning knobs (batch size and per-address lookup limit). Defaults are sensible; only touch these if you have a specific reason.
