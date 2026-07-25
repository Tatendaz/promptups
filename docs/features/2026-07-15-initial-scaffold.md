# Feature: PromptUps v0.1 — reps while Claude thinks

**Branch:** main (initial commit)
**Date:** 2026-07-15

## Summary
Full v0.1 of PromptUps: a local web app that counts squats and desk push-ups on your webcam while Claude Code works, triggered by Claude Code hooks and narrated by a trash-talking coach voice.

## Motivation
Claude Code prompts take thirty seconds to five minutes. That idle time currently goes to social feeds. PromptUps turns it into exercise with zero workflow change: the set starts when you hit enter and ends with a chime when Claude replies.

## What changed
- `server.js`: zero-dependency Node server on port 7887. Static hosting, SSE event bus (`/events`), hook endpoints (`/promptups/start`, `/promptups/stop`), session stats persisted to `~/.promptups/sessions.json`, optional `/api/quip` AI-coach endpoint (shells out to `claude -p --model haiku`, off by default).
- `bin/promptups.js`: CLI. `start` (default, opens the page), `init` (installs `UserPromptSubmit`/`Stop`/`Notification` hooks into `~/.claude/settings.json` with consent + backup, idempotent), `uninstall` (removes only our hooks).
- `public/reps.js`: pose geometry + hysteresis rep counter (pure logic, no DOM), with smoothing and a minimum down-phase so jitter and bounces can't fake reps. Exercises are data: one `EXERCISES` entry per movement.
- `public/app.js`: browser orchestration. MediaPipe Tasks Vision pose landmarking (all in-tab, nothing uploaded), camera picker (iPhone works via Continuity Camera), skeleton overlay, session flow driven by SSE.
- `public/coach.js`: coach personality. Web Speech API counts reps aloud; line banks for start/milestone/finish/zero-rep/attention/roast moments; `--ai-coach` upgrade path with canned fallback.
- `tests/`: 25 tests across rep counting, coach, server endpoints, and CLI hook install/uninstall.
- `.github/workflows/pr-gate.yml`: server-side gate (tests, coverage-for-new-code, docs entries) with untrusted-input hardening for fork PR branch names.

## Notes
- `public/app.js` (DOM + camera + MediaPipe wiring) has no automated tests; its testable logic was deliberately extracted into `public/reps.js`, which does. A headless-browser harness is a roadmap item.
- Hooks curl with a 1-second timeout and ignore failure, so Claude Code is unaffected when PromptUps isn't running.
- First page load fetches the MediaPipe runtime and pose model from a CDN (~8.5 MB over the wire, of which the model is 5.8 MB); cached afterwards. The webfonts in `public/index.html` are refetched-or-revalidated on every load, so the page is not offline-clean.
