# 🏋️ PromptUps

Prompt Claude. **Drop and give me ten.**

Every time you prompt [Claude Code](https://claude.com/claude-code), your webcam turns into a rep counter — squats and desk push-ups counted out loud by a trash-talking coach — and a chime tells you the second your code is ready. **The AI gets smarter. Now you get stronger.**

[GitHub →](https://github.com/Tatendaz/promptups) [Roadmap](https://github.com/Tatendaz/promptups/blob/main/ROADMAP.md)

```
# clone, wire the hooks (it asks first), go
git clone https://github.com/Tatendaz/promptups && cd promptups
node bin/promptups.js init
```

![PromptUps demo: submitting a Claude Code prompt turns the scoreboard orange, the webcam counts squats as the coach calls each rep, and a chime marks Claude's reply](https://tatendaz.github.io/promptups/demo.gif)

*Hit enter. The scoreboard goes orange and the coach starts counting.*

## Why

A real Claude Code prompt takes thirty seconds to five minutes. Multiply by every prompt in a vibe-coding session and you're sitting on **an hour of dead time a day** — currently donated to your X feed.

PromptUps claims it back, with **zero workflow change**.

- **⌨️ You hit enter** The scoreboard goes orange and the coach says go.

- **🎥 The camera counts** MediaPipe pose landmarks, hysteresis thresholds, no honor system. Half reps don't count.

- **🗣️ The coach talks** Every rep counted out loud, trash talk at milestones, a roast if you just stand there.

- **🔔 Claude replies** Chime, rep summary, back to your diff.

- **📈 Stats accrue** Today, all time, best set, prompts survived.

## How it works

```
you hit enter ──► UserPromptSubmit hook ──► POST /promptups/start ──► camera counts reps
Claude replies ──► Stop hook             ──► POST /promptups/stop  ──► chime + set summary
```

`init` writes three hooks into `~/.claude/settings.json` — it shows them to you, asks first, and backs up the file:

| Claude Code event | What PromptUps does |
|---|---|
| `UserPromptSubmit` | Starts a set. Scoreboard orange, coach says go. |
| `Stop` | Ends the set. Chime, summary, back to work. |
| `Notification` | "CLAUDE NEEDS YOU" — amber alert, back to the keyboard. |

Each hook is a `curl` with a one-second timeout that ignores failure, so **Claude Code behaves identically whether PromptUps is running or not**. The page listens on a server-sent-events stream and does everything else itself.

## The camera is honest

| Exercise | Counted from | Thresholds |
|---|---|---|
| Squats | knee angle (hip–knee–ankle) | down < 110°, up > 155° |
| Desk push-ups | elbow angle (shoulder–elbow–wrist) | down < 105°, up > 150° |

Both run through a hysteresis state machine with smoothing and a minimum down-phase, so landmark jitter and quick bounces can't inflate your numbers.

## The coach

The coach counts every rep through the Web Speech API and has opinions:

> "Twenty-five seconds. Zero reps. The camera sees everything."

Default mode uses built-in line banks and works offline. Start with `--ai-coach` and end-of-set lines come from a `claude -p` Haiku call instead — one short generation per set, with the line bank as fallback. Mute it with the **voice** button; your household has opinions too.

## Privacy

Every camera frame is processed by MediaPipe **inside your browser tab** and discarded. No camera frame is recorded or uploaded — no pixel of you reaches a server. The page pulls the MediaPipe runtime and pose model from CDNs on first load (~8.5 MB, cached after) plus two Google webfonts — none of those origins receive camera data. In default mode everything else is localhost; with `--ai-coach` the server also makes one `claude -p` call per set to Anthropic under your own account. Session totals — exercise, reps, timestamps — live in `~/.promptups/sessions.json`.

## Quick start

```
git clone https://github.com/Tatendaz/promptups && cd promptups
node bin/promptups.js init    # shows the hooks, asks first, backs up settings.json
node bin/promptups.js         # starts the server, opens http://localhost:7887
```

Allow camera access, pick your exercise, then go prompt Claude in your terminal — the page reacts on its own from there. **No dependencies to install:** the server is Node's `http` module. Not ready to wire the hooks? Hit **test drive** in the header at `localhost:7887` to fake a prompt.

## FAQ

### Which cameras work?

Any the browser can see. The built-in webcam handles squats and desk push-ups. An iPhone via Continuity Camera shows up automatically on macOS — prop it against a wall and the floor comes into frame, which is what real push-ups and sit-ups need. USB webcams work too.

### What's next?

Seated arm exercises (v0.2), standing exercises for the 1 m × 1 m box in front of your desk with squats counted from head movement (v0.3), then AirPods head-motion tracking so the camera becomes optional (v0.4) — then calories, streaks, and Apple Watch. The full plan is in [ROADMAP.md](https://github.com/Tatendaz/promptups/blob/main/ROADMAP.md).

### How do I add an exercise?

It's the easiest PR: one entry in `EXERCISES` in `public/reps.js` — a joint triple per side, two angle thresholds, and a framing cue — plus a button in `public/index.html` and a case in `tests/reps.test.js`. Run `npm test` (57 tests, `node:test`, no dependencies) and open a PR. Coach lines live in `public/coach.js`; funny beats polite.

### How do I uninstall it?

`node bin/promptups.js uninstall` removes only its own hooks and backs up `settings.json` first. `rm -rf ~/.promptups` if you also want your stats gone.

---

HTML version: https://tatendaz.github.io/promptups/ · Source: https://github.com/Tatendaz/promptups · More work: https://tatendaz.github.io/ · Agent guide: https://tatendaz.github.io/llms.txt
