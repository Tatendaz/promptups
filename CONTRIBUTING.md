# Contributing

PromptUps is small, has zero dependencies, and PRs are genuinely welcome. The
easiest one is [adding an exercise](#the-easiest-pr-add-an-exercise) — about
eight lines and a test case.

Before you start: **two of the three CI checks enforce conventions you cannot
guess from reading the code.** Here they are, up front, so your first PR isn't
red for reasons nobody told you about:

1. Branch as `<type>/<slug>`. Not `patch-1`.
2. Every PR adds **two** markdown files named after that slug.
3. Every source change comes with a test change.

The rest of this file is the long version.

## Setup

Node 18 or newer. That is the entire list.

```bash
git clone https://github.com/<your-fork>/promptups && cd promptups
npm test
```

**There is no install step, and that is on purpose.** PromptUps declares no
`dependencies` and no `devDependencies`, so there is no lockfile either. `npm ci`
will fail with `EUSAGE` — don't run it, there is nothing to install. Please don't
add a `package-lock.json` unless you are also adding a dependency, and expect to
have to argue for the dependency.

`npm test` is `node --test`, Node's built-in runner. 57 tests at the time of
writing, about seven seconds. They need no network, no camera, no API key and no
browser. CI runs the exact same command on Node 18, 20, 22 and 24, so if it
passes locally it passes there.

The app itself:

```bash
node bin/promptups.js --help    # usage
node bin/promptups.js           # starts the server, opens http://localhost:7887
```

## Branch names are load-bearing

Use `<type>/<slug>`, where `<type>` is one of `feat`, `fix`, `docs`, `chore`,
`refactor` or `test`:

```
feat/add-overhead-press
fix/rep-counter-bounce
docs/contributing
```

CI strips the `<type>/` prefix and uses the `<slug>` to look for the docs files
described below. Get the slug wrong and the docs gate fails, no matter what your
code does.

> **Do not edit files through GitHub's web UI.** The "Edit this file" pencil
> creates a branch called `patch-1`. The slug becomes `patch-1`, CI goes looking
> for `docs/features/<date>-patch-1.md`, doesn't find it, and fails. Make a
> properly-named branch instead.

## What every PR must contain

Two markdown files, both named with the same date and the same slug as your
branch. This repo keeps a written record of what changed *and* of the prompts
behind it — that is the point of the project.

On branch `feat/add-overhead-press`, on 2026-07-25:

```
docs/features/2026-07-25-add-overhead-press.md    what changed and why
docs/summaries/2026-07-25-add-overhead-press.md   the session/prompt log
```

The date is when you wrote it; CI only matches the slug, so it will not argue
about the date. Copy the format from the pair that already exists:

- [`docs/features/2026-07-15-initial-scaffold.md`](docs/features/2026-07-15-initial-scaffold.md)
  — headed `# Feature: <title>`, then **Branch** / **Date**, then
  `## Summary`, `## Motivation`, `## What changed` (one bullet per file or area)
  and `## Notes` for anything surprising.
- [`docs/summaries/2026-07-15-initial-scaffold.md`](docs/summaries/2026-07-15-initial-scaffold.md)
  — headed `# Session: <title>`, then `## Prompts` (the actual prompts you or
  your agent used, quoted), `## Steps taken`, and `## Decisions` for the calls
  you made and why.

If you wrote the change by hand rather than by prompting, say so in `## Prompts`.
An honest "written by hand, no prompts" is a perfectly good entry.

## Every source change needs a test

CI fails any PR that touches a source file without touching a test file. Not
just `public/reps.js` — any `.js` outside `tests/`, `docs/` and `.github/`.

In practice that means: change `public/reps.js`, add a case to
`tests/reps.test.js`. Change `server.js`, add a case to `tests/server.test.js`.
Change `bin/promptups.js`, add a case to `tests/cli.test.js`.

### The one exception: `public/app.js`

`public/app.js` is browser-only — camera, canvas, `EventSource`, speech
synthesis, MediaPipe. There is no headless harness for it yet (it's on the
[roadmap](README.md#roadmap)), so it has no test file of its own and the gate
cannot be satisfied by editing it alone.

**Do not fake-touch an unrelated test to get around this.** The rule is that
anything with a decision in it lives in a module that node:test can import:

| File | What lives there |
| --- | --- |
| [`public/reps.js`](public/reps.js) | pose geometry, the rep-counting state machine |
| [`public/session.js`](public/session.js) | set lifecycle, SSE event routing, timer/banner/camera-picker logic |
| [`public/coach.js`](public/coach.js) | line banks, the shuffle bag, the AI-coach fallback |
| `public/app.js` | wiring only — it should read as a list of delegations |

If your change belongs in `app.js`, the odds are good that the interesting half
of it belongs in `session.js` instead, where you can test it. If you are truly
stuck — a change that genuinely cannot be unit-tested — say so in the PR
description and a maintainer can apply the `skip-docs-gate` label, which skips
that check. Ask; don't work around it.

## What has to be green

These are the required checks, by name:

| Check | Where | What it wants |
| --- | --- | --- |
| `Tests (Node 18)` `(Node 20)` `(Node 22)` `(Node 24)` | `.github/workflows/ci.yml` | `npm test` passes on every supported Node |
| `Package smoke test` | `.github/workflows/ci.yml` | the npm tarball installs and the CLI runs from it |
| `Docs gate (features + summaries)` | `.github/workflows/pr-gate.yml` | the two markdown files above exist |
| `New code has new tests` | `.github/workflows/pr-gate.yml` | your diff touches tests if it touches source |

`main` is protected. Pull requests are the only way in, and every PR needs:

- all required checks green,
- all review conversations resolved,
- **one approving review from a code owner** ([@Tatendaz](https://github.com/Tatendaz), see [`.github/CODEOWNERS`](.github/CODEOWNERS)).

GitHub does not let you approve your own pull request, so every contribution
gets a second pair of eyes before it lands.

## Your first PR will look stuck. It isn't.

On your very first PR to this repo, GitHub holds the workflow runs and shows
**"1 workflow awaiting approval"** with a grey box instead of check results.
That is GitHub's first-time-contributor policy for public repos, not a broken
build and not something you did. A maintainer clicks "Approve and run" and the
checks start. Later PRs from you run immediately.

Nothing to do but wait — and please don't close and reopen the PR to try to
kick it, that just resets the clock.

## What never goes in a PR

No secrets, API keys, tokens or `.env` files. Ever.

You should not be tempted: CI uses no secrets at all — there is not one
`secrets.*` reference in either workflow — and the app needs no credentials. The
workflows use `pull_request`, not `pull_request_target`, so code from a fork
never runs with access to this repo's token.

`.gitignore` covers `node_modules/`, `.DS_Store` and `*.log`. It does **not**
cover `.env` or `~/.promptups/sessions.json`, so check `git status` before you
commit. Session stats are personal data — yours — and don't belong in the repo.

## The easiest PR: add an exercise

One entry in `EXERCISES` in [`public/reps.js`](public/reps.js) — a joint triple
per side, two angle thresholds, and a framing cue:

```js
overheadPress: {
  label: "overhead press",
  sides: [[L.hipL, L.shoulderL, L.elbowL], [L.hipR, L.shoulderR, L.elbowR]],
  downBelow: 60,   // elbows at shoulder height
  upAbove: 150,    // arms locked out overhead
  cue: "face the camera, whole torso in frame",
},
```

Then add a button for it in [`public/index.html`](public/index.html) next to the
other `.exercise-btn`s, add a case to
[`tests/reps.test.js`](tests/reps.test.js) driving a counter through a rep, run
`npm test`, write your two docs files, and open the PR.

Pick thresholds you have actually stood in front of a camera and tested. The
whole promise of this project is that the numbers are honest.

Coach lines live in [`public/coach.js`](public/coach.js) — funny beats polite.

## Style

There is no linter and no formatter, deliberately. Match the file you're in:
two-space indent, double quotes, semicolons, ESM `import`/`export`, and comments
that explain *why* rather than restating the code. Keep the voice: this project
talks like a gym, not like a compliance document.
