# Feature: README correctness pass

**Branch:** docs/readme-slim
**Date:** 2026-07-25

## Summary
Six drifted claims corrected (the privacy origins, the one-edit exercise
instruction, the sample snippet's threshold, the `Notification` row, the test
count, the download size), three missing pieces added (prerequisites, the
tab-visibility warning, `--port` and its companions), and one outline cleanup
(the tagline H2 demoted to bold) in `README.md`. No rewrite and no cut: the structure, ordering, length and voice were already good, and every `##` section heading is unchanged (the one outline change is the tagline H2, deliberately demoted to bold text — see below). The defect class here is drift — claims that were true when written and rotted underneath working prose.

## Motivation
A cold audit against source found that the README's privacy sentence, its flagship "easiest PR" instruction, its hook table and its test count had all drifted away from the code. Two of those are high-consequence: the privacy sentence sits under a trust badge that links directly to it, and the "easiest PR" instruction is the first thing a new contributor follows.

## What changed
- **Privacy (`## Privacy`)**: the old sentence claimed "the only network traffic is the one-time CDN fetch of the pose model, and localhost." There are four origins. `public/index.html:8-10` hits `fonts.googleapis.com` and `fonts.gstatic.com` on *every* page load; `public/app.js:9,302` pulls the MediaPipe runtime and WASM from `cdn.jsdelivr.net`; `public/app.js:307` pulls the pose model from `storage.googleapis.com`. All four are now named, with which ones are cached and which recur. The in-tab pose claim the badge actually makes is true and was kept, and stated more strongly.
- **Contributing**: "add an exercise" is two edits, not one. `public/index.html:47-48` hardcodes both exercise buttons and `public/app.js:237` only wires `.exercise-btn` elements that already exist; nothing iterates `EXERCISES`. The README now documents both edits and names the trap — `npm test` passes on a half-finished exercise because `tests/reps.test.js` covers geometry, not the UI. Rendering the picker from `EXERCISES` is flagged as a welcome PR instead of being done here, since it is a product change on a docs branch and there is no DOM test harness (roadmap item).
- **Contributing, sample snippet**: the `overheadPress` example had `downBelow: 60` commented "elbows at shoulder height." With the joint triple `hip–shoulder–elbow`, upper arms level with the shoulders is ~90°, so a contributor copying the snippet would build an exercise that counts zero reps. Threshold corrected to 90 and the comment made geometric.
- **How it works**: the `Notification` hook was documented as an amber alert only. `bin/promptups.js:34` POSTs it to the same stop endpoint as `Stop` (`?reason=attention`), so `public/app.js:231` calls `endSession`, which banks the set to `/api/session` and stops counting. The ASCII diagram was extended with a third arrow (not replaced), the hook table row now says the set ends, and a paragraph explains the consequence and how to opt out.
- **Test count**: 24 → 25 in the README and in the two `docs/` entries that repeated it. The 25th test arrived in `816f40a` (`tests/cli.test.js`) and no document was updated.
- **Prerequisites**: Node 18+ (`package.json` `engines`), `git` and `curl` were required by the quick start and named nowhere. Added above the install block.
- **Download size**: "about 5 MB" was measured at ~8.5 MB over the wire (br/gzip accepted): 5.78 MB model + 2.61 MB WASM + 53 KB WASM loader + 40 KB runtime + 54 KB webfonts.
- **Visibility**: the whole pose pipeline is `requestAnimationFrame` (`public/app.js:191,319`) and there is no `visibilitychange` handler anywhere in the tree, so a hidden or fully occluded tab counts nothing. Added a warning, including the note that the screen wake lock at `public/app.js:322` does not help.
- **`--port`**: previously undocumented. `bin/promptups.js:31-35` bakes the port into the hook commands `init` writes, so `init` followed by `start --port=8000` dead-ends silently — and `init --port=8000` does not repair it, because `bin/promptups.js:70-74` sees hooks installed and exits. Documented the `uninstall` → `init --port=N` sequence, plus `PROMPTUPS_PORT`, `--yes` and `PROMPTUPS_DATA_DIR`.
- **Lead tagline**: `## Prompt Claude. Drop and give me ten.` was an H2 wearing a tagline — it polluted GitHub's auto-generated outline with a non-section entry. Now bold text. No inbound links to its anchor exist (verified tree-wide); the two anchors that are linked, `#privacy` and `#contributing`, are untouched.

## Notes
- 134 → 151 lines. The target was "stays ~134" and no cut was warranted, but four of the eight items were additions of information that did not exist in the file. Every `##` heading in the file is identical to `origin/main`; the only outline change is the removed tagline H2.
- No product code was changed, so `pr-gate.yml`'s coverage-for-new-code job has no source diff to match against tests.
- Full suite: 25/25 passing on Node v22.23.1.

## Review follow-up (2026-07-26)

An independent review pass verified all of the above against source (all claims
held) and then finished the half of the original brief this branch had skipped:
the slim. Numbers in the Notes above describe the pre-merge state and are
superseded — after merging `main` (which brought `public/session.js` and grew
the suite to 57 tests) the README stood at 155 lines.

- **README.md**: restructured from 155 to 117 lines. Identity, quick start,
  the hook diagram/table, exercises, privacy, uninstall, roadmap and a compact
  contributing pointer stay; every deep-dive paragraph (ports, tab visibility,
  the Notification trade-off, the four network origins, cameras, coach modes)
  moved to `docs/usage.md` and is linked from the section it left. The
  `#privacy`, `#contributing` and `#roadmap` anchors (badges and
  CONTRIBUTING.md link into them) are unchanged.
- **docs/usage.md**: new home for the moved detail. Also corrects a
  merge-drifted attribution: the bank-or-drop gate is `shouldLogSession` in
  `public/session.js` now, not inline in `public/app.js`.
- **CONTRIBUTING.md**: the `overheadPress` snippet still carried the old
  `downBelow: 60 // elbows at shoulder height` defect this branch fixed in the
  README — corrected to 90 with the geometric comment, and the button step now
  shows the exact markup plus the "npm test passes anyway" trap.
- **docs/index.html**: still said "24 tests" (JSON-LD and rendered FAQ, now
  57, plus the button edit) and still carried the old one-origin/5 MB privacy
  sentence (now the corrected runtime+model ~8.5 MB claim).
- Suite after the changes: 57/57 passing.
