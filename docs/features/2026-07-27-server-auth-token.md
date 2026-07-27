# Feature: require a capability token on the endpoints that change things

**Branch:** fix/server-auth-token
**Date:** 2026-07-27

## Summary
Closes #7. The server now mints a random token at startup and requires it on
`/promptups/start`, `/promptups/stop`, `POST /api/session` and `/api/quip`,
alongside an `Origin` check and POST-only methods. Read-only endpoints stay open.
Tests: 57 → 68.

## Motivation
`server.js` had no authentication and no `Origin` validation anywhere. The port
is fixed at `7887`, so any page you visited knew where to find it, and two
details made it trivially reachable:

- **`start` and `stop` answered GET.** A bare `<img src>` fired them. CORS never
  prevents a request being *sent*, so nothing was in the way at all.
- **`readBody` accepted any JSON.** A cross-origin form POST with
  `Content-Type: text/plain` is a *simple* request — no preflight — and text/plain
  carries JSON fine, so `POST /api/session` was writable cross-origin. That is
  the one that touches disk.

What a visited page could do: start and stop your sets, write fabricated records
into `sessions.json` (making all-time stats meaningless), grow that file without
limit, and with `--ai-coach`, spend your Claude quota on a prompt it partly
controls. No RCE and no camera access — but none of it required a bug either.

## What changed
- **`server.js`** — token minted from `crypto.randomBytes(32)` at startup, written
  `0600` to `token` in `$PROMPTUPS_DATA_DIR`. Compared with `timingSafeEqual`.
  `authorize()` checks `Origin` then the bearer token, and answers before any
  body is read. `start`/`stop` are POST-only. `/api/session` gained a 64 KB body
  cap (`413`), a non-object-body rejection, and reps bounds (`400`).
- **`public/auth.js`** (new) — reads the token from the `<meta>` tag the server
  injects into `index.html`. Lazy and guarded, because `coach.js` imports it and
  is unit-tested under `node:test`, where `document` does not exist.
- **`public/app.js`, `public/coach.js`** — send the header on their two calls.
- **`bin/promptups.js`** — hooks read the token file at call time via `$(cat ...)`,
  so a restart doesn't require re-running `init`. `init` now detects hooks that
  differ from what it would write today and offers to rewrite them.
- **`tests/server.test.js`** — 11 new tests: no token, wrong token (including one
  of the right length), foreign origin, allowed origins, GET on start/stop, file
  mode, meta injection and `no-store`, oversized body, record sanity, quip auth,
  and that read-only endpoints stay open.

## Notes
**The migration was the risky part, not the auth.** Hooks written by an older
`init` carry no token, and they end in `|| true` with `-m 1` — so they fail
*silently*. Sets would simply stop counting with nothing to see anywhere. Three
things make that visible instead: `init` detects and rewrites stale hooks, the
server logs a one-time explanation when a tokenless request arrives, and
`promptups start` prints `Hooks: OUT OF DATE` in its banner.

**The token is read at call time, not baked into `settings.json`.** Baking it in
would put a live secret in a world-readable file and break on every restart.
`$(cat ...)` puts it in curl's argv for the length of one 1-second request rather
than in a long-lived process's argv.

Fixing `init`'s staleness check also fixed a documented papercut: changing
`--port` used to leave the hooks pointing at a dead port with `init` refusing to
repair them (`uninstall` then `init` was the only way out). Because "current"
now means "byte-identical to what we would write today", a port change is caught
by the same mechanism.

`/events` is deliberately left open. It is read-only, and `EventSource` cannot
send headers, so protecting it needs a different mechanism than the rest. The
worst it leaks is when you are prompting.
