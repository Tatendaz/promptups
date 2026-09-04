# Usage notes

The long version of everything the [README](../README.md) states in one line.
Every claim here is checked against source; file references name where the
behavior lives.

## Keep the window visible

The whole pose pipeline runs on `requestAnimationFrame`
([`public/app.js`](../public/app.js)), and browsers throttle that to a crawl —
or stop it — when a tab isn't visible. A full-screen terminal parked on top of
the page will count zero reps and never tell you why. Second monitor, split
screen, or a small window in the corner. The page takes a screen wake lock, but
that only keeps your display on; it can't make a hidden tab compute. There is no
`visibilitychange` handler anywhere in the tree, so nothing warns you when the
tab goes dark.

## Ports and environment variables

`--port=N` (or `PROMPTUPS_PORT`) moves the server off the default `7887`, and
`init` bakes that port into the three `curl` commands it writes
([`bin/promptups.js`](../bin/promptups.js)). So the hooks and the server have to
agree on it.

**Re-running `init --port=8000` now repairs a mismatch.** `init` compares each
installed hook against what it would write today and offers to rewrite the ones
that differ, so a changed port and a hook predating the access token are both
fixed the same way. (This used to be a trap: `init` saw hooks already installed,
said so, and exited — leaving you pointed at a port nobody was serving, with no
error anywhere. `uninstall` then `init` was the only way out.) `--yes` skips the
confirmation.

Session data lives in `sessions.json` under `$PROMPTUPS_DATA_DIR`, defaulting
to `~/.promptups` — the same resolution [`server.js`](../server.js) uses and the
same one the README's uninstall snippet honours.

## The access token

The server mints a random token on every start and writes it to `token` in that
same directory, readable only by you (`0600`). The endpoints that change
something — `/promptups/start`, `/promptups/stop`, `POST /api/session` and
`/api/quip` — require it. The workout page gets it because the server injects it
into the page it serves; the hooks get it by reading the file at call time,
which is why a restart does not mean re-running `init`.

This exists because the server listens on a fixed, guessable port with no
password. Any website you happened to have open could otherwise start and stop
your sets, write fake records into your stats, or — with `--ai-coach` — spend
your Claude quota. None of that needed a bug; it was just what an open endpoint
on `localhost` allows.

**If you installed the hooks before this landed, re-run `promptups init`.** It
now detects out-of-date hooks and offers to rewrite them, and `promptups start`
prints `Hooks: OUT OF DATE` when it sees them. Without that, an old hook is
rejected and Claude Code never shows it, because the hooks are written to fail
quietly — your sets would simply stop counting.

## The Notification trade-off

The `Notification` hook (a permission prompt, a question from Claude) POSTs to
the **same stop endpoint** as `Stop`, with `?reason=attention`
([`bin/promptups.js`](../bin/promptups.js)). So a permission prompt mid-squat
ends your set and stops counting until your next prompt — the reps you do while
you walk over and click **allow** are worth nothing.

If you had counted at least one rep, the short set is banked to your stats at
whatever the count was; a set at zero is dropped, and test drives never bank —
`shouldLogSession` in [`public/session.js`](../public/session.js) gates the
write on both. If you'd rather keep the set alive through prompts, delete that
one entry from `~/.claude/settings.json`; `init` puts it back if you re-run it.

This is a genuine trade-off, not a bug: you want to know Claude is blocked.

## Network origins

No pixel of you reaches a server, but the page is not offline. In default
mode it fetches from four origins. None of them ever receive camera data — a request carries only
the ordinary metadata any web fetch does (IP address, user agent):

- `cdn.jsdelivr.net` — the MediaPipe runtime and WASM
  ([`public/app.js`](../public/app.js)); fetched once, then cached.
- `storage.googleapis.com` — the 5.8 MB pose model; fetched once, then cached.
- `fonts.googleapis.com` and `fonts.gstatic.com` — two webfonts
  ([`public/index.html`](../public/index.html)), fetched or revalidated
  **depending on your browser's cache state and the response headers** — the
  stylesheet's cache lifetime is short (24 h at time of writing), so these
  requests recur across days rather than being one-time like the MediaPipe
  fetches.

A cold first load is ~8.5 MB over the wire for the MediaPipe payload (runtime +
WASM + pose model); the two webfont requests (~54 KB) are separate, on top.
In default mode everything else is localhost — self-host the fonts and a warm
page talks to nothing but your own machine. The one exception is opt-in: with
`--ai-coach`, the server runs one short `claude -p` call per set, which goes to
Anthropic under your own Claude account (see [The coach, in detail](#the-coach-in-detail)).

## Cameras

The picker lists every video device the browser can see:

- **Built-in webcam** — sees you at your desk. Perfect for squats and desk
  push-ups.
- **iPhone via Continuity Camera** — appears automatically on macOS. Prop it
  against a wall and the floor comes into frame, which is what real push-ups
  and sit-ups need. That's the next milestone.
- **Any USB webcam** — point it wherever you train.

## The coach, in detail

Default mode uses built-in line banks and makes no network calls of its own —
though the page as a whole only works offline once the CDN and font assets
above are cached (or self-hosted). Start with `--ai-coach` and end-of-set
lines come from a `claude -p` Haiku call instead — one short generation per
set, which does call out to Claude, with the line bank as fallback:

```bash
node bin/promptups.js --ai-coach
```

Mute it with the `voice` button. Your household has opinions too.
