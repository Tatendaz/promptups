# Session: merge-when-clean template v6

**Branch:** security/merge-when-clean-v5
**Date:** 2026-10-25 local (2026-10-25 UTC)

## Prompts
1. Coordinator update: template v5 fixes a crash in v4 (`bash -e` exits on grep's no-match); repos merged with v4 get a follow-up PR.
2. Coordinator update: v6 fails red when it cannot list PRs; use v6.

## Steps taken
- Copied template v6 (sha256 `af7e7bd9…`) over the v4 file (v5 first, then v6 when the coordinator released it).
- Reproduced the v4 exit and the v5 fix under `/opt/homebrew/bin/bash --noprofile --norc -e -o pipefail`.
- `actionlint` clean; `zizmor --min-severity medium .` exit 0.

## Decisions
- **No other changes.** The template is copied unchanged, per the owner's rule.
