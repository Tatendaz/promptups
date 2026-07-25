# Session: README correctness pass, second attempt

**Branch:** docs/readme-slim
**Date:** 2026-07-25

## Prompts

1. "Slim the README." (first pass — wrong premise, cut 134 lines to 67; reverted)
2. "That was wrong. This README needs no cut — it needs 4 correctness fixes plus 4 one-liners. Reset to origin/main and start from the audit."

## Steps taken
- Reset `docs/readme-slim` to `origin/main`, discarding the 67-line draft (recoverable at `434624c`). No prose was recovered from it; no doc extraction was wanted.
- Re-verified every claim in the audit against source before writing, rather than trusting it: the four network origins, the two-edit exercise picker, the `Notification`-to-stop-endpoint path, and the test count.
- Measured the CDN payload over the wire with `curl` (br/gzip accepted, Chrome UA) rather than quoting a figure: 8,536,811 bytes across the MediaPipe runtime, WASM, pose model, Google Fonts stylesheet and the five latin `woff2` subsets.
- Ran the full suite (`npm test`, no scoping): 25 tests, 25 pass, 0 fail.
- Traced the stale test count to its source: `816f40a` added a test to `tests/cli.test.js` and left three documents saying 24. Fixed all three.
- Fixed the README, then trimmed the first draft of the fix from 174 to 151 lines by folding a privacy table back into a paragraph and dropping a new `### Flags` heading, so the `##` section-heading outline stays unchanged from `origin/main` (the tagline H2 was demoted to bold on purpose, so the full outline is not identical).

## Decisions
- **Documented the exercise picker's two edits instead of rendering it from `EXERCISES`.** The audit offered either. Rendering it is a product change on a docs branch, it touches DOM code that has no test harness in a zero-dependency repo (the harness is an open roadmap item), and `pr-gate.yml:81-97` would require a test change for the `public/app.js` diff that could not be written honestly. Documenting both edits also lets the README name the actual trap, which is that `npm test` passes on a half-finished exercise.
- **Fixed the `overheadPress` snippet's threshold rather than its comment.** `downBelow: 60` with the comment "elbows at shoulder height" is contradictory; shoulder height on a `hip–shoulder–elbow` triple is ~90°. Changed the number to 90 so a copied snippet counts reps, since the number is the part that has to be right.
- **Extended the ASCII diagram to three rows rather than replacing it with prose,** and kept the real `?reason=done` / `?reason=attention` query strings even though they widen it to 107 columns. Abbreviating the paths would have reintroduced the defect class being fixed.
- **Kept the `Notification` hook rather than proposing its removal.** It is a genuine trade-off, not a bug — you want to know Claude is blocked. The README now states the cost and how to opt out.
- Left `PROMPTUPS_SETTINGS` undocumented; it is a test seam, unlike `PROMPTUPS_DATA_DIR` and `PROMPTUPS_PORT`, which are user-facing.
- Did not push and did not open a PR, per instruction.
