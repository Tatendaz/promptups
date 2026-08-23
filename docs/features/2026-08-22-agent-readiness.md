# Feature: Agent-readable landing page — `<main>`, Markdown twin, llms.txt links

**Branch:** feat/agent-readiness
**Date:** 2026-08-22

## Summary
Makes `docs/index.html` (the GitHub Pages landing page at https://tatendaz.github.io/promptups/)
readable for AI agents the same way the root site is: the page content sits inside `<main>`,
a Markdown twin lives at `docs/index.md`, and the page advertises it with
`<link rel="alternate" type="text/markdown" href="/promptups/index.md">` plus
`<link rel="describedby" href="/llms.txt">`. Nothing visible changes apart from an llms.txt link
in the footer. Missing paths under `/promptups/` now get a custom 404 page (`docs/404.html`) with
short Markdown guidance instead of GitHub's default one.

## Motivation
An Is Agentic audit of tatendaz.github.io (2026-08-22) showed the scanner counts text and the
H1 only inside `<main>`. This page had no `<main>`, so its 4,000+ characters of static text and
its H1 did not count. The root site's `llms.txt` (Tatendaz/Tatendaz.github.io PR #8) lists
this page; the page now points back at it and ships the Markdown twin that the
[llmstxt.org](https://llmstxt.org/) spec recommends (`index.md` next to `index.html`,
`rel="alternate"` to the twin, `rel="describedby"` to the covering `llms.txt`).

## What changed
- `docs/index.html`: `<main>` wraps the hero and every content section (the footer stays
  outside). The hero was a `<header>`; it is now `<div class="hero">` (CSS selector renamed,
  same rules) because boilerplate-stripping extractors drop `<header>` elements and would
  lose the H1 with it. The two `<link>` tags sit after the canonical; the footer gains an llms.txt link.
  CSS: selector-only change (the one `header` rule is now `.hero`, same declarations); no layout
  change (the stylesheet has no child selectors or `main` rules).
- `docs/index.md`: Markdown twin of the page content, generated from the HTML and then
  hand-checked (none needed). It ends with links back to the HTML version, the
  source, the root site and `llms.txt`.
- `docs/404.html`: custom 404 page. GitHub Pages serves it, with a real 404 status, for every
  missing path under `/promptups/`; before, it served GitHub's default page, which is a real 404
  but tells an agent nothing. Same chrome as the landing page (head meta, trimmed inline styles,
  footer). `<main>` holds an "HTTP 404" label, the H1, one paragraph saying there is no page at
  this address and that this is a real 404, a "Where to look next" list (docs, Markdown twin,
  source, `llms.txt`, sitemap, home) and a `<pre class="md">` block that repeats those pointers
  as Markdown. The Is Agentic "Agent-friendly 404s" check gives full credit only for a real 404
  whose body carries short Markdown guidance. The page is `noindex`, has no canonical or
  alternate links, and every URL on it is absolute: Pages serves it at any depth
  (`/promptups/a/b/c`), where a relative link would resolve against the wrong directory.
- `tests/docs-site.test.js (node:test)`: one `<main>`, one `<h1>` inside it, 500+ characters of text; the head links
  are present; the twin starts with the same H1, contains every H2 of the page, and is plain
  Markdown. For the 404 page: title names the status, `noindex`, no canonical/alternate links,
  every `href`/`src` absolute, and a Markdown block inside `<main>` that starts with `# 404`,
  lists the pointers, stays under 700 characters and contains no HTML. Run with `npm test`.

## Notes
- When the landing page changes, update `docs/index.md` too; the test fails if an H2 goes
  missing from the twin or the H1 drifts.
- Real `Accept: text/markdown` negotiation is not possible on GitHub Pages (no custom
  headers); the twin plus the two links are the static equivalent.
- No per-project `llms.txt`: the root `/llms.txt` covers every path on the host and already
  describes this project.
- The 404 page has no Markdown twin: it is served for any path, so a twin would have no fixed
  URL, and the guidance is short enough to sit in the body.
