import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Point the server at a throwaway data dir BEFORE importing it,
// so tests never touch the real ~/.promptups.
const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), "promptups-test-"));
process.env.PROMPTUPS_DATA_DIR = tmpData;
delete process.env.PROMPTUPS_AI_COACH;

const { startServer } = await import("../server.js");

const server = startServer(0);
await new Promise((resolve) => server.on("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
  fs.rmSync(tmpData, { recursive: true, force: true });
});

test("state starts idle, flips on start, clears on stop", async () => {
  let state = await (await fetch(`${base}/api/state`)).json();
  assert.equal(state.thinking, false);

  await fetch(`${base}/promptups/start`, { method: "POST" });
  state = await (await fetch(`${base}/api/state`)).json();
  assert.equal(state.thinking, true);
  assert.ok(state.startedAt > 0);

  await fetch(`${base}/promptups/stop?reason=attention`, { method: "POST" });
  state = await (await fetch(`${base}/api/state`)).json();
  assert.equal(state.thinking, false);
  assert.equal(state.reason, "attention");
});

test("sessions persist and aggregate into stats", async () => {
  const now = new Date().toISOString();
  const post = (reps) =>
    fetch(`${base}/api/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ exercise: "squats", reps, startedAt: now, endedAt: now }),
    });
  await post(7);
  const stats = await (await post(11)).json();
  assert.equal(stats.totalReps, 18);
  assert.equal(stats.todayReps, 18);
  assert.equal(stats.bestSet, 11);
  assert.equal(stats.sessions, 2);

  const onDisk = JSON.parse(fs.readFileSync(path.join(tmpData, "sessions.json"), "utf8"));
  assert.equal(onDisk.length, 2);
});

test("serves the workout page and static assets", async () => {
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /PROMPT<span>UPS<\/span>/);

  const js = await fetch(`${base}/reps.js`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get("content-type"), /javascript/);
});

// public/app.js is loaded by the browser as <script type="module">, so its
// relative imports are resolved as URLs against this server — Node's module
// resolution never runs. Walk the graph the way a browser would and prove
// every hop is a real 200 with a JS content-type. This is what stops an
// "extract a module" refactor from shipping a page that 404s on load.
test("serves every module the workout page imports", async () => {
  const relative = (spec) => /^\.{0,2}\//.test(spec);
  // Statement-initial only, and the gap before `from` may not contain a quote,
  // so prose in a comment ("...apart from 'x'") is never mistaken for an import.
  const specifiersIn = (source) =>
    [
      ...source.matchAll(/^\s*(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']/gm),
      ...source.matchAll(/^\s*import\s*["']([^"']+)["']/gm),
    ].map((m) => m[1]);

  const page = await (await fetch(`${base}/`)).text();
  const entries = [...page.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)];
  assert.ok(entries.length > 0, "index.html should load at least one module");

  const queue = entries.map((m) => new URL(m[1], `${base}/`).href);
  const seen = new Set();
  while (queue.length > 0) {
    const url = queue.pop();
    if (seen.has(url)) continue;
    seen.add(url);

    const res = await fetch(url);
    assert.equal(res.status, 200, `${url} is imported by the page but not served`);
    assert.match(res.headers.get("content-type") || "", /javascript/, `${url} needs a JS type`);

    for (const spec of specifiersIn(await res.text())) {
      if (/^https?:/.test(spec)) continue; // CDN imports are not ours to serve
      assert.ok(relative(spec), `${url} imports "${spec}", which no browser can resolve`);
      queue.push(new URL(spec, url).href);
    }
  }

  for (const module of ["app.js", "session.js", "reps.js", "coach.js"]) {
    assert.ok(seen.has(`${base}/${module}`), `${module} should be reachable from index.html`);
  }
});

test("blocks path traversal out of public/", async () => {
  const res = await fetch(`${base}/..%2Fserver.js`);
  assert.ok([403, 404].includes(res.status), `got ${res.status}`);
});

test("unknown paths 404 as JSON, not a crash", async () => {
  const res = await fetch(`${base}/nope.html`);
  assert.equal(res.status, 404);
});

test("quip endpoint returns null quip when AI coach is off", async () => {
  const res = await (await fetch(`${base}/api/quip?moment=done&reps=5&exercise=squats`)).json();
  assert.equal(res.quip, null);
});

test("SSE hello event carries current state on connect", async () => {
  const controller = new AbortController();
  const res = await fetch(`${base}/events`, { signal: controller.signal });
  const reader = res.body.getReader();
  const { value } = await reader.read();
  controller.abort();
  const text = new TextDecoder().decode(value);
  assert.match(text, /"type":"hello"/);
});
