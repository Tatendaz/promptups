# Feature: Landing page at docs/index.html

**Branch:** feat/docs-landing-page
**Date:** 2026-07-26

## Summary
Adds a self-contained `docs/index.html` landing page (plus `docs/.nojekyll`) so PromptUps
can be published on GitHub Pages at `https://tatendaz.github.io/promptups/` and submitted
to Google and Bing.

## Motivation
PromptUps had no web page. `https://tatendaz.github.io/promptups/` returned 404 and Pages
was never enabled, so there was nothing to submit to search engines. `public/index.html`
exists but is the app UI served by `server.js` at `localhost:7887` — it isn't a landing
page and doesn't work as a static deploy.

This matters more for PromptUps than for the other repos in this batch: it's the project
going into launch week, and a link that resolves to a real page with a demo, an FAQ, and
social-preview metadata converts very differently from a bare repo link.

## What changed
- `docs/index.html` — one file, no build step, no external requests (inline CSS, inline SVG
  favicon).
  - SEO head: `<title>`, meta description, `rel=canonical`, Open Graph, Twitter card.
  - Structured data: `SoftwareApplication` + `FAQPage` declaring exactly the four Q&A pairs
    the page renders, no more.
  - Content: hero, the demo figure, why (the hour of dead time), the five-beat loop, how it
    works with the hooks table, the exercise threshold table, the coach, privacy, quick
    start, FAQ.
- `docs/.nojekyll` — skip Jekyll processing, matching `yapui` and `claude-usage`.

## Notes
- **The demo figure removes itself until `docs/demo.gif` exists.** The `<img>` carries an
  `onerror` that drops the whole `<figure>`, so the page never renders a broken image
  placeholder. Drop the GIF in and it appears on the next deploy — no HTML edit needed.
  The README's `<!-- TODO: docs/demo.gif -->` is still the tracking marker for recording it.
- **Every claim comes from `README.md`** — the angle thresholds, the hook table, the 5 MB
  model fetch, the `~/.promptups/sessions.json` path, the 24-test count — so the page and
  the README can't drift apart.
- **No `og:image`.** The repo has no `social-preview.png`; link previews fall back to title
  and description. Worth generating alongside the demo GIF, since both are launch assets.
  For the same reason `twitter:card` is `summary` rather than `summary_large_image`, which
  without an image just degrades to a plain card — flip it when both assets ship.
- **`downloadUrl` points at the tag's source archive.** It went through two corrections.
  The repo root is a landing page, not a download; so is `/releases/latest`, which just
  302s to the release's HTML page — and `v0.1.0` has no uploaded assets, so there is no
  binary to link. `archive/refs/tags/v0.1.0.tar.gz` returns `200 application/x-gzip`, and
  since PromptUps is cloned and run with `npm start` rather than installed from a
  binary, that archive genuinely is the artifact. The repo URL is kept as `sameAs`.
- **`softwareVersion: 0.1.0` was added** so it names the same version `downloadUrl`
  resolves to. **The two are a matched pair: bump them together on every release** —
  there's an HTML comment above the block saying so. This matters more here than
  elsewhere, since `ROADMAP.md` already plans v0.2 through v0.4.
- **Pages still needs enabling** (Settings → Pages → `main` / `/docs`) after merge. The URL
  is already baked into the canonical tag and structured data.
