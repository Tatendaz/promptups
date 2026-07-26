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

A real Claude Code prompt takes thirty seconds to five minutes — an hour of dead time a day, currently donated to your X feed. PromptUps claims it back, with zero workflow change:

- ⌨️ **You hit enter** — the scoreboard goes orange and the coach says go.
- 🎥 **The camera counts** — MediaPipe pose landmarks, hysteresis thresholds, no honor system. Half reps don't count.
- 🗣️ **The coach talks** — every rep counted out loud, trash talk at milestones, a roast if you just stand there.
- 🔔 **Claude replies** — chime, rep summary, back to your diff.
- 📈 **Stats accrue** — today, all time, best set, prompts survived.

## Quick start

You need **Node 18+, `git`, and `curl`** (the hooks are `curl` one-liners). There is nothing to `npm install` — the dependency count is zero.

```bash
git clone https://github.com/Tatendaz/promptups && cd promptups
node bin/promptups.js init    # shows the hooks, asks first, backs up settings.json
node bin/promptups.js         # starts the server, opens http://localhost:7887
```

Allow camera access, pick your exercise, then go prompt Claude in your terminal — the page reacts on its own from there. First load pulls MediaPipe from two CDN origins (~8.5 MB over the wire, cached after — [full origin inventory](docs/usage.md#network-origins)). **Keep the page visible**: a hidden or covered tab counts zero reps. Not ready to wire the hooks? Hit **test drive** in the header to fake a prompt.

Custom ports, env vars, and why the tab must stay visible: **[docs/usage.md](docs/usage.md)**.

## How it works

```text
you hit enter  ──► UserPromptSubmit ──► POST /promptups/start                 ──► camera counts reps
Claude replies ──► Stop             ──► POST /promptups/stop?reason=done      ──► chime + set summary
Claude asks    ──► Notification     ──► POST /promptups/stop?reason=attention ──► amber alert + set summary
```

`init` writes three hooks into `~/.claude/settings.json`:

| Claude Code event | What PromptUps does |
| --- | --- |
| `UserPromptSubmit` | Starts a set. Scoreboard orange, coach says go. |
| `Stop` | Ends the set. Chime, summary, back to work. |
| `Notification` | "CLAUDE NEEDS YOU" — amber alert. Hits the **same stop endpoint** as `Stop`, so the set ends here too. |

That third row means a permission prompt mid-squat ends your set early — counted sets are banked, zero-rep sets and test drives are not. The full trade-off and how to opt out: [docs/usage.md](docs/usage.md#the-notification-trade-off).

Each hook is a `curl` with a 1-second timeout that ignores failure, so Claude Code behaves identically whether PromptUps is running or not. The page listens on a server-sent-events stream and does everything else itself.

## The coach

Every rep is counted out loud through the Web Speech API, with opinions:

> "Twenty-five seconds. Zero reps. The camera sees everything."

The default line banks work offline; `node bin/promptups.js --ai-coach` swaps end-of-set lines for a `claude -p` Haiku one-liner instead. Mute it with the **voice** button. More in [docs/usage.md](docs/usage.md#the-coach-in-detail).

## Cameras

The picker lists every video device the browser can see: built-in webcam for desk work, **iPhone via Continuity Camera** (automatic on macOS), any USB webcam. Details: [docs/usage.md](docs/usage.md#cameras).

## Exercises

v0.1 ships the two a desk camera can actually see:

| Exercise | Counted from | Thresholds |
| --- | --- | --- |
| Squats | knee angle (hip–knee–ankle) | down < 110°, up > 155° |
| Desk push-ups | elbow angle (shoulder–elbow–wrist) | down < 105°, up > 150° |

Both run through a hysteresis state machine with smoothing and a minimum down-phase, so landmark jitter and quick bounces can't inflate your numbers. The camera is honest.

## Privacy

Every camera frame is processed by MediaPipe **inside your browser tab** and discarded. No frame is recorded, none is uploaded, no pixel of you reaches a server. That is what the badge means, and it is the claim that matters.

The page is not offline, though: it pulls the MediaPipe runtime and pose model from two CDNs (once, then cached) and two Google webfonts. None of those origins ever receive camera data — they see only the ordinary metadata any web request carries. In default mode everything else is localhost; run with `--ai-coach` and the server also makes one short `claude -p` call per set to Anthropic through your own Claude account. The full origin inventory: [docs/usage.md](docs/usage.md#network-origins). Session totals (exercise, reps, timestamps) live in `sessions.json` under `$PROMPTUPS_DATA_DIR`, defaulting to `~/.promptups`.

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

The easiest PR: **add an exercise**. Two edits — an entry in `EXERCISES` in [`public/reps.js`](public/reps.js) and a matching button in [`public/index.html`](public/index.html) — plus a case in `tests/reps.test.js`, then `npm test` (57 tests, node:test, nothing to install). The worked example lives in **[CONTRIBUTING.md](CONTRIBUTING.md)**, along with the CI conventions you can't guess from the code: branch naming, and two docs files per PR.

## License

[MIT](LICENSE). Built for people who told themselves they'd stretch between prompts and never did.
