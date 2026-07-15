import test from "node:test";
import assert from "node:assert/strict";
import { coach, LINES } from "../public/coach.js";

test("pick: exhausts a whole bank before repeating (shuffle bag)", () => {
  const bank = LINES.start;
  const seen = new Set();
  for (let i = 0; i < bank.length; i++) seen.add(coach.pick("start"));
  assert.equal(seen.size, bank.length);
  for (const line of seen) assert.ok(bank.includes(line));
});

test("pick: keeps producing lines after the bag refills", () => {
  for (let i = 0; i < LINES.milestone.length * 3; i++) {
    assert.ok(LINES.milestone.includes(coach.pick("milestone")));
  }
});

test("quip: falls back to the finish bank when no server is reachable", async () => {
  const line = await coach.quip("done", 12, "squats");
  assert.ok(LINES.finish.includes(line), `got: ${line}`);
});

test("quip: zero reps falls back to the zero-rep roast bank", async () => {
  const line = await coach.quip("done", 0, "squats");
  assert.ok(LINES.zeroReps.includes(line), `got: ${line}`);
});
