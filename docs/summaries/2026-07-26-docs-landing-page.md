# Session: Landing page so PromptUps can be indexed

**Branch:** feat/docs-landing-page
**Date:** 2026-07-26

## Prompts
1. "can you remind me to submit all pages to google seo vergence, claude-usage and my
   own github page. yapui is already submitted."
2. "and any page I may have forgotten in my github pages"
3. "submit to bing as well"
4. "promptups and langchain fde curricilum?"
5. "do both"
6. "Vergance, promptups, langchain-fde-curriculum . Later today I will do the demo gif"

## Steps taken
- Audited every repo on the account for a live Pages site. PromptUps had none — Pages was
  never enabled, `docs/` held only `features/` and `summaries/`, and the repo's `homepage`
  field pointed at the portfolio root, which made it look like a site already existed.
- Read `yapui/docs/index.html` as the reference implementation and reused its structure.
- Took every factual claim from this repo's `README.md`: the angle thresholds, the three
  hooks, the CDN model size, the sessions file path, the test count.
- Wrote `docs/index.html` and `docs/.nojekyll`.
- Ran `npm test` — 24 tests, 0 failures.

## Decisions
- **Made the demo figure self-removing instead of waiting for the GIF.** Tatenda is
  recording `docs/demo.gif` later the same day. Shipping the page with a hard `<img>` would
  mean a broken-image placeholder until then; omitting the figure would mean another HTML
  edit afterwards. An `onerror` that removes the `<figure>` gets both: nothing broken now,
  and no HTML edit later. The removal happens at load time, so the demo shows up on the
  first page load after `docs/demo.gif` deploys — not on an already-open tab.
- **Led with the dead-time argument, not the feature list.** "A prompt takes thirty seconds
  to five minutes; that's an hour a day currently donated to your X feed" is the line that
  makes someone install this. The rep counting is the mechanism, not the pitch.
- **Kept the honesty details prominent** — half reps don't count, the hooks are `curl` with
  a one-second timeout that can't affect Claude Code, frames never leave the browser. Those
  are the three objections a skeptical reader has, and burying them costs installs.
- **Kept the FAQ structured data identical to the rendered FAQ.** A sibling page in this
  batch declared JSON-LD questions that were never rendered; Google treats that mismatch as
  a manual-action risk. All pages in the batch are now checked with a script that parses
  each `ld+json` block and diffs declared questions against the visible `<h3>`s.
- **Paired the accent with an `--on-accent` foreground.** White label text on the dark-theme
  accent measured about 3:1, under the 4.5:1 WCAG AA bar for button text; dark-on-accent
  brings it to roughly 6.7:1.
- **Left `og:image` out** rather than pointing it at a file that doesn't exist yet.
- **Corrected `downloadUrl` twice, following review on a sibling PR.** It started at the
  repo root (a landing page, not a download), moved to `/releases/latest` — which is also
  a landing page, since it 302s to the release's HTML view — and settled on
  `archive/refs/tags/v0.1.0.tar.gz`, verified to return `200 application/x-gzip`. The
  second correction landed here before this PR was ever reviewed, because the same
  mistake was made on all the pages in the batch and there was no reason to wait for each
  reviewer to find it independently. `softwareVersion: 0.1.0` was added to match, and the
  two are flagged in an HTML comment as a pair to bump together.
