import test from "node:test";
import assert from "node:assert/strict";
import {
  IDLE_AFTER_MS,
  MILESTONE_EVERY,
  ROAST_AFTER_MS,
  SessionTracker,
  cameraConstraints,
  cameraOptions,
  chimeNotes,
  endBanner,
  formatDuration,
  pickCamera,
  routeEvent,
  sessionPayload,
  shouldLogSession,
  summaryLine,
} from "../public/session.js";

// ---------- clock ----------

test("formatDuration: pads to mm:ss and rolls minutes over", () => {
  assert.equal(formatDuration(0), "00:00");
  assert.equal(formatDuration(9_400), "00:09"); // truncates, never rounds up
  assert.equal(formatDuration(59_999), "00:59");
  assert.equal(formatDuration(60_000), "01:00");
  assert.equal(formatDuration(11 * 60_000 + 5_000), "11:05");
});

test("formatDuration: minutes keep counting past an hour", () => {
  // A 90-minute agentic run should read 90:00, not 30:00.
  assert.equal(formatDuration(90 * 60_000), "90:00");
});

test("formatDuration: a clock that went backwards shows 00:00, not a minus sign", () => {
  assert.equal(formatDuration(-5_000), "00:00");
});

// ---------- end-of-set presentation ----------

test("chimeNotes: attention is a flat double beep, done rises", () => {
  assert.deepEqual(chimeNotes("attention"), [523, 523]);
  assert.deepEqual(chimeNotes("done"), [659, 988]);
  assert.deepEqual(chimeNotes(), [659, 988]);
});

test("endBanner: an attention stop is styled and worded differently", () => {
  const attention = endBanner("attention");
  assert.equal(attention.attention, true);
  assert.equal(attention.mode, "attention");
  assert.equal(attention.title, "CLAUDE NEEDS YOU");
  assert.equal(attention.chime, "attention");

  const done = endBanner("done");
  assert.equal(done.attention, false);
  assert.equal(done.mode, "done");
  assert.equal(done.title, "CLAUDE'S READY");
  assert.equal(done.status, "claude's ready");
});

test("summaryLine: reads as a sentence under the banner", () => {
  assert.equal(summaryLine(12, "squats"), "12 squats while it worked");
});

// ---------- what gets persisted ----------

test("shouldLogSession: only real sets with real reps are stored", () => {
  assert.equal(shouldLogSession({ reps: 12, test: false }), true);
  assert.equal(shouldLogSession({ reps: 0, test: false }), false, "an idle prompt is not a set");
  assert.equal(shouldLogSession({ reps: 12, test: true }), false, "a test drive is a rehearsal");
  assert.equal(shouldLogSession(null), false);
});

test("sessionPayload: timestamps go out as ISO strings", () => {
  const startedAt = Date.parse("2026-07-25T10:00:00.000Z");
  const endedAt = Date.parse("2026-07-25T10:02:30.000Z");
  const body = sessionPayload({ exercise: "squats", reps: 9, startedAt }, "done", endedAt);
  assert.deepEqual(body, {
    exercise: "squats",
    reps: 9,
    startedAt: "2026-07-25T10:00:00.000Z",
    endedAt: "2026-07-25T10:02:30.000Z",
    reason: "done",
  });
});

test("sessionPayload: a missing reason defaults to done", () => {
  const body = sessionPayload({ exercise: "deskPushups", reps: 3, startedAt: Date.now() }, undefined);
  assert.equal(body.reason, "done");
});

// ---------- hook bus routing ----------

test("routeEvent: a hello that arrives mid-thought starts a set", () => {
  assert.deepEqual(routeEvent({ type: "hello", thinking: true }, null), { action: "begin" });
});

test("routeEvent: an idle hello only resets the status when nothing is running", () => {
  assert.deepEqual(routeEvent({ type: "hello", thinking: false }, null), { action: "idle" });
  assert.deepEqual(
    routeEvent({ type: "hello", thinking: false }, { test: false }),
    { action: "none" },
    "a live set must not be interrupted by a reconnect"
  );
});

test("routeEvent: start begins a set, stop ends one with its reason", () => {
  assert.deepEqual(routeEvent({ type: "start" }, null), { action: "begin" });
  assert.deepEqual(routeEvent({ type: "stop", reason: "attention" }, { test: false }), {
    action: "end",
    reason: "attention",
  });
  assert.deepEqual(routeEvent({ type: "stop" }, { test: false }), { action: "end", reason: "done" });
});

test("routeEvent: Claude finishing does not cut a test drive short", () => {
  assert.deepEqual(routeEvent({ type: "stop", reason: "done" }, { test: true }), { action: "none" });
});

test("routeEvent: unknown and malformed payloads do nothing", () => {
  assert.deepEqual(routeEvent({ type: "wat" }, null), { action: "none" });
  assert.deepEqual(routeEvent({}, null), { action: "none" });
  assert.deepEqual(routeEvent(null, null), { action: "none" });
});

// ---------- cameras ----------

test("cameraConstraints: an exact device when we have one, front camera otherwise", () => {
  assert.deepEqual(cameraConstraints("cam-2"), {
    video: { deviceId: { exact: "cam-2" } },
    audio: false,
  });
  const fallback = cameraConstraints(undefined);
  assert.equal(fallback.video.facingMode, "user");
  assert.equal(fallback.audio, false, "PromptUps never asks for a microphone");
});

test("cameraOptions: unlabelled devices get a position-based name", () => {
  assert.deepEqual(
    cameraOptions([
      { deviceId: "a", label: "FaceTime HD Camera" },
      { deviceId: "b", label: "" },
    ]),
    [
      { value: "a", label: "FaceTime HD Camera" },
      { value: "b", label: "camera 2" },
    ]
  );
});

test("pickCamera: remembers your camera, forgets one that got unplugged", () => {
  const cams = [{ deviceId: "a" }, { deviceId: "b" }];
  assert.equal(pickCamera(cams, "b"), "b");
  assert.equal(pickCamera(cams, "gone"), "a", "fall back to the first live device");
  assert.equal(pickCamera(cams, null), "a");
  assert.equal(pickCamera([], "b"), null, "no cameras, nothing to pick");
});

// ---------- the set state machine ----------

test("SessionTracker: begins a set and pins the exercise to it", () => {
  const tracker = new SessionTracker({ now: () => 1000 });
  assert.equal(tracker.active, false);
  const set = tracker.begin({ exercise: "squats" });
  assert.equal(tracker.active, true);
  assert.equal(set.exercise, "squats");
  assert.equal(set.reps, 0);
  assert.equal(set.startedAt, 1000);
  assert.equal(set.test, false);
});

test("SessionTracker: a second prompt mid-set keeps counting into the same set", () => {
  const tracker = new SessionTracker();
  const first = tracker.begin({ exercise: "squats" });
  assert.equal(tracker.begin({ exercise: "deskPushups" }), null);
  assert.equal(tracker.current, first, "the running set must survive the second prompt");
  assert.equal(tracker.current.exercise, "squats", "the exercise stays pinned");
});

test("SessionTracker: every fifth rep is a milestone", () => {
  const tracker = new SessionTracker();
  tracker.begin({ exercise: "squats" });
  const milestones = [];
  for (let i = 1; i <= 12; i++) {
    const rep = tracker.countRep();
    assert.equal(rep.reps, i);
    if (rep.milestone) milestones.push(rep.reps);
  }
  assert.deepEqual(milestones, [5, 10]);
  assert.equal(MILESTONE_EVERY, 5);
});

test("SessionTracker: reps outside a set are ignored", () => {
  const tracker = new SessionTracker();
  assert.equal(tracker.countRep(), null);
  assert.equal(tracker.end(), null, "ending nothing is not an error");
});

test("SessionTracker: ending hands back the finished set and clears the slot", () => {
  const tracker = new SessionTracker();
  tracker.begin({ exercise: "deskPushups", test: true });
  tracker.countRep();
  const done = tracker.end();
  assert.equal(done.reps, 1);
  assert.equal(done.test, true);
  assert.equal(tracker.active, false);
});

test("SessionTracker: elapsedMs tracks the injected clock and is 0 when idle", () => {
  let clock = 5_000;
  const tracker = new SessionTracker({ now: () => clock });
  assert.equal(tracker.elapsedMs(), 0);
  tracker.begin({ exercise: "squats" });
  clock = 65_000;
  assert.equal(tracker.elapsedMs(), 60_000);
  assert.equal(formatDuration(tracker.elapsedMs()), "01:00");
  tracker.end();
  assert.equal(tracker.elapsedMs(), 0);
});

test("SessionTracker: isLatest stops a stale timer from stomping on a new set", () => {
  const tracker = new SessionTracker();
  const first = tracker.begin({ exercise: "squats" });
  tracker.end();
  assert.equal(tracker.isLatest(first.token), true, "nothing has happened since: safe to go idle");

  const second = tracker.begin({ exercise: "squats" });
  assert.equal(tracker.isLatest(first.token), false, "a new set is running: do not go idle");
  assert.notEqual(second.token, first.token);
  tracker.end();
  assert.equal(tracker.isLatest(first.token), false, "the old token never becomes latest again");
  assert.equal(tracker.isLatest(second.token), true);
});

test("SessionTracker: deservesRoast only fires on an open set with nothing on the board", () => {
  const tracker = new SessionTracker();
  assert.equal(tracker.deservesRoast(), false, "no set, no roast");
  tracker.begin({ exercise: "squats" });
  assert.equal(tracker.deservesRoast(), true);
  tracker.countRep();
  assert.equal(tracker.deservesRoast(), false);
});

test("timings are the ones app.js schedules against", () => {
  assert.equal(ROAST_AFTER_MS, 25_000);
  assert.equal(IDLE_AFTER_MS, 8_000);
});
