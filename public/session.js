// Set orchestration: the state machine behind a set, plus the little pure
// functions app.js used to inline. No DOM, no MediaPipe, no fetch — same deal
// as reps.js and coach.js, so node:test can drive all of it directly.
//
// app.js keeps the parts that genuinely need a browser (camera, canvas,
// speech, EventSource) and delegates every decision to this file.

// A milestone line every N reps.
export const MILESTONE_EVERY = 5;
// Standing still this long into a set earns a roast.
export const ROAST_AFTER_MS = 25_000;
// How long the end-of-set banner stays up before falling back to idle.
export const IDLE_AFTER_MS = 8_000;

// mm:ss. Minutes keep growing past 59 rather than wrapping — a 90-minute
// agentic run should read 90:00, not 30:00.
export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Two-note chime. "attention" is a flat double beep so it reads as a nudge
// rather than a reward; everything else rises.
export function chimeNotes(kind = "done") {
  return kind === "attention" ? [523, 523] : [659, 988];
}

// What the page should look like when a set ends.
export function endBanner(reason) {
  const attention = reason === "attention";
  return {
    attention,
    mode: attention ? "attention" : "done",
    status: attention ? "claude needs you" : "claude's ready",
    title: attention ? "CLAUDE NEEDS YOU" : "CLAUDE'S READY",
    chime: attention ? "attention" : "done",
  };
}

export function summaryLine(reps, label) {
  return `${reps} ${label} while it worked`;
}

// Only real sets with real reps are worth persisting: a test drive is a
// rehearsal, and a zero-rep set is just an idle prompt.
export function shouldLogSession(done) {
  return Boolean(done) && !done.test && done.reps > 0;
}

// Body for POST /api/session.
export function sessionPayload(done, reason, endedAt = Date.now()) {
  return {
    exercise: done.exercise,
    reps: done.reps,
    startedAt: new Date(done.startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    reason: reason || "done",
  };
}

// Route one SSE payload from the hook bus to an action the page can perform.
// `session` is the live set, or null.
export function routeEvent(event, session) {
  const type = event && event.type;
  if (type === "hello") {
    if (event.thinking) return { action: "begin" };
    return session ? { action: "none" } : { action: "idle" };
  }
  if (type === "start") return { action: "begin" };
  // A test drive ends on the test button, not on Claude's Stop hook — otherwise
  // a prompt finishing mid-rehearsal would yank the set out from under you.
  if (type === "stop" && (!session || !session.test)) {
    return { action: "end", reason: event.reason || "done" };
  }
  return { action: "none" };
}

// getUserMedia constraints. An exact deviceId when we have one, otherwise the
// front-facing camera at a resolution MediaPipe is happy with.
export function cameraConstraints(deviceId) {
  return {
    video: deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: "user", width: { ideal: 1280 } },
    audio: false,
  };
}

// Labels are empty until the user grants camera permission, so fall back to
// a position-based name.
export function cameraOptions(cams) {
  return cams.map((cam, i) => ({
    value: cam.deviceId,
    label: cam.label || `camera ${i + 1}`,
  }));
}

// Honour the remembered camera, but only while it is still plugged in.
export function pickCamera(cams, saved) {
  if (saved && cams.some((c) => c.deviceId === saved)) return saved;
  return cams.length ? cams[0].deviceId : null;
}

// One set at a time. Holds the reps, the clock, and a monotonic token used to
// tell "this set ended" apart from "this set ended and another already began".
export class SessionTracker {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.current = null;
    this.seq = 0;
  }

  get active() {
    return this.current !== null;
  }

  // Returns the new set, or null if one is already running — a second prompt
  // mid-set keeps counting into the set that is already open.
  begin({ test = false, exercise } = {}) {
    if (this.current) return null;
    // Pin the exercise for the whole set, so every rep and the logged session
    // stay attached to one movement even if the picker changes later.
    this.current = {
      reps: 0,
      startedAt: this.now(),
      token: ++this.seq,
      test,
      exercise,
    };
    return this.current;
  }

  // Returns { reps, milestone } or null when nothing is running.
  countRep() {
    if (!this.current) return null;
    this.current.reps += 1;
    return {
      reps: this.current.reps,
      milestone: this.current.reps % MILESTONE_EVERY === 0,
    };
  }

  // Returns the finished set, or null if there was nothing to end.
  end() {
    const done = this.current;
    this.current = null;
    return done;
  }

  elapsedMs(at = this.now()) {
    return this.current ? at - this.current.startedAt : 0;
  }

  // True only if that set was the last one and nothing has started since.
  // Guards the delayed "back to idle" so a new prompt is not stomped on.
  isLatest(token) {
    return !this.current && this.seq === token;
  }

  // A set that has been open a while with nothing to show for it.
  deservesRoast() {
    return Boolean(this.current) && this.current.reps === 0;
  }
}
