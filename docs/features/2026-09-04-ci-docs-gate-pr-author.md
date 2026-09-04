# Feature: Docs gate binds to the PR author, not the run actor

**Branch:** ci/docs-gate-pr-author
**Date:** 2026-09-04 local (2026-09-04 UTC)

## Summary
The `docs-gate` job in `.github/workflows/pr-gate.yml` now skips when the pull request *author* is `dependabot[bot]` (`github.event.pull_request.user.login`), instead of when the run *actor* is (`github.actor`). Dependabot bumps keep skipping the docs requirement no matter who last touched the branch.

## Motivation
`github.actor` is whoever triggered the current run. Pressing "Update branch" on a Dependabot PR starts a new `pull_request: synchronize` run whose actor is the human who clicked, the skip stops firing, and the gate demands docs entries a bump PR will never have. (A plain re-run keeps the original actor; the person re-running only shows up as `github.triggering_actor`.) This happened live on langchain-fde-curriculum #9 (cryptography 49 → 50): the gate went red for a reason unrelated to the change and blocked the merge until Dependabot recreated the branch.

## What changed
- `.github/workflows/pr-gate.yml`: the docs-gate condition is now `github.event_name == 'pull_request' && github.event.pull_request.user.login != 'dependabot[bot]'`. The comment above it explains why the author, not the actor, is the right handle.
- Nothing else in the file.

## Notes
- The PR author is fixed for the life of the PR; the author check is also the one GitHub's Dependabot automation guidance recommends.
- Human and agent PRs are unaffected — their author is never `dependabot[bot]`, so the gate still runs and still requires both entries.
- Rolled out from langchain-fde-curriculum #11, where the identical diff was reviewed.
