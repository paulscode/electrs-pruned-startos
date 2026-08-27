#!/bin/sh
# Generate electrs.toml from the environment, for platforms with no settings form.
#
# StartOS does not use this. It writes electrs.toml itself from its own config
# actions and runs `electrs` directly, so it leaves ELECTRS_CONFIG_FROM_ENV
# unset and this script is a passthrough. Umbrel and plain Docker have no
# equivalent of an action, so every setting has to be expressible as an
# environment variable and assembled here.
#
# Regenerated on every start rather than written once. On a platform without a
# settings form the environment is the only source of truth, so a stale file
# that survives a changed variable is worse than losing a hand edit nobody can
# make through a supported path anyway.
set -eu

CONF="${ELECTRS_CONF:-/data/electrs.toml}"

if [ "${ELECTRS_CONFIG_FROM_ENV:-0}" != "1" ]; then
    exec "$@"
fi

# TOML basic strings escape backslash and double quote. The RPC password comes
# from the node package and is not ours to constrain, so quote rather than
# assume it is alphanumeric.
esc() {
    printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

: "${BITCOIN_RPC_HOST:?BITCOIN_RPC_HOST is required}"
: "${BITCOIN_RPC_PORT:=8332}"
: "${BITCOIN_P2P_HOST:=$BITCOIN_RPC_HOST}"
: "${BITCOIN_P2P_PORT:=8333}"
: "${ELECTRS_NETWORK:=bitcoin}"
: "${ELECTRS_RPC_ADDR:=0.0.0.0:50001}"
: "${ELECTRS_LOG_FILTERS:=INFO}"

{
    printf 'network = "%s"\n' "$(esc "$ELECTRS_NETWORK")"
    printf 'daemon_rpc_addr = "%s:%s"\n' "$(esc "$BITCOIN_RPC_HOST")" "$BITCOIN_RPC_PORT"
    printf 'daemon_p2p_addr = "%s:%s"\n' "$(esc "$BITCOIN_P2P_HOST")" "$BITCOIN_P2P_PORT"
    printf 'electrum_rpc_addr = "%s"\n' "$(esc "$ELECTRS_RPC_ADDR")"
    printf 'log_filters = "%s"\n' "$(esc "$ELECTRS_LOG_FILTERS")"

    # electrs exits if auth and cookie_file are both set, so this is exclusive.
    # Cookie first: it is the better credential where a node offers one, since
    # nothing has to be generated, stored or shared. Umbrel's Bitcoin Node uses
    # rpcauth and exports a user and password instead, which is the other branch.
    if [ -n "${BITCOIN_RPC_COOKIE_FILE:-}" ]; then
        printf 'cookie_file = "%s"\n' "$(esc "$BITCOIN_RPC_COOKIE_FILE")"
    elif [ -n "${BITCOIN_RPC_USER:-}" ] && [ -n "${BITCOIN_RPC_PASS:-}" ]; then
        printf 'auth = "%s:%s"\n' "$(esc "$BITCOIN_RPC_USER")" "$(esc "$BITCOIN_RPC_PASS")"
    else
        echo "entrypoint: set BITCOIN_RPC_COOKIE_FILE, or both BITCOIN_RPC_USER and BITCOIN_RPC_PASS" >&2
        exit 1
    fi

    # Omitted when unset so electrs applies its own default, rather than this
    # script guessing a number on the operator's behalf.
    [ -n "${ELECTRS_INDEX_BATCH_SIZE:-}" ] \
        && printf 'index_batch_size = %s\n' "$ELECTRS_INDEX_BATCH_SIZE"
    [ -n "${ELECTRS_INDEX_LOOKUP_LIMIT:-}" ] \
        && printf 'index_lookup_limit = %s\n' "$ELECTRS_INDEX_LOOKUP_LIMIT"
    :
} > "$CONF"

echo "entrypoint: wrote $CONF for network ${ELECTRS_NETWORK}, daemon ${BITCOIN_RPC_HOST}:${BITCOIN_RPC_PORT}"

exec "$@"
