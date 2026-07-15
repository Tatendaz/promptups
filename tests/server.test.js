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
