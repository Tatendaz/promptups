import test from "node:test";
import assert from "node:assert/strict";
import { angleAt, visibleAngle, RepCounter, EXERCISES, L } from "../public/reps.js";

test("angleAt: straight line is ~180 degrees", () => {
  const angle = angleAt({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 });
  assert.ok(Math.abs(angle - 180) < 0.001, `got ${angle}`);
});

test("angleAt: right angle is ~90 degrees", () => {
  const angle = angleAt({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 });
  assert.ok(Math.abs(angle - 90) < 0.001, `got ${angle}`);
});

function fakeLandmarks(overrides = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  for (const [index, point] of Object.entries(overrides)) lm[index] = point;
  return lm;
}

test("visibleAngle: returns the joint angle when one side is visible", () => {
  const lm = fakeLandmarks({
    [L.hipL]: { x: 0, y: 0, visibility: 0.9 },
    [L.kneeL]: { x: 0, y: 1, visibility: 0.9 },
    [L.ankleL]: { x: 0, y: 2, visibility: 0.9 },
  });
  const angle = visibleAngle(lm, EXERCISES.squats);
  assert.ok(Math.abs(angle - 180) < 0.001, `got ${angle}`);
});

test("visibleAngle: returns null when no side is confidently visible", () => {
  const lm = fakeLandmarks({
    [L.hipL]: { x: 0, y: 0, visibility: 0.3 },
    [L.kneeL]: { x: 0, y: 1, visibility: 0.3 },
    [L.ankleL]: { x: 0, y: 2, visibility: 0.3 },
  });
  assert.equal(visibleAngle(lm, EXERCISES.squats), null);
});

test("visibleAngle: averages both sides when both are visible", () => {
  const lm = fakeLandmarks({
    [L.hipL]: { x: 0, y: 0, visibility: 1 },
    [L.kneeL]: { x: 0, y: 1, visibility: 1 },
    [L.ankleL]: { x: 0, y: 2, visibility: 1 }, // straight: 180
    [L.hipR]: { x: 0, y: 1, visibility: 1 },
    [L.kneeR]: { x: 0, y: 0, visibility: 1 },
    [L.ankleR]: { x: 1, y: 0, visibility: 1 }, // right angle: 90
  });
  const angle = visibleAngle(lm, EXERCISES.squats);
  assert.ok(Math.abs(angle - 135) < 0.001, `got ${angle}`);
});

// Drive a counter through a timed sequence of raw angles.
function run(counter, steps, startAt = 0, stepMs = 100) {
  let reps = 0;
  steps.forEach((angle, i) => {
    if (counter.feed(angle, startAt + i * stepMs)) reps += 1;
  });
  return reps;
}

test("RepCounter: one full squat counts exactly one rep", () => {
  const counter = new RepCounter(EXERCISES.squats);
  const down = Array(10).fill(95);   // bottom of the squat
  const up = Array(10).fill(170);    // standing tall
  assert.equal(run(counter, [170, ...down, ...up]), 1);
});

test("RepCounter: three squats count three reps", () => {
  const counter = new RepCounter(EXERCISES.squats);
  const cycle = [...Array(8).fill(95), ...Array(8).fill(170)];
  assert.equal(run(counter, [170, ...cycle, ...cycle, ...cycle]), 3);
});

test("RepCounter: jitter between thresholds never counts", () => {
  const counter = new RepCounter(EXERCISES.squats);
  const wobble = Array.from({ length: 50 }, (_, i) => 125 + (i % 2 ? 12 : -12));
  assert.equal(run(counter, [170, ...wobble]), 0);
});

test("RepCounter: a bounce faster than minDownMs does not count", () => {
  const counter = new RepCounter(EXERCISES.squats, { minDownMs: 350, alpha: 1 });
  counter.feed(170, 0);
  counter.feed(95, 10);    // down instantly (alpha 1 = no smoothing)
  assert.equal(counter.feed(170, 100), false); // back up 90ms later: too fast
  assert.equal(counter.phase, "down");
  assert.equal(counter.feed(170, 500), true);  // held long enough: counts
});

test("RepCounter: desk push-up thresholds work the same way", () => {
  const counter = new RepCounter(EXERCISES.deskPushups);
  const down = Array(10).fill(90);
  const up = Array(10).fill(165);
  assert.equal(run(counter, [165, ...down, ...up]), 1);
});
