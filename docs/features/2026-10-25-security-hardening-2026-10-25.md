# Feature: Dependency cooldown and workflow lint

**Branch:** security/hardening-2026-10-25
**Date:** 2026-10-25 local (2026-10-25 UTC)

## Summary
Dependabot now opens at most one batched PR per ecosystem per month, and only
for releases at least 7 days old. A new `zizmor` workflow fails any PR that
adds a high-severity workflow issue.

## Motivation
Several worms in August to October 2026 shipped as new versions of trusted
packages and were pulled within days. A 7-day wait skips most of them. zizmor
caught two unpinned actions in `dependency-review.yml` in the 2026-10-25 sweep
(#17); the job keeps that from coming back.

## What changed
- `.github/dependabot.yml` (new): `npm` and `github-actions`, monthly,
  `cooldown.default-days: 7`, one minor+patch group each, at most 3 open PRs.
- `.coderabbit.yaml` (new): `reviews.auto_review.ignore_usernames:
  ["dependabot[bot]"]`, so Dependabot PRs do not spend CodeRabbit reviews.
- `.npmrc` (new): `min-release-age=7`. npm 11.10+ reads it; older npm warns
  and ignores it.
- `.github/workflows/zizmor.yml` (new): `zizmor==1.31.1 --min-severity high`.
- `.github/workflows/dependabot-auto-merge.yml`: top-level token is now
  `contents: read`; the write scopes moved onto the one job that needs them.

## Notes
- Security updates ignore the Dependabot cooldown, so advisories still get a
  PR the same day.
- The `npm install` in `ci.yml` stays. It installs the repo's own packed
  tarball, which has no dependencies, so nothing comes from the registry.
