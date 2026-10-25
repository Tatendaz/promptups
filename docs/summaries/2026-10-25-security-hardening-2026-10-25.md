# Session: Dependency cooldown and workflow lint

**Branch:** security/hardening-2026-10-25
**Date:** 2026-10-25 local (2026-10-25 UTC)

## Prompts
1. Owner-approved phase 2 of the 2026-10-25 security sweep: Dependabot config with a 7-day cooldown, package-manager cooldown, CI lockdown.

## Steps taken
- Checked each key before use: Dependabot `cooldown`, `groups.update-types` and `open-pull-requests-limit` in the schemastore schema; `min-release-age` in the npm 11.20.0 config docs.
- Validated `dependabot.yml` with `check-jsonschema` against the schemastore schema.
- Added the zizmor workflow and confirmed `--min-severity high` exits 14 on an unpinned action and 0 on this repo.
- After the backup review on Vergance #19: switched the gate to `--min-severity medium .`, so it also checks `dependabot.yml` (removing the cooldown is a medium finding).
- Coordinator update: dropped `.coderabbit.yaml` (Dependabot PRs need CodeRabbit's review so the merge job can merge them) and added the owner's `merge-when-clean.yml` template unchanged.
- Coordinator update: deleted `dependabot-auto-merge.yml`; it merged Dependabot PRs with no review, and merge-when-clean v2 covers them.

## Decisions
- **zizmor through `pipx run` with a pinned version**, not a marketplace action: no extra third-party action to pin and trust.
- **Kept `npm install` in the package smoke test.** It installs a local tarball with zero dependencies.
