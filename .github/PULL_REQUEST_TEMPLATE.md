<!--
Thanks for contributing! The checklist below records this repository's
contribution requirements. CI enforces some of them — the tests, the
source-needs-tests rule and the docs entries. The rest (branch naming,
no secrets) a reviewer checks by eye, so a green build does not by itself
mean the checklist is satisfied.
-->

## What this changes

<!-- One or two sentences. What does this do, and why? -->

## Why

<!-- The problem being solved, or the capability being added. Link an issue with "Closes #N" if there is one. -->

## Checklist

- [ ] **Branch is named `<type>/<slug>`** — one of `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`.
      GitHub's web "Edit this file" button creates branches named `patch-1`, which fails the docs gate.
- [ ] **Tests pass locally.** `npm test` — there is no install step, this repo has zero dependencies.
- [ ] **Source changes come with test changes.** CI hard-fails a source-only diff.
      `public/app.js` has no test file of its own: put the logic in `public/session.js` and test it there.
      If your change genuinely cannot be unit-tested, say why here and a maintainer will apply the `skip-docs-gate` label.
- [ ] **`docs/features/<YYYY-MM-DD>-<slug>.md` exists** describing what changed and why.
- [ ] **`docs/summaries/<YYYY-MM-DD>-<slug>.md` exists** — this repo requires it, and it logs the prompts behind the change.
- [ ] **No secrets, API keys, or `.env` files** are included in the diff.

## Notes for the reviewer

<!-- Anything surprising, any tradeoff you made, anything you want a second opinion on. Delete if not needed. -->
