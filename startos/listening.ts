import { readFile } from 'fs/promises'

/** TCP state `LISTEN` as the kernel writes it in the `st` column of /proc/net/tcp{,6}. */
const TCP_LISTEN = '0A'

/**
 * Whether the text of /proc/net/tcp or /proc/net/tcp6 shows a socket *listening* on `port`.
 *
 * Written here rather than using the SDK's `checkPortListening`, because that one matches any
 * socket whose local port is `port`, in any state. It never reads the `st` column. When electrs
 * exits with wallets connected, their connections stay in the table for about a minute in
 * TIME_WAIT, still showing local port 50001, and the SDK check reports electrs listening when
 * nothing is. Seen on a live server: with the node stopped and electrs waiting for its cookie,
 * the Sync check said "busy indexing" 34 seconds after electrs had exited. The same false positive
 * satisfies a daemon's `ready` check, which is how the Sync check came to run at all while electrs
 * was not up.
 *
 * Kept free of SDK imports so it can be compiled and exercised on its own. Proposed as a fix to the SDK
 * in Start9Labs/start-technologies#4091; once that ships in the SDK this package builds against, the
 * SDK check can be used again and this file removed.
 */
export function listensOn(procNetTcp: string, port: number): boolean {
  return procNetTcp
    .split('\n')
    .slice(1) // header row
    .some((line) => {
      const cols = line.trim().split(/\s+/)
      if (cols.length < 4) return false
      const local = cols[1] // "0100007F:C351", or 32 hex digits then ":C351" for tcp6
      const state = cols[3]
      const port_ = Number.parseInt(local.slice(local.lastIndexOf(':') + 1), 16)
      return state === TCP_LISTEN && port_ === port
    })
}

/** Whether anything in this container is listening on TCP `port`, over IPv4 or IPv6. */
export async function isListening(port: number): Promise<boolean> {
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    const text = await readFile(file, 'utf-8').catch(() => '')
    if (listensOn(text, port)) return true
  }
  return false
}
