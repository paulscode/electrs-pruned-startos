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

## File Models

Two models, and most of the config file is pinned rather than configurable.

| File           | Format | Modelled                | Written by                   |
| -------------- | ------ | ----------------------- | ---------------------------- |
| `electrs.toml` | TOML   | Yes — `FileHelper.toml` | Init, `main`, and the action |
| `store.json`   | JSON   | Yes — `FileHelper.json` | `main`                       |

Its fields fall into three groups:

- **Pinned.** The cookie path, the network, and the Electrum bind address are `z.literal(...).catch(...)`, so a changed value is **repaired on read** rather than merely overwritten. The auth field is pinned to _undefined_ for a specific reason: electrs exits outright if both an auth value and a cookie file are set.
- **Resolved at start.** The Bitcoin RPC and P2P addresses are written by `main` from the live bridge addresses. **When Bitcoin is absent they are omitted rather than defaulted**, so electrs fails visibly and the reactive read heals it in with one restart when Bitcoin appears.
- **User-owned via the action.** The log level and the two indexing limits.

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

electrs listens **unencrypted** on 50001 inside the container, and StartOS terminates TLS in front of it. **TLS is the only way in from off the box** — LAN, `.local`, domains and Tor alike — which is what makes the name accurate.

A plaintext external port is allocated too, but it is reachable only at the bridge address, by the host and by other services, source-filtered to that subnet. No LAN or WAN gateway gets a forward for it. That is the address dependents such as Mempool, Specter and Canary resolve, and it is what replaced the retired `.startos` DNS name.

The scheme override is what renders an address as `ssl://host:port`; without it the bind would print a bare `host:port` with nothing marking it as TLS.

**Clients that accept or pin an unrecognised certificate connect as-is.** The Electrum desktop wallet is the exception — it rejects the device's CA chain on every address, and needs the client-side step documented at <https://docs.start9.com/bitcoin-guides/connecting-wallets>.

**The external port is per-server, and permanent.** The preferred port is only a preference, and whatever StartOS assigns to a binding never changes — only uninstall and reinstall reassigns it. Read the live value with `start-cli package host binding list electrs electrum` rather than assuming. Servers migrated from the previous generation are the known case where it differs: their old manifest bound a single plaintext port over Tor, and rebinding the same host and internal port left the TLS leg on 50001. Those servers serve `ssl://host:50001` and will keep doing so.

## Installation and First-Run Flow

Install seeds the config and nothing else. There is no credential and no task on this service.

What governs the first run is Bitcoin: electrs cannot index until Bitcoin has finished its own sync, and the dependency's sync check is what holds it there. Once Bitcoin is ready, electrs begins building its address index, which **takes hours on first run** and is the longest thing this package does.

**The index is built once and never rebuilt.** That is worth knowing because the two states look similar from outside — see [Health Checks](#health-checks).

A notification is sent when the index first completes, so the wait does not have to be watched.

## Actions

One action.

### Configure

Sets the log level and two indexing limits.

- **What it changes:** three fields in `electrs.toml`.
- **Cost:** applies on restart.
- **Repeat safety:** idempotent.
- **The indexing limits are the ones with consequences:** the batch size trades memory against indexing speed, and the lookup limit bounds how much work a single history query may do. Neither needs changing for normal use.

## Tasks

**None.** The standard Electrs package raises a recurring `critical` task on Bitcoin's page forcing pruning off; this package deliberately does not, since pruned operation is supported.

## Health Checks

Two checks, and the second one is the interesting one.

| Check     | Displayed as      | Method                          |
| --------- | ----------------- | ------------------------------- |
| `electrs` | "Electrum Server" | The Electrum port is listening  |
| `sync`    | "Sync Progress"   | A real Electrum query, answered |

**"Electrum Server" going green does not mean electrs is usable.** electrs binds its listener _before_ it connects to Bitcoin, so the port is open throughout the wait for Bitcoin's sync and throughout the index build. A not-listening result therefore means electrs has not started yet — not that it is blocked. The check reports `starting` rather than failure for exactly that reason.

**"Sync Progress" is confirmed positively, and that is not a stylistic choice.** During an index build electrs processes a whole batch of blocks — minutes at a time — before servicing any request, so it very often does not answer at all rather than answering "not ready". The check therefore counts only a real reply as synced, and treats a timeout as not-synced. Reading it the other way round reports "Fully synced" throughout the entire build.

**It also retries only after the first success.** Before then a non-answer is the norm and one attempt says all it can. Afterwards a non-answer is surprising enough to be worth re-asking, because on modest hardware indexing a single block — or the database compaction behind it — can block the query loop past the timeout, and one such blip is not a sync regression.

That distinction drives the message, too. Before the first success it says the index is building and warns that it takes hours. Afterwards it says electrs is busy and this usually clears on its own — because **a built index is never rebuilt**, and telling a fully-synced user their index is rebuilding would send them to reindex a perfectly good one.

## Backups and Restore

The `main` volume is copied **except the index**, which is excluded.

So the backup is the configuration and the two flags — kilobytes rather than the tens of gigabytes the index occupies. The trade is explicit: a restored instance **rebuilds its index from scratch**, taking the same hours a fresh install does, and nothing that depends on electrs works until it finishes.

Backing the index up would not be much better than rebuilding it: it is large, it is derived entirely from Bitcoin, and a torn copy of a live database is worse than no copy.

## Limitations and Differences

1. **The index is not backed up**, so a restore means rebuilding it — hours, or far longer on a long-pruned node (see 3).
2. **`blockchain.transaction.get` with `verbose=true` fails for blocks Bitcoin has pruned.** Its second step is `getrawtransaction`, which the RPC proxy does not intercept. The non-verbose form, which is what wallets normally use, works. Known gap.
3. **First index on an already-pruned node is slow.** Blocks below the prune point are fetched one at a time from network peers — measured ~162 ms each on clearnet, materially worse over Tor. Installing before or during Bitcoin's own sync avoids this almost entirely, because blocks are indexed over the fast local link before pruning discards them.
4. **Mainnet only.** The network is pinned in the config.
5. **Most of upstream's configuration is not exposed** — the database directory, the RPC timeout, the server banner, and the block-download wait are all fixed or absent.
6. **The Electrum desktop wallet needs a client-side certificate step**; other wallets do not.
7. **electrs does not reconnect its P2P link.** That is why the whitelisted Bitcoin listener is used rather than the ordinary one.
8. **The external port is assigned once and never changes** for an existing binding, so it may not be the preferred one.

---

## Quick Reference for AI Consumers

```yaml
package_id: electrs
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
  - store.json # everSynced / syncNotified flags
startos_managed_env_vars: [] # configuration is written into electrs.toml
dependencies:
  - <selected backend> # required, kind: running; checks per backend, see backends.ts
interfaces:
  main: { type: api, port: 50001 } # TLS-terminated by StartOS; plaintext is bridge-only
actions:
  - config
tasks:
  - { action: 'bitcoind:autoconfig', severity: critical } # on Bitcoin's page, recurring
health_checks:
  - electrs # displayed "Electrum Server"; binds before it connects to Bitcoin
  - sync # displayed "Sync Progress"; positive confirmation only
```
