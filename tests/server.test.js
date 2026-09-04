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

const { startServer, TOKEN_FILE } = await import("../server.js");

const server = startServer(0);
await new Promise((resolve) => server.on("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

// The server minted this on startup. The hooks read the same file.
const TOKEN = fs.readFileSync(TOKEN_FILE, "utf8");
const auth = (extra = {}) => ({ ...extra, authorization: `Bearer ${TOKEN}` });

test.after(() => {
  server.close();
  fs.rmSync(tmpData, { recursive: true, force: true });
});

test("state starts idle, flips on start, clears on stop", async () => {
  let state = await (await fetch(`${base}/api/state`)).json();
  assert.equal(state.thinking, false);

  await fetch(`${base}/promptups/start`, { method: "POST", headers: auth() });
  state = await (await fetch(`${base}/api/state`)).json();
  assert.equal(state.thinking, true);
  assert.ok(state.startedAt > 0);

  await fetch(`${base}/promptups/stop?reason=attention`, { method: "POST", headers: auth() });
  state = await (await fetch(`${base}/api/state`)).json();
  assert.equal(state.thinking, false);
  assert.equal(state.reason, "attention");
});

test("sessions persist and aggregate into stats", async () => {
  const now = new Date().toISOString();
  const post = (reps) =>
    fetch(`${base}/api/session`, {
      method: "POST",
      headers: auth({ "content-type": "application/json" }),
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

// ---------------------------------------------------------------------------
// Authentication (issue #7). Each of these is a request a page you merely
// visited could previously have made.
// ---------------------------------------------------------------------------

const STATE_CHANGING = [
  ["/promptups/start", "POST"],
  ["/promptups/stop", "POST"],
  ["/api/session", "POST"],
];

test("no token is rejected on every state-changing endpoint", async () => {
  for (const [pathname, method] of STATE_CHANGING) {
    const res = await fetch(`${base}${pathname}`, {
      method,
      headers: { "content-type": "application/json" },
      body: method === "POST" ? "{}" : undefined,
    });
    assert.equal(res.status, 401, `${pathname} without a token`);
  }
});

test("a wrong token is rejected, including one of the right length", async () => {
  // Same length as the real token, so the rejection is not just a length check.
  const sameLength = "0".repeat(TOKEN.length);
  for (const bad of ["nope", sameLength, ""]) {
    const res = await fetch(`${base}/promptups/start`, {
      method: "POST",
      headers: { authorization: `Bearer ${bad}` },
    });
    assert.equal(res.status, 401, `token ${JSON.stringify(bad)}`);
  }
});

test("a foreign Origin is rejected even when the token is correct", async () => {
  // The case that matters: a page that somehow learned the token still cannot
  // use it from another origin.
  const res = await fetch(`${base}/promptups/start`, {
    method: "POST",
    headers: auth({ origin: "https://evil.example" }),
  });
  assert.equal(res.status, 403);
});

test("the app's own two origins are accepted", async () => {
  const port = server.address().port;
  for (const origin of [`http://127.0.0.1:${port}`, `http://localhost:${port}`]) {
    const res = await fetch(`${base}/promptups/start`, {
      method: "POST",
      headers: auth({ origin }),
    });
    assert.equal(res.status, 200, origin);
  }
});

test("GET cannot drive start/stop — an <img> tag must not fire them", async () => {
  for (const pathname of ["/promptups/start", "/promptups/stop"]) {
    const res = await fetch(`${base}${pathname}`, { method: "GET", headers: auth() });
    assert.equal(res.status, 405, pathname);
  }
});

test("the token file is not readable by anyone else", async () => {
  const mode = fs.statSync(TOKEN_FILE).mode & 0o777;
  assert.equal(mode, 0o600, `token file mode is ${mode.toString(8)}`);
  assert.ok(TOKEN.length >= 32, "token should carry real entropy");
});

test("index.html carries the token so the page can call its own API", async () => {
  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /<meta name="promptups-token" content="[0-9a-f]{64}"/);
  // Never cache a response with a per-run secret in it.
  const res = await fetch(`${base}/`);
  assert.match(res.headers.get("cache-control") || "", /no-store/);
});

test("an oversized session body is refused with 413, not buffered", async () => {
  const res = await fetch(`${base}/api/session`, {
    method: "POST",
    headers: auth({ "content-type": "application/json" }),
    body: JSON.stringify({ exercise: "squats", reps: 1, pad: "x".repeat(80 * 1024) }),
  });
  assert.equal(res.status, 413);
});

test("a session record is sanity-checked before it reaches the stats", async () => {
  const post = (body) =>
    fetch(`${base}/api/session`, {
      method: "POST",
      headers: auth({ "content-type": "application/json" }),
      body: JSON.stringify(body),
    });

  assert.equal((await post({ exercise: "squats", reps: 10_001 })).status, 400);
  assert.equal((await post({ exercise: "squats", reps: -5 })).status, 400);
  assert.equal((await post("not json at all")).status, 400);

  // An over-long exercise name is truncated rather than rejected: it is cosmetic,
  // and dropping a real set over a label would lose the reps.
  const res = await post({ exercise: "q".repeat(500), reps: 1 });
  assert.equal(res.status, 200);
  const onDisk = JSON.parse(fs.readFileSync(path.join(tmpData, "sessions.json"), "utf8"));
  assert.equal(onDisk.at(-1).exercise.length, 64);
});

test("quip needs a token too — it spends the user's Claude quota", async () => {
  process.env.PROMPTUPS_AI_COACH = "1";
  try {
    const res = await fetch(`${base}/api/quip?moment=done&reps=5&exercise=squats`);
    assert.equal(res.status, 401);
  } finally {
    delete process.env.PROMPTUPS_AI_COACH;
  }
});

test("read-only endpoints stay open, so the page works before it has a token", async () => {
  for (const pathname of ["/api/state", "/api/stats"]) {
    assert.equal((await fetch(`${base}${pathname}`)).status, 200, pathname);
  }
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
