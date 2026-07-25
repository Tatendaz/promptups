<div align="center">

# 🏋️ PromptUps

**Prompt Claude. Drop and give me ten.**

Every time you prompt [Claude Code](https://claude.com/claude-code), your webcam turns into a rep counter — **squats and desk push-ups counted out loud by a trash-talking coach** — and a chime tells you the second your code is ready. The AI gets smarter. Now you get stronger.

[![License: MIT](https://img.shields.io/badge/License-MIT-111111.svg)](LICENSE)
[![Claude Code Hooks](https://img.shields.io/badge/Claude%20Code-Hooks-d97757.svg)](https://code.claude.com/docs/en/hooks)
[![Pose detection: 100% local](https://img.shields.io/badge/pose%20detection-100%25%20local-1f6feb.svg)](#privacy)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-2ea44f.svg)](#contributing)

<!-- TODO: docs/demo.gif — record a set with the scoreboard in frame -->

*"My code's compiling" used to mean sword fights. In the agent era it means gains.*

</div>

---

## Why PromptUps?

A real Claude Code prompt takes thirty seconds to five minutes. Multiply by every prompt in a vibe-coding session and you're sitting on an hour of dead time a day — currently donated to your X feed.

PromptUps claims it back, with zero workflow change:

- ⌨️ **You hit enter** — the scoreboard goes orange and the coach says go.
- 🎥 **The camera counts** — MediaPipe pose landmarks, hysteresis thresholds, no honor system. Half reps don't count.
- 🗣️ **The coach talks** — every rep counted out loud, trash talk at milestones, a roast if you just stand there.
- 🔔 **Claude replies** — chime, rep summary, back to your diff.
- 📈 **Stats accrue** — today, all time, best set, prompts survived.

## Quick start

**You need:** Node 18+, `git`, and `curl` — the hooks are `curl` one-liners. That's the whole list. There is nothing to `npm install`; the dependency count is zero and stays zero.

```bash
git clone https://github.com/Tatendaz/promptups && cd promptups
node bin/promptups.js init    # shows the hooks, asks first, backs up settings.json
node bin/promptups.js         # starts the server, opens http://localhost:7887
```

Allow camera access, pick your exercise, then go prompt Claude in your terminal. The page reacts on its own from there. The server is Node's `http` module; the page pulls the MediaPipe runtime and pose model from a CDN on first load (~8.5 MB over the wire, cached after).

**Keep the browser window visible.** The whole pose pipeline runs on `requestAnimationFrame`, and browsers throttle that to a crawl — or stop it — when a tab isn't visible. A full-screen terminal parked on top of the page will count zero reps and never tell you why. Second monitor, split screen, or a small window in the corner. The page takes a screen wake lock, but that only keeps your display on; it can't make a hidden tab compute.

Don't want to wire the hooks yet? Hit **test drive** in the header to fake a prompt.

**On ports:** `--port=N` (or `PROMPTUPS_PORT`) moves the server, but `init` bakes the port into the three `curl` commands it writes, so `init` on the default and then `--port=8000` leaves you with a server nobody is talking to and no error anywhere. Re-running `init --port=8000` will *not* repair it — it sees hooks already installed and exits. To move ports: `uninstall`, then `init --port=8000`, then start on 8000. (`--yes` skips the `init` confirmation.)

## How it works

```
you hit enter  ──► UserPromptSubmit ──► POST /promptups/start                 ──► camera counts reps
Claude replies ──► Stop             ──► POST /promptups/stop?reason=done      ──► chime + set summary
Claude asks    ──► Notification     ──► POST /promptups/stop?reason=attention ──► amber alert + set summary
```

`init` writes three hooks into `~/.claude/settings.json`:

| Claude Code event | What PromptUps does |
| --- | --- |
| `UserPromptSubmit` | Starts a set. Scoreboard orange, coach says go. |
| `Stop` | Ends the set. Chime, summary, back to work. |
| `Notification` | "CLAUDE NEEDS YOU" — amber alert. Hits the **same stop endpoint** as `Stop`, so the set ends and is banked here too. |

That third row is the one to read twice. A permission prompt mid-squat ends your set and stops counting until your next prompt — the reps you do while you walk over and click **allow** are worth nothing. If you had counted at least one rep, the short set is banked to your stats at whatever the count was; a set at zero is dropped, and test drives never bank ([`public/app.js`](public/app.js) gates the write on both). If you'd rather keep the set alive through prompts, delete that one entry from `~/.claude/settings.json`; `init` puts it back if you re-run it.

Each hook is a `curl` with a 1-second timeout that ignores failure, so Claude Code behaves identically whether PromptUps is running or not. The page listens on a server-sent-events stream and does everything else itself.

## The coach

The coach counts every rep through the Web Speech API and has opinions:

> "Twenty-five seconds. Zero reps. The camera sees everything."

Default mode uses built-in line banks and works offline. Start with `--ai-coach` and end-of-set lines come from a `claude -p` Haiku call instead — one short generation per set, with the line bank as fallback:

```bash
node bin/promptups.js --ai-coach
```

Mute it with the `voice` button. Your household has opinions too.

## Cameras

The picker lists every video device the browser can see:

- **Built-in webcam** — sees you at your desk. Perfect for squats and desk push-ups.
- **iPhone via Continuity Camera** — appears automatically on macOS. Prop it against a wall and the floor comes into frame, which is what real push-ups and sit-ups need. That's the next milestone.
- **Any USB webcam** — point it wherever you train.

## Exercises

v0.1 ships the two a desk camera can actually see:

| Exercise | Counted from | Thresholds |
| --- | --- | --- |
| Squats | knee angle (hip–knee–ankle) | down < 110°, up > 155° |
| Desk push-ups | elbow angle (shoulder–elbow–wrist) | down < 105°, up > 150° |

Both run through a hysteresis state machine with smoothing and a minimum down-phase, so landmark jitter and quick bounces can't inflate your numbers. The camera is honest.

## Privacy

Every camera frame is processed by MediaPipe **inside your browser tab** and discarded. No frame is recorded, none is uploaded, no pixel of you reaches a server. That is what the badge means, and it is the claim that matters.

The page is not offline, though. It fetches from four origins, none of which see you: `cdn.jsdelivr.net` for the MediaPipe runtime and WASM, and `storage.googleapis.com` for the 5.8 MB pose model — both once, then cached ([`public/app.js`](public/app.js)) — plus `fonts.googleapis.com` and `fonts.gstatic.com` for two webfonts, which are **refetched-or-revalidated on every page load** rather than served purely from cache ([`public/index.html`](public/index.html)). Everything else is localhost. Self-host the fonts and a warm page talks to nothing but your own machine.

Session totals (exercise, reps, timestamps) live in `~/.promptups/sessions.json`.

## Uninstall

```bash
node bin/promptups.js uninstall   # removes only its own hooks, backs up settings.json first
rm -rf "${PROMPTUPS_DATA_DIR:-$HOME/.promptups}"   # optional: delete your stats
```

## Roadmap

- Floor push-ups and sit-ups, tuned for a phone camera at floor level
- Plank timer for long agentic runs
- `reps per 1k tokens` — someone has to invent the metric
- Adapters for other agent CLIs: the trigger surface is two HTTP endpoints, so anything that can run a shell command on start and stop can drive it
- Shareable end-of-day set card
- Headless-browser test harness for the camera orchestration in `public/app.js`

## Contributing

The easiest PR: **add an exercise**. It's two edits, and only the first one is interesting.

**1. The movement** — one entry in `EXERCISES` in [`public/reps.js`](public/reps.js): a joint triple per side, two angle thresholds, and a framing cue. The angle is measured at the middle joint, so `hip–shoulder–elbow` is your shoulder opening up:

```js
overheadPress: {
  label: "overhead press",
  sides: [[L.hipL, L.shoulderL, L.elbowL], [L.hipR, L.shoulderR, L.elbowR]],
  downBelow: 90,   // upper arms level with the shoulders, racked
  upAbove: 150,    // arms locked out overhead
  cue: "face the camera, whole torso in frame",
},
```

**2. The button** — one more `<button class="exercise-btn" role="radio" aria-checked="false" data-exercise="overheadPress">` in the picker in [`public/index.html`](public/index.html). Nothing iterates `EXERCISES` to build that picker; [`public/app.js`](public/app.js) only wires the `.exercise-btn` elements already in the page. Skip this step and your exercise is perfect and unreachable — and `npm test` passes anyway, because `tests/reps.test.js` covers the geometry, not the UI. Making step 2 disappear by rendering the picker from `EXERCISES` is itself a very welcome PR; it wants the DOM harness on the roadmap above.

Add a case to `tests/reps.test.js`, run `npm test` (25 tests, node:test, no dependencies), and open a PR. Coach lines live in [`public/coach.js`](public/coach.js) — funny beats polite.

## License

[MIT](LICENSE). Built for people who told themselves they'd stretch between prompts and never did.
