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

`--port=N` (or `PROMPTUPS_PORT`) moves the server off the default `7887`, but
`init` bakes the port into the three `curl` commands it writes
([`bin/promptups.js`](../bin/promptups.js)). So `init` on the default and then
`--port=8000` leaves you with a server nobody is talking to and no error
anywhere. Re-running `init --port=8000` will *not* repair it — it sees hooks
already installed and exits. To move ports: `uninstall`, then `init
--port=8000`, then start on 8000. (`--yes` skips the `init` confirmation.)

Session data lives in `sessions.json` under `$PROMPTUPS_DATA_DIR`, defaulting
to `~/.promptups` — the same resolution [`server.js`](../server.js) uses and the
same one the README's uninstall snippet honours.

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

No pixel of you reaches a server, but the page is not offline. It fetches from
four origins, none of which see you:

- `cdn.jsdelivr.net` — the MediaPipe runtime and WASM
  ([`public/app.js`](../public/app.js)); fetched once, then cached.
- `storage.googleapis.com` — the 5.8 MB pose model; fetched once, then cached.
- `fonts.googleapis.com` and `fonts.gstatic.com` — two webfonts
  ([`public/index.html`](../public/index.html)), **refetched-or-revalidated on
  every page load** rather than served purely from cache.

First load is ~8.5 MB over the wire. Everything else is localhost. Self-host
the fonts and a warm page talks to nothing but your own machine.

## Cameras

The picker lists every video device the browser can see:

- **Built-in webcam** — sees you at your desk. Perfect for squats and desk
  push-ups.
- **iPhone via Continuity Camera** — appears automatically on macOS. Prop it
  against a wall and the floor comes into frame, which is what real push-ups
  and sit-ups need. That's the next milestone.
- **Any USB webcam** — point it wherever you train.

## The coach, in detail

Default mode uses built-in line banks and works offline. Start with
`--ai-coach` and end-of-set lines come from a `claude -p` Haiku call instead —
one short generation per set, with the line bank as fallback:

```bash
node bin/promptups.js --ai-coach
```

Mute it with the `voice` button. Your household has opinions too.
