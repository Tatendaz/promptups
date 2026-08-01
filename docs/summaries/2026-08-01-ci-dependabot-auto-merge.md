# Session: Dependabot auto-merge rollout

**Branch:** ci/dependabot-auto-merge
**Date:** 2026-08-01 (UTC)

## Prompts
This repo was one target of an account-wide rollout driven by an agent, so the
prompt below is the instruction that reached this repo rather than a verbatim
transcript of the owner's words:

1. "Add the owner-approved Dependabot auto-merge workflow to Tatendaz/promptups
   using the gh CLI and GitHub API only — no local clones. Enable
   `allow_auto_merge` if it is off; if branch protection requires reviews, allow
   GitHub Actions to approve PRs. If an existing workflow is a PR docs gate,
   include brief conforming docs entries."

The workflow file itself was not written in this session — it is the reviewed
template from `Tatendaz/Quant_Backtest_Platform`, copied unchanged.

## Steps taken
- Read the repo's merge settings, `main` branch protection, and the three
  existing workflows before touching anything.
- Enabled `allow_auto_merge` (was `false`) and, because protection carries
  `required_pull_request_reviews`, set `can_approve_pull_request_reviews: true`
  while preserving `default_workflow_permissions: read`.
- Found `pr-gate.yml`'s docs gate and wrote this pair to satisfy it, matching the
  format of `docs/features/2026-07-25-ci-hardening-and-contributor-docs.md`.
- Created `ci/dependabot-auto-merge`, uploaded the workflow and these two files
  through the contents API, and opened the PR.

## Decisions
- **Kept `--squash`.** The repo allows squash merges, so the template needed no
  edit; the `--merge` variant of the template was not required here.
- **Did not add `.github/dependabot.yml`.** It was not part of the request, and
  the workflow is safely inert without it. Flagged in the feature notes instead.
- **Did not weaken the docs gate for bot branches.** It is the right follow-up,
  but changing `pr-gate.yml`'s contract is a separate decision from adding this
  workflow, and bundling it would have hidden a real policy change inside a
  copy-paste PR.
- **No CodeRabbit review requested on this PR.** The template was reviewed once
  centrally before replication; the PR body carries `@coderabbitai ignore` so
  the rollout does not spend a review per repo.
