# Session: merge-when-clean template v5

**Branch:** security/merge-when-clean-v5
**Date:** 2026-10-25 local (2026-10-25 UTC)

## Prompts
1. Coordinator update: template v5 fixes a crash in v4 (`bash -e` exits on grep's no-match); repos merged with v4 get a follow-up PR.

## Steps taken
- Copied template v5 (sha256 `1c493dd7…`) over the v4 file.
- Reproduced the v4 exit and the v5 fix under `/opt/homebrew/bin/bash --noprofile --norc -e -o pipefail`.
- `actionlint` clean; `zizmor --min-severity medium .` exit 0.

## Decisions
- **No other changes.** The template is copied unchanged, per the owner's rule.
