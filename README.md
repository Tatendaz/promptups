<div align="center">

# 🏋️ PromptUps

## Prompt Claude. Drop and give me ten.

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

```bash
git clone https://github.com/Tatendaz/promptups && cd promptups
node bin/promptups.js init    # shows the hooks, asks first, backs up settings.json
node bin/promptups.js         # starts the server, opens http://localhost:7887
```

Allow camera access, pick your exercise, then go prompt Claude in your terminal. The page reacts on its own from there. No dependencies to install — the server is Node's `http` module and the page pulls MediaPipe from a CDN on first load (about 5 MB, cached after).

Don't want to wire the hooks yet? Hit **test drive** in the header to fake a prompt.

## How it works

```
you hit enter ──► UserPromptSubmit hook ──► POST /promptups/start ──► camera counts reps
Claude replies ──► Stop hook             ──► POST /promptups/stop  ──► chime + set summary
```

`init` writes three hooks into `~/.claude/settings.json`:

| Claude Code event | What PromptUps does |
| --- | --- |
| `UserPromptSubmit` | Starts a set. Scoreboard orange, coach says go. |
| `Stop` | Ends the set. Chime, summary, back to work. |
| `Notification` | "CLAUDE NEEDS YOU" — amber alert, back to the keyboard. |

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

Every camera frame is processed by MediaPipe **inside your browser tab** and discarded. Nothing is recorded, nothing leaves your machine. The only network traffic is the one-time CDN fetch of the pose model, and localhost. Session totals (exercise, reps, timestamps) live in `~/.promptups/sessions.json`.

## Uninstall

```bash
node bin/promptups.js uninstall   # removes only its own hooks, backs up settings.json first
rm -rf ~/.promptups               # optional: delete your stats
```

## Roadmap

- Floor push-ups and sit-ups, tuned for a phone camera at floor level
- Plank timer for long agentic runs
- `reps per 1k tokens` — someone has to invent the metric
- Adapters for other agent CLIs: the trigger surface is two HTTP endpoints, so anything that can run a shell command on start and stop can drive it
- Shareable end-of-day set card
- Headless-browser test harness for the camera orchestration in `public/app.js`

## Contributing

The easiest PR: **add an exercise**. It's one entry in `EXERCISES` in [`public/reps.js`](public/reps.js) — a joint triple per side, two angle thresholds, and a framing cue:

```js
overheadPress: {
  label: "overhead press",
  sides: [[L.hipL, L.shoulderL, L.elbowL], [L.hipR, L.shoulderR, L.elbowR]],
  downBelow: 60,   // elbows at shoulder height
  upAbove: 150,    // arms locked out overhead
  cue: "face the camera, whole torso in frame",
},
```

Add a case to `tests/reps.test.js`, run `npm test` (24 tests, node:test, no dependencies), and open a PR. Coach lines live in [`public/coach.js`](public/coach.js) — funny beats polite.

## License

[MIT](LICENSE). Built for people who told themselves they'd stretch between prompts and never did.
