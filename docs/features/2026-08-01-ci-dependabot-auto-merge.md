# Feature: Dependabot auto-merge for patch and minor bumps

**Branch:** ci/dependabot-auto-merge
**Date:** 2026-08-01 (UTC)

## Summary
Adds `.github/workflows/dependabot-auto-merge.yml`, ported from
`Tatendaz/Quant_Backtest_Platform` as part of an account-wide rollout. Dependabot
PRs that `dependabot/fetch-metadata` classifies as `semver-patch` or
`semver-minor` are approved and merged without a human; `semver-major` bumps are
left alone, because a breaking change can pass green CI.

## Motivation
Dependency PRs on this repo are almost entirely GitHub Actions SHA bumps — the
package has no `dependencies`, no `devDependencies` and no lockfile, so npm
updates are not a source of churn. Those Actions bumps are exactly the class of
change that is safe to merge on green CI and expensive to shepherd by hand: they
arrive one at a time, each needs an approval to satisfy this repo's
`required_approving_review_count: 1`, and none of them are interesting.

## What changed
- `.github/workflows/dependabot-auto-merge.yml` (new). Triggers on
  `pull_request` against `main`/`master`; the job is gated on
  `github.event.pull_request.user.login == 'dependabot[bot]'` — the PR author,
  which a later pusher cannot spoof, rather than `github.actor`.
  `dependabot/fetch-metadata` is pinned by SHA to v3.1.0. Approve and merge both
  run only for patch/minor. `permissions` is declared job-side
  (`contents: write`, `pull-requests: write`, `checks: read`) because
  Dependabot-triggered runs get a read-only token by default, and the repo
  default is `read` besides. `concurrency` cancels a superseded run per PR, and
  `timeout-minutes: 35` bounds the check-waiting loop.
- Repo settings, changed alongside this PR and not visible in the diff:
  `allow_auto_merge` enabled, and "Allow GitHub Actions to create and approve
  pull requests" enabled so the approve step can satisfy branch protection.

## Notes
- **Two merge paths, both pinned to the classified commit.**
  `gh pr merge --auto --squash` is tried first and waits for required status
  checks. `main` here has required reviews but no required status checks, so
  GitHub can reject `--auto` outright; the fallback then polls every *other*
  check run on the head commit (this job excluded) and refuses to merge if any
  concluded as something other than success/neutral/skipped. That keeps
  `Tests`, `Docs gate` and `Dependency review` gating the merge even though
  none of them is formally marked required. Both paths pass
  `--match-head-commit`, so a push landing mid-run cannot merge under the
  earlier patch/minor verdict.
- **The docs gate does not apply to Dependabot.** `pr-gate.yml` demands a
  `docs/features` + `docs/summaries` pair named after the branch slug, and
  Dependabot branches (`dependabot/github_actions/...`) will never carry one, so
  that check will be red on every bot PR. The fallback treats a failed sibling
  check as a hard stop, which means bot PRs will park rather than merge until
  the gate is taught to skip `dependabot[bot]`. Left for a follow-up: it is a
  change to `pr-gate.yml`'s contract, not to this workflow.
- **There is no `.github/dependabot.yml` in this repo yet**, so nothing is
  currently opening the PRs this workflow merges. The workflow is inert until
  one is added — harmless, and it means the config can land without a second
  round of settings changes.
