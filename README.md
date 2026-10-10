<p align="center">
  <img src="icon.png" alt="Electrs Pruned Logo" width="21%">
</p>

# Electrs Pruned on StartOS

> Everything not listed in this document should behave the same as upstream
> electrs. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

[electrs](https://github.com/romanz/electrs/) is an Electrum server: it builds an address index over your own Bitcoin node so wallets can query their history without asking anyone else. This package wires it to that node over the internal bridge, serves it over TLS, reports the one thing upstream cannot — how far through its index it has got — and, unlike the standard Electrs package, **works against a pruned node**.

- **Upstream repo:** <https://github.com/romanz/electrs/>
- **Wrapper repo:** <https://github.com/paulscode/electrs-pruned>
- **Forked from:** <https://github.com/Start9-Community/electrs-startos>

---

## Install

Add this registry to StartOS and install from it:

```
https://start9.paulscode.com
```

That is the quickest route, and it is the one to use unless you have a reason to
build. Installing from the registry gets the signed release; building from source
gets whatever is in the working tree, which is not the same thing.

It needs a Bitcoin node. That may be the official `bitcoind` package from Start9's
own registry, or one of the Knots variants published here; the package offers a
choice and does not require this registry for the node.

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [Dependencies](#dependencies)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Actions](#actions)
- [Tasks](#tasks)
- [Health Checks](#health-checks)
- [Backups and Restore](#backups-and-restore)
- [Limitations and Differences](#limitations-and-differences)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

One image, built here from upstream source.

| Property      | Value                               |
| ------------- | ----------------------------------- |
| Image         | Built from this repo's `Dockerfile` |
| Architectures | x86_64, aarch64                     |
| Command       | `electrs`                           |

| Subcontainer | Purpose                                  |
| ------------ | ---------------------------------------- |
| `electrs`    | The only daemon — the one to `attach` to |

## Volume and Data Layout

One volume, plus a read-only view of Bitcoin's.

| Volume                | Mount Point     | Purpose                                  |
| --------------------- | --------------- | ---------------------------------------- |
| `main`                | `/data`         | The address index, the config, the store |
| Bitcoin's `main` (ro) | `/mnt/bitcoind` | The RPC cookie                           |

**The index is the bulk of the volume and is excluded from backups** — see [Backups and Restore](#backups-and-restore). Everything else on `main` is small.

The index lives at `db/<network>` on `main`, one directory per network, named as electrs names them (`bitcoin`, `testnet4`, ...). A pending Reindex is an empty `reindex.request` file at the volume root; `main` removes it once the index is gone (see [Reindex](#reindex)).

## File Models

Two models, and most of the config file is pinned rather than configurable.

| File           | Format | Modelled                | Written by                   |
| -------------- | ------ | ----------------------- | ---------------------------- |
| `electrs.toml` | TOML   | Yes — `FileHelper.toml` | Init, `main`, and the Configure action |
| `store.json`   | JSON   | Yes — `FileHelper.json` | Init, `main`, and the Select Node action |

Its fields fall into three groups:

- **Pinned.** The cookie path, the network, and the Electrum bind address are `z.literal(...).catch(...)`, so a changed value is **repaired on read** rather than merely overwritten. The auth field is pinned to _undefined_ for a specific reason: electrs exits outright if both an auth value and a cookie file are set.
- **Resolved at start.** The Bitcoin RPC and P2P addresses are written by `main` from the live bridge addresses. **When Bitcoin is absent they are omitted rather than defaulted**, so electrs fails visibly and the reactive read heals it in with one restart when Bitcoin appears.
- **User-owned via the Configure action.** The log level and the two indexing limits.

Every other upstream option — the database directory, the block-download wait, the RPC timeout, the server banner — is fixed or not exposed.

`store.json` holds two flags the package uses to avoid lying to the user: whether the index has _ever_ finished, and whether the completion notification has been sent. Both matter to how sync is reported — see [Health Checks](#health-checks).

## Dependencies

One, and it is required.

| Dependency | Required | Health checks required | Mounted | Why |
| ---------- | -------- | ---------------------- | ------- | --- |
| Bitcoin, Knots (pre-RDTS), Knots (RDTS) | Yes, whichever is selected | `bitcoind`, `sync-progress` | `main`, read-only at `/mnt/bitcoind` | Chain data and the cookie |
| Knots BLAKE2b | Yes, when selected | `node`, `chain` | `main`, read-only at `/mnt/bitcoind` | Chain data and the cookie |

**Requiring Bitcoin's own sync check is deliberate.** While Bitcoin is still doing its initial download, electrs reports its dependency as unsatisfied rather than running a duplicate poll of its own — the state shows in one place instead of two.

**The ids differ per backend, and getting them wrong is silent.** The official package and its two mainnet forks run a daemon `bitcoind` with a `sync-progress` check beside it. Knots BLAKE2b is a separate lineage: its daemon is `node` and its check is `chain`, which asks which chain the node is on rather than how far along it is — the more useful question on testnet4, where the fork shares magic bytes, port and genesis with the ordinary chain. StartOS resolves a required id against the dependency's own health results and treats an id that does not exist exactly like one that is failing, so requiring the wrong name shows "Required health check not passing" forever, with no name to display. The lists live per backend in `startos/backends.ts`.

**Bitcoin may be pruned, and that is the reason this package exists.** The standard Electrs package raises a recurring `critical` task forcing pruning off, because upstream electrs refuses to start against a pruned node. This package raises no such task.

Carried patches route any block below Bitcoin's `pruneheight` to `getblock <hash> 0` instead of P2P. On StartOS that call is answered by the RPC proxy Bitcoin runs whenever pruning is on, which fetches the block from network peers and validates it against the requested hash, the merkle root, and the witness commitment before returning it. The requested hash comes from the local node's own validated header chain, so a peer can fail to answer but cannot substitute anything.

The routing is decided from `pruneheight` before asking, not by detecting a failure — Bitcoin answers a P2P request for a pruned block with silence, so there is no error to react to.

**An archival node is unaffected.** The pruned path is gated on `getblockchaininfo.pruned`; on an archival node the block path is byte-for-byte upstream's.

It does **not** need Bitcoin's transaction index, unlike some other Electrum servers.

**Two addresses are resolved, and the P2P one is not the obvious host.** It resolves Bitcoin's _whitelisted_ peer listener, not the ordinary one. electrs fetches whole blocks over P2P — for the index, and again for any history query on a scripthash nothing has subscribed to — and on the ordinary listener that traffic earns no permissions: Bitcoin may evict the connection to seat another peer, or cut it off under its upload limit. **electrs does not reconnect its P2P link; it exits.** The whitelisted listener is exempt from both.

**The service also restarts when Bitcoin's cookie changes**, watched directly on the mounted file. An absent cookie means Bitcoin is down, and is deliberately not treated as a change.

## Network Access and Interfaces

One interface, and the difference between its two ports is the thing to understand.

| Interface      | Id     | Type | Internal Port | Description                              |
| -------------- | ------ | ---- | ------------- | ---------------------------------------- |
| Electrum (SSL) | `main` | api  | 50001         | The Electrum protocol endpoint, over SSL |

electrs listens **unencrypted** on 50001 inside the container, and StartOS terminates TLS in front of it. **TLS is the only way in over LAN, `.local` and domains**, which is what makes the name accurate. Tor is the one place a plaintext address is reachable: the Tor service points an onion at whichever bridge address its SSL toggle selects, so an onion added with that toggle off carries plain TCP.

A plaintext external port is allocated too, but it is reachable only at the bridge address, by the host and by other services, source-filtered to that subnet. No LAN or WAN gateway gets a forward for it. That is the address dependents such as Mempool, Specter and Canary resolve, and it is what replaced the retired `.startos` DNS name.

The scheme override is what renders an address as `ssl://host:port`; without it the bind would print a bare `host:port` with nothing marking it as TLS.

**Clients that accept or pin an unrecognised certificate connect as-is.** The Electrum desktop wallet is the exception — it rejects the device's CA chain on every address, and needs the client-side step documented at <https://docs.start9.com/bitcoin-guides/connecting-wallets>.

**The external port is per-server, and permanent.** The preferred port is only a preference, and whatever StartOS assigns to a binding never changes — only uninstall and reinstall reassigns it. Read the live value with `start-cli package host binding list electrs electrum` rather than assuming. Servers migrated from the previous generation are the known case where it differs: their old manifest bound a single plaintext port over Tor, and rebinding the same host and internal port left the TLS leg on 50001. Those servers serve `ssl://host:50001` and will keep doing so.

## Installation and First-Run Flow

Install seeds the config and settles which Bitcoin service to index. It does not assume one. If exactly one supported service is installed, that one is selected. If there are several, or none yet, a **critical** task holds the service stopped until the operator picks one in **Select Node** (see [Tasks](#tasks)). A default used to be applied silently, and on a server running both the SHA256 and BLAKE2b nodes it indexed the one the user did not mean for 19 days; which chain a wallet sees is not something to guess. It cannot be guessed from the id either, since Retropex's BLAKE2b package takes the official `bitcoind` id.

What governs the first run is Bitcoin: electrs cannot index until Bitcoin has finished its own sync, and the dependency's sync check is what holds it there. Once Bitcoin is ready, electrs begins building its address index, which **takes hours on first run** and is the longest thing this package does.

**The index is built once and never rebuilt.** That is worth knowing because the two states look similar from outside — see [Health Checks](#health-checks). The one exception is switching to a node on another chain, which re-indexes from the last block the index and the node agree on (see [Select Node](#select-node)).

A notification is sent when the index first completes, so the wait does not have to be watched.

## Actions

Three actions: which node to index, the settings, and the recovery for a corrupted index.

### Select Node

Chooses which installed Bitcoin service electrs indexes: the official `bitcoind`, the SHA256 companion, or the BLAKE2b companion.

- **What it changes:** `backend` in `store.json`, which decides the required dependency, the mounted volume and the RPC and P2P addresses.
- **Cost:** a restart, then re-indexing from the last block the index and the new node agree on. Between the SHA256 and BLAKE2b chains that is the last shared block, 961,631, so only the blocks since the fork are indexed. It used to delete the whole index and rebuild: one user waited 36 hours to rebuild all 973,000 blocks. Measured on a test server at `0.11.1:43`: SHA256 to the archival BLAKE2b node indexed 12,384 blocks in about two minutes; back to the pruned SHA256 node took about 25 minutes, nearly all of it fetching ~4,000 post-fork blocks that node had pruned.
- **Why keeping the index is safe:** electrs checks its index against the node before serving anything and trims back to the last block they agree on (patch 0016). Without that, a node that had rejected the indexed tip, which is what `invalidateblock` leaves when an operator picks a side of a fork, would leave electrs advertising that tip and hanging on the first query that needed one of its blocks. `spikes/harness/chain_switch.py` in the electrs-pruned repo reproduces both, against real nodes.
- **What still goes:** an index for a different *network*. electrs keeps one database directory per network, and a mainnet index moved to a testnet node shares nothing but disk.
- **Repeat safety:** idempotent. Selecting the service already selected does nothing.

### Configure

Sets the log level and two indexing limits.

- **What it changes:** three fields in `electrs.toml`.
- **Cost:** applies on restart.
- **Repeat safety:** idempotent.
- **The indexing limits are the ones with consequences:** the batch size trades memory against indexing speed, and the lookup limit bounds how much work a single history query may do. Neither needs changing for normal use.

### Reindex

Deletes the address index so electrs builds it again from Bitcoin: the in-place replacement for uninstalling and reinstalling. Ported from upstream electrs-startos, where it arrived with electrs 0.12; electrs 0.11 has no way to repair its own index either.

- **When to run it:** electrs keeps exiting and its log names the database, typically `Corruption` under `failed to open index` / `failed to open DB`, or a panic such as `DB scan failed` or `get_tip failed` once it is running. Not for a busy index (see [Health Checks](#health-checks)), not for waiting on the node, and not for a node switch: Select Node keeps the index and electrs trims it back to the node itself. Input/output errors point at the drive, and a rebuild on failing storage fails the same way.
- **What it changes:** creates an empty `reindex.request` at the volume root and restarts electrs if it is running. On the next start, once the network is known and before electrs runs, `main` deletes `db/<network>` for the network electrs is about to open, resets `everSynced` and `syncNotified` so the rebuild is reported and notified as a first build, and removes the marker last, so an interrupted delete repeats. `backend`, `indexedBackend` and `indexedNetwork` are kept: the rebuild is against the same node, and clearing them would make the next start read it as a node switch.
- **Cost:** a full first index. Hours if Bitcoin still holds the blocks; on a long-pruned node every block below the prune point comes from peers again, which is a day or more (see [Limitations](#limitations-and-differences), item 3). Dependents have no complete index meanwhile. No extra disk is needed, since the old index is deleted before the new one grows.
- **Repeat safety:** a second run before the next start changes nothing; a run after the rebuild has started starts it over.
- **What happens next:** if electrs is stopped, nothing happens until it is started. While it is starting, the action waits up to a minute for the start to complete and then restarts it, because a single restart requested mid-start is dropped.

## Tasks

**One, at install only:** a `critical` task to run **Select Node**, raised when the choice of node is not obvious, meaning several supported services are installed or none yet. It keeps the service stopped until answered. With exactly one installed, that one is selected and no task is raised. Updates and restores keep the choice already made.

The standard Electrs package also raises a recurring `critical` task on Bitcoin's page forcing pruning off. This package deliberately does not, since pruned operation is supported.

## Health Checks

Two checks, and the second one is the interesting one.

| Check     | Displayed as      | Method                          |
| --------- | ----------------- | ------------------------------- |
| `electrs` | "Electrum Server" | The Electrum port is listening  |
| `sync`    | "Sync Progress"   | A real Electrum query, answered |

**"Electrum Server" going green does not mean electrs is usable.** electrs binds its listener _before_ it connects to Bitcoin, so the port is open throughout the wait for Bitcoin's sync and throughout the index build. A not-listening result therefore means electrs has not started yet — not that it is blocked. The check reports `starting` rather than failure for exactly that reason.

**"Sync Progress" is confirmed positively, and that is not a stylistic choice.** During an index build electrs processes a whole batch of blocks — minutes at a time — before servicing any request, so it very often does not answer at all rather than answering "not ready". The check therefore counts only a real reply as synced, and treats a timeout as not-synced. Reading it the other way round reports "Fully synced" throughout the entire build.

**It also retries only after the first success.** Before then a non-answer is the norm and one attempt says all it can. Afterwards a non-answer is surprising enough to be worth re-asking, because on modest hardware indexing a single block — or the database compaction behind it — can block the query loop past the timeout, and one such blip is not a sync regression. A *slow client* can also cause it: electrs answers the clients in a batch together rather than one after another, so a batch costs its slowest client rather than all of them added up, but the loop that indexes is held until that batch is done. A wallet loading history from below the prune point can therefore make Sync Progress stop answering for as long as its lookup takes.

**When electrs is not up, the checks say why, and say it on the line the operator is looking at.** The daemon holds electrs back until the node's RPC cookie exists, and the node deletes its cookie whenever it stops, so every restart of the node spends a while with electrs deliberately not running. Both checks test for the cookie the same way the daemon does. While it is missing, **"Electrum Server" reads "Waiting for <node> to start"** as `starting`. That is the line that matters during an outage, because StartOS does not run "Sync Progress" until "Electrum Server" is ready; Sync Progress shows its neutral `waiting` state meanwhile, and says the same thing itself only if the node vanishes while it is already running. Only when the cookie is present and electrs still is not listening does Sync Progress report that electrs exited, as a failure. Before this, every restart of the node could read "exited and is being restarted; check the logs": in one user's log all ten times it said so were that wait, which is how a working setup came to be reported as unstable.

**"Listening" means state `LISTEN`, which the SDK's own check does not test.** `sdk.healthCheck.checkPortListening` matches any socket whose local port is 50001, in any state. When electrs exits with wallets connected, their connections stay in `/proc/net/tcp` for about a minute in TIME_WAIT, and the SDK check reports electrs listening when nothing is: on a live server, with the node stopped and electrs waiting for its cookie, Sync Progress said "busy indexing" 34 seconds after electrs had exited, and the same false positive let the daemon's ready check pass. `listening.ts` reads the `st` column and requires `0A`. Do not switch back to the SDK function until the fix, proposed as [Start9Labs/start-technologies#4091](https://github.com/Start9Labs/start-technologies/pull/4091), ships in the SDK version this package pins.

That distinction drives the message, too. Before the first success it says the index is building and warns that it takes hours. Afterwards it says electrs is busy and this usually clears on its own — because **a built index is never rebuilt**, and telling a fully-synced user their index is rebuilding would send them to reindex a perfectly good one.

**The percentage comes from a second source, because the first one cannot supply it.** Either message carries `${percent}%, block ${indexed} of ${total}` when both numbers are available. They cannot come from the Electrum RPC: that is precisely what goes unanswered during a build, which is the whole reason the check above is written the way it is. `readProgress` reads `electrs_index_height{type="tip"}` from electrs's Prometheus endpoint on `127.0.0.1:4224`, which is a separate thread and answers throughout, and which electrs sets per block as it indexes rather than once per batch. The endpoint is electrs's own default and is reachable only inside the container; nothing is exposed.

The target has to come from Bitcoin, with `getblockchaininfo` over the same cookie electrs authenticates with, because electrs publishes no metric for it — `index_height` is where indexing has reached, and during a build its header chain stops at the same place, so nothing electrs knows is the finish line.

Both numbers are clamped against each other. They are read a moment apart from two services, so a block landing in between can put the index a hair past the height it was measured against, and "100.2%" or "block 962,700 of 962,698" reads as a fault rather than as the one-block race it is. If either number is missing or unparseable the message falls back to the wording without figures, which is why both forms exist in the dictionary.

**Every param handed to `i18n` is a string, and that is load-bearing.** `i18n` formats a **number** param with `Intl.NumberFormat(process.env.LANG)`. StartOS runs services with `LANG=C.UTF-8`, which `Intl` rejects outright: `RangeError: Incorrect locale information provided`. In `0.11.1:34` these were the first number params in the package, nothing had ever reached that call, and the health check displayed that sentence where the progress should have been. The block counts are therefore grouped here — by the runtime's locale where `Intl` accepts it, falling back to `en-US` — and passed as strings. **Do not pass a raw number to `i18n` from this package.** The same trap is waiting in any package that has only ever used static keys.

## Backups and Restore

The `main` volume is copied **except the index**, which is excluded.

So the backup is the configuration and the two flags — kilobytes rather than the tens of gigabytes the index occupies. The trade is explicit: a restored instance **rebuilds its index from scratch**, taking the same hours a fresh install does, and nothing that depends on electrs works until it finishes.

Backing the index up would not be much better than rebuilding it: it is large, it is derived entirely from Bitcoin, and a torn copy of a live database is worse than no copy.

## Limitations and Differences

1. **The index is not backed up**, so a restore means rebuilding it — hours, or far longer on a long-pruned node (see 3).
2. **`blockchain.transaction.get` with `verbose=true` works for pruned blocks.** An earlier version of this note said it did not, on the grounds that electrs had no blockhash to pass to `getrawtransaction`. That was wrong: `transaction_get` looks the blockhash up through `Tracker::lookup_transaction` first and passes it, which is upstream behaviour and unchanged here. Verified on a live pruned node at `0.11.1:42`, for a 2010 transaction and for one in a block above the chain split that the node had pruned, both returning a blockhash.

   What does fail is a transaction **electrs has not indexed**. Then the lookup yields nothing, the call goes out with no blockhash, and a node without `txindex` answers:

   > `No such mempool transaction. Use -txindex or provide a block hash to enable blockchain transaction queries.`

   **That message is misleading here and `txindex` is not the fix** (this package neither needs nor requests it). It means only that the transaction is not in electrs's index: it is on the other side of the chain split, or unconfirmed and gone from the mempool, or the index does not cover its block. Check the txid against the node — `getblockhash` for the height, then `getrawtransaction <txid> true <blockhash>` — before suspecting pruning.
   On a BLAKE2b chain the verbose form additionally fails for every block above 961640 unless Bitcoin runs `paulscode/btc-rpc-proxy:v0.8.0-blake2b.1` or later: a stock proxy cannot parse a 164-byte header, so any request it intercepts and parses returns `IO error: failed to fill whole buffer`. This is not limited to pruned blocks.
3. **First index on an already-pruned node is slow.** Blocks below the prune point are fetched from network peers — measured ~162 ms each on clearnet when fetched one at a time, materially worse over Tor. Several are now kept in flight at once, but the ceiling is contention for a limited set of peers rather than how many requests are outstanding, so the gain is a small multiple and not proportional. Installing before or during Bitcoin's own sync avoids this almost entirely, because blocks are indexed over the fast local link before pruning discards them. Pointing the package at a second, archival node removes it for all the history the two chains share.
4. **Mainnet only.** The network is pinned in the config.
5. **Most of upstream's configuration is not exposed** — the database directory, the RPC timeout, the server banner, and the block-download wait are all fixed or absent.
6. **The Electrum desktop wallet needs a client-side certificate step**; other wallets do not.
7. **electrs does not reconnect its P2P link.** That is why the whitelisted Bitcoin listener is used rather than the ordinary one.
8. **The external port is assigned once and never changes** for an existing binding, so it may not be the preferred one.

---

## Quick Reference for AI Consumers

```yaml
package_id: electrs-pruned
image: built from ./Dockerfile
architectures:
  - x86_64
  - aarch64
subcontainers:
  - electrs
volumes:
  main: /data # bitcoin's main volume is mounted read-only at /mnt/bitcoind
file_models:
  - electrs.toml
  - store.json # backend, indexedBackend, indexedNetwork, everSynced, syncNotified
  # reindex.request at the volume root: a pending Reindex, consumed by main
startos_managed_env_vars: [] # configuration is written into electrs.toml
dependencies:
  - <selected backend> # required, kind: running; checks per backend, see backends.ts
interfaces:
  main: { type: api, port: 50001 } # TLS-terminated by StartOS; plaintext is bridge-only
actions:
  - select-backend # which node to index; switching keeps the index, re-indexes from the last agreed block
  - config
  - reindex # deletes db/<network> on the next start; keeps the node selection
tasks:
  - { action: select-backend, severity: critical } # install only, when several nodes or none are installed
  # deliberately NOT upstream's recurring bitcoind:autoconfig prune task; pruning is supported
health_checks:
  - electrs # displayed "Electrum Server"; binds before it connects to Bitcoin
  - sync # displayed "Sync Progress"; positive confirmation only
  # both say "Waiting for <node> to start" while the node's cookie is absent; "Electrum Server" is the one seen
  # listening means TCP state LISTEN (listening.ts), not the SDK's checkPortListening, which counts TIME_WAIT
```
