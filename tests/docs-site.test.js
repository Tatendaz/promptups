// Checks that the GitHub Pages landing page (docs/index.html) stays agent-readable:
// the text and <h1> sit inside <main>, and the Markdown twin that
// <link rel="alternate" type="text/markdown"> points at mirrors the page.
// The custom 404 page (docs/404.html) must keep its Markdown pointers and absolute links.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SLUG = "promptups";
const HTML = fs.readFileSync(path.join(ROOT, "docs", "index.html"), "utf8");
const MD = fs.readFileSync(path.join(ROOT, "docs", "index.md"), "utf8");
const HTML_404 = fs.readFileSync(path.join(ROOT, "docs", "404.html"), "utf8");

// Tags are removed by a character walk rather than a regex: CodeQL treats regex-based
// HTML filtering as a sanitizer bug (js/bad-tag-filter), and a loop is clearer anyway.
// A <br> becomes a space; every other tag vanishes.
function stripTags(fragment) {
  let out = "";
  let tag = null;
  for (const ch of fragment) {
    if (tag !== null) {
      if (ch === ">") {
        if (tag.toLowerCase().startsWith("br")) out += " ";
        tag = null;
      } else {
        tag += ch;
      }
    } else if (ch === "<") {
      tag = "";
    } else {
      out += ch;
    }
  }
  return out;
}
// One pass over the entities, so an "&amp;lt;" can never be unescaped twice.
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m, name) => ENTITIES[name]);
// Collapse whitespace and drop the characters Markdown adds for emphasis/code.
const squash = (s) => s.replace(/[*`\\]/g, "").replace(/\s+/g, " ").trim();
const blockText = (fragment) => squash(decode(stripTags(fragment)));
// Inner HTML of every <tag ...>...</tag> element, located with indexOf (tag name must end there).
function innerOf(html, tag) {
  const found = [];
  let from = 0;
  for (;;) {
    const open = html.indexOf("<" + tag, from);
    if (open === -1) break;
    const next = html[open + tag.length + 1];
    const gt = html.indexOf(">", open);
    if (next !== ">" && next !== " " && next !== "\n") {
      from = open + 1; // a longer tag name (e.g. <pre> while looking for <p>): keep scanning
      continue;
    }
    const close = gt === -1 ? -1 : html.indexOf("</" + tag + ">", gt);
    if (close === -1) break;
    found.push(html.slice(gt + 1, close));
    from = close + tag.length + 3;
  }
  return found;
}
function section(tag, html = HTML) {
  const found = innerOf(html, tag);
  assert.equal(found.length, 1, `expected exactly one <${tag}>`);
  return found[0];
}
const count = (html, needle) => html.split(needle).length - 1;
// Names of every opening tag in the fragment (lower-case), found by a character walk.
function tagNames(fragment) {
  const names = [];
  let tag = null;
  for (const ch of fragment) {
    if (tag !== null) {
      if (ch === ">") {
        const name = tag.trim().split(/[\s/]/)[0].toLowerCase();
        if (name && !name.startsWith("/") && !name.startsWith("!")) names.push(name);
        tag = null;
      } else {
        tag += ch;
      }
    } else if (ch === "<") {
      tag = "";
    }
  }
  return names;
}
// Every value of a `name="..."` attribute in the document, located with indexOf.
function attrValues(html, name) {
  const values = [];
  const marker = " " + name + '="';
  let from = 0;
  for (;;) {
    const at = html.indexOf(marker, from);
    if (at === -1) break;
    const start = at + marker.length;
    const end = html.indexOf('"', start);
    if (end === -1) break;
    values.push(html.slice(start, end));
    from = end + 1;
  }
  return values;
}
// The Markdown twin as plain text: no code blocks, links and images reduced to their text.
const twinPlain = (md) => squash(
  md.replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^>\s?/gm, ""),
);

test("h1 and content live inside <main>", () => {
  const main = section("main");
  assert.equal(count(HTML, "<h1"), 1, "exactly one <h1>");
  assert.equal(count(main, "<h1"), 1, "the <h1> must be inside <main>");
  assert.ok(blockText(main).length >= 500, "500+ chars of text inside <main>");
  // Boilerplate-stripping extractors drop <header>/<nav>/<aside>/<footer> elements before counting.
  const boilerplate = tagNames(main).filter((t) => ["header", "nav", "aside", "footer"].includes(t));
  assert.deepEqual(boilerplate, [], "boilerplate element(s) inside <main> would hide content from agents");
});

test("head advertises the Markdown twin and llms.txt", () => {
  const head = section("head");
  assert.ok(head.includes(`<link rel="alternate" type="text/markdown" href="/${SLUG}/index.md"`));
  assert.ok(head.includes('<link rel="describedby" href="/llms.txt">'));
  assert.ok(section("footer").includes('href="https://tatendaz.github.io/llms.txt"'));
});

test("Markdown twin mirrors the page", () => {
  assert.ok(MD.startsWith("# "), "twin must start with an H1");
  assert.equal(MD.split("\n")[0].slice(2).trim(), blockText(section("h1")));
  for (const h2 of innerOf(HTML, "h2")) {
    const heading = "## " + blockText(h2);
    assert.ok(MD.includes(heading), `twin is missing "${heading}"`);
  }
  assert.ok(MD.includes(`HTML version: https://tatendaz.github.io/${SLUG}/`));
  assert.ok(MD.includes("https://tatendaz.github.io/llms.txt"));
  for (const tag of ["<div", "<span", "<script", "<style"]) {
    assert.ok(!MD.includes(tag), `twin must be plain Markdown (found ${tag})`);
  }
});

test("Markdown twin carries every paragraph and list item", () => {
  const main = section("main");
  const blocks = [...innerOf(main, "p"), ...innerOf(main, "li")].map(blockText).filter(Boolean);
  assert.ok(blocks.length >= 10, "expected 10+ text blocks inside <main>");
  const plain = twinPlain(MD);
  for (const block of blocks) {
    assert.ok(plain.includes(block), `twin is missing the text: ${block.slice(0, 80)}`);
  }
});

// GitHub Pages serves docs/404.html, with a real 404 status, for every missing path under
// /promptups/ at any depth, so a relative URL on it resolves against the wrong directory.
test("404 page is noindex, has no canonical or alternate links, and links absolutely", () => {
  assert.ok(section("title", HTML_404).includes("404"), "title names the status");
  assert.ok(section("head", HTML_404).includes('<meta name="robots" content="noindex">'));
  assert.ok(!HTML_404.includes('rel="canonical"'), "a 404 has no canonical URL");
  assert.ok(!HTML_404.includes('rel="alternate"'), "a 404 has no alternate version");
  const urls = [...attrValues(HTML_404, "href"), ...attrValues(HTML_404, "src")];
  assert.ok(urls.length >= 6, "expected the next-step and footer links");
  const absolute = ["/promptups/", "http", "mailto:", "data:", "#"];
  for (const url of urls) {
    assert.ok(absolute.some((prefix) => url.startsWith(prefix)), `URL would break at depth: ${url}`);
  }
});

// The Is Agentic "agent-friendly 404" check credits a real 404 whose body carries short
// Markdown guidance; the Markdown lives in a <pre class="md"> inside <main>.
test("404 page gives agents short Markdown pointers inside <main>", () => {
  const main = section("main", HTML_404);
  assert.equal(count(main, "<h1"), 1, "the <h1> must be inside <main>");
  const boilerplate = tagNames(main).filter((t) => ["header", "nav", "aside", "footer"].includes(t));
  assert.deepEqual(boilerplate, [], "boilerplate element(s) inside <main> would hide content from agents");
  assert.ok(blockText(main).length < 1500, "a 404 should say little: under 1,500 characters of text");
  assert.ok(main.includes('<pre class="md"'), 'the Markdown block is <pre class="md">');
  const md = decode(section("pre", main)).trim();
  assert.ok(md.startsWith("# 404"), "Markdown block opens with an H1 naming the status");
  assert.ok(md.includes("\n## Where to look next\n"), "Markdown block has the next-steps heading");
  for (const needle of [
    "- [Site map](https://tatendaz.github.io/sitemap.xml)",
    "- [llms.txt](https://tatendaz.github.io/llms.txt)",
    "https://tatendaz.github.io/promptups/",
  ]) {
    assert.ok(md.includes(needle), `Markdown block is missing: ${needle}`);
  }
  assert.ok(md.length < 700, "Markdown block must stay short");
  assert.deepEqual(tagNames(md), [], "Markdown block must be plain text, not HTML");
});
