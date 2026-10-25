# Feature: merge-when-clean template v5

**Branch:** security/merge-when-clean-v5
**Date:** 2026-10-25 local (2026-10-25 UTC)

## Summary
Replaces `.github/workflows/merge-when-clean.yml` (v4, from #18) with the
owner's v5 template. The only change is `set +e` after `set -uo pipefail`.

## Motivation
GitHub runs `shell: bash` as `bash -e -o pipefail`. v4 runs `grep ...; rc=$?`,
so a grep with no match (exit 1) ended the whole job before it checked any PR.
v4 could never merge anything.

## What changed
- `.github/workflows/merge-when-clean.yml`: template v5 (sha256 `1c493dd7…`), unchanged.

## Notes
- Reproduced locally: `bash -e -o pipefail -c 'set -uo pipefail; grep -q x <<<y; rc=$?; echo $rc'`
  exits 1 before the echo; with `set +e` added it prints `1` and exits 0.
- The job skips PRs that touch its own file, so this PR is merged by hand.
