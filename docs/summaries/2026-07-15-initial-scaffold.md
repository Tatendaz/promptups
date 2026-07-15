# Session: PromptUps idea to public repo

**Branch:** main (initial commit)
**Date:** 2026-07-15

## Prompts

1. "I have an idea and can you help me create like an open source project for it? The idea is that whenever a vibe coder prompts Claude while they wait, the camera on the computer can scan them and they can do some exercises, like maybe some push-ups, sit-ups, so that they can get fit whilst they wait for Claude to reply back with an answer. Do you have any ideas what we could call this skill, I suppose? Should it be a skill? Should it be an app? What are your thoughts?"
2. "And maybe it could also use the iPhone camera or any other camera to kind of detect body movements and stuff."
3. "maybe it could have its own sub agent for humour and counting out loud the pushups and squats"
4. "ok looks good seems to work. Create the repo and push"
5. "create a nice read me and opensource it like we did for yapui"

## Steps taken
- Checked prior art (webcam rep counters exist; none wired to an AI-agent wait loop) and GitHub name collisions. User picked "PromptUps" over WaitLift/Compiling Gains/RepL, and squats + desk push-ups as the v0.1 exercise set (desk-camera-visible).
- Scaffolded the project: zero-dep Node server (SSE + hook endpoints + stats), CLI (`start`/`init`/`uninstall`), MediaPipe pose front end with gym-scoreboard styling, coach voice module with line banks and optional `claude -p` Haiku quips.
- Verified all endpoints end to end with curl, launched the app locally for the user; they confirmed rep counting works.
- Pre-push gate: extracted rep logic into `public/reps.js` for testability, made data/settings paths env-overridable, wrote 24 tests (rep counter, coach, server, CLI), all passing.
- Installed the pr-gate workflow from the skill assets, replaced its generic npm step (needs a lockfile) with plain `npm test`, and hardened branch-slug interpolation against workflow injection on fork PRs.
- Rewrote the README in the YapUI open-source style, ran the CodeRabbit pre-push review, created `github.com/Tatendaz/promptups` (public), and pushed.

## Decisions
- App + hooks, not a skill: a skill cannot run a camera while Claude generates; `UserPromptSubmit`/`Stop`/`Notification` hooks curling localhost can, at zero token cost.
- Port 7887 ("PU" on a phone keypad), 1-second curl timeouts so Claude Code never blocks on PromptUps.
- Coach humour ships as canned line banks by default; the AI coach is opt-in (`--ai-coach`) so nobody gets surprise API usage.
- Privacy stance: pose inference stays in the browser tab; only rep totals are stored, locally.
- `app.js` browser orchestration left untested by design (needs a headless-camera harness, roadmap item); everything with logic in it is tested.
