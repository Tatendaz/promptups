# Feature: CI hardening, testable session logic, and contributor docs

**Branch:** chore/ci-hardening-and-contributor-docs
**Date:** 2026-07-25

## Summary
An audit of the repo's CI and contributor experience found twelve defects in
`pr-gate.yml`, a CLI subcommand that hangs forever, and a coverage gate that was
literally unsatisfiable for `public/app.js`. This change fixes all three
categories: testing moves to a new hardened `ci.yml` that runs on `main` as well
as pull requests, the decision-making half of `app.js` moves into a testable
`public/session.js`, and `CONTRIBUTING.md` finally writes down the conventions
CI has been silently enforcing since v0.1.

## Motivation
Three separate problems, one root cause — the gate was imported wholesale from a
personal pre-push workflow without the documentation that made it navigable.

- **`main` was untested and unprotected.** `pr-gate.yml` declared only a
  `pull_request` trigger, so all three commits on `main` landed with zero CI.
- **The gates were undocumented.** Two of the three jobs enforce a branch-naming
  convention and a docs-file convention that appear in no file a contributor
  would read. A drive-by contributor using GitHub's "Edit this file" button gets
  a `patch-1` branch and two red checks with no actionable guidance.
- **The coverage gate was unsatisfiable for `public/app.js`.** The extension
  filter matches `.js`, and `app.js` is the one source file with no test by
  design. Anyone fixing a camera bug there was hard-blocked, and the rational
  move was to fake-touch an unrelated test file — the gate was training people
  to defeat it.

## What changed
- `.github/workflows/ci.yml` (new): owns testing. Runs on `push: [main]` and on
  every pull request. Matrix Node 18/20/22/24 (what `engines.node: ">=18"`
  actually claims; all four verified green). `permissions: contents: read`,
  `concurrency` with `cancel-in-progress` on PRs only, `timeout-minutes` on
  every job, `persist-credentials: false` on every checkout, and
  `actions/checkout` / `actions/setup-node` pinned by SHA to v7.0.1 / v7.0.0 —
  both `using: node24`, which retires the "Node.js 20 is deprecated" annotation
  that was firing on every run. No `cache: npm`: there is no lockfile and the
  cache step hard-fails without one. Adds a package smoke test that packs the
  tarball, installs it, and runs the CLI out of it.
- `.github/workflows/pr-gate.yml`: keeps only the two PR-only convention gates,
  so exactly one file owns the `Tests` check. Dropped the `actions/setup-python`
  step that installed Python 3.11 and was never invoked. Fixed `wc -l` reporting
  "1 file(s)" for an empty result, and a `^test_` pattern that sat inside a
  `$`-anchored alternation and so only ever matched the literal `test_`. Added
  `.mjs`/`.cjs` to every extension list, plus `permissions`, `concurrency` and
  `timeout-minutes`. Still no `push:` trigger, and both jobs now carry an
  explicit event guard: `github.head_ref` is empty off-PR, which collapses the
  docs slug to `""` and makes the gate pass without checking anything.
- `public/session.js` (new): the set state machine and every pure decision
  `app.js` used to inline — `SessionTracker`, `routeEvent`, `endBanner`,
  `formatDuration`, `sessionPayload`, `shouldLogSession`, `chimeNotes`,
  `summaryLine`, `cameraConstraints`, `cameraOptions`, `pickCamera`. No DOM, no
  MediaPipe, no `fetch`, same as `reps.js` and `coach.js`.
- `public/app.js`: keeps only what needs a browser and delegates the rest. Still
  a plain `<script type="module">` — `server.js` serves `public/` flat, so
  `./session.js` resolves to `/session.js` with no bundler and no import map.
- `bin/promptups.js`: `--help` / `-h`, `--version` / `-v`, and a non-zero exit
  with usage for unknown subcommands. All three previously fell through to
  `start()`, which boots the server and never returns.
- `tests/session.test.js` (new, 26 cases) and a case in `tests/server.test.js`
  that walks the module graph the way a browser does. `tests/cli.test.js` gains
  five cases for the flag handling. 25 tests to 57.
- `CONTRIBUTING.md` (new), `.github/CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`.
- `README.md`: corrected the "24 tests" count and pointed the Contributing
  section at `CONTRIBUTING.md` rather than duplicating it.

## Notes
- **The `Tests` check name now lives in `ci.yml` only.** `pr-gate.yml`'s `tests`
  job is gone; keeping both would have produced two competing check names for
  branch protection to disagree about.
- The `app.js` refactor was verified in a real browser, not just by unit test:
  the page was loaded from a running `server.js`, all four modules fetched 200,
  MediaPipe initialised, and a `start` / `stop?reason=attention` / `stop` cycle
  driven through the real hook endpoints produced the correct scoreboard, banner
  and coach lines. `tests/server.test.js` now guards that path in CI.
- `coverage-for-new-code` honours a `skip-docs-gate` label, which the PR
  template promises. Only someone with write access can apply one.
- The `docs/features/2026-07-15-initial-scaffold.md` "24 tests" line was left
  alone: it is a dated record of what that commit contained, not a live count.
- Still no lint, format or typecheck job, because no such tooling exists in the
  repo. Still no deploy job — `server.js` binds `127.0.0.1` only.
