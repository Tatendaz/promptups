// Rep-counting core: pure geometry + a hysteresis state machine.
// No DOM, no MediaPipe imports — usable from the browser and from node:test.

// MediaPipe pose landmark indices.
export const L = {
  shoulderL: 11, shoulderR: 12,
  elbowL: 13, elbowR: 14,
  wristL: 15, wristR: 16,
  hipL: 23, hipR: 24,
  kneeL: 25, kneeR: 26,
  ankleL: 27, ankleR: 28,
};

// An exercise is a joint triple per side plus angle thresholds (degrees).
// Add a new exercise = add an entry here. Thresholds are tunable.
export const EXERCISES = {
  squats: {
    label: "squats",
    sides: [
      [L.hipL, L.kneeL, L.ankleL],
      [L.hipR, L.kneeR, L.ankleR],
    ],
    downBelow: 110, // knee angle at the bottom of a squat
    upAbove: 155,   // knee angle standing tall
    cue: "step back so your hips and knees are in frame",
  },
  deskPushups: {
    label: "desk push-ups",
    sides: [
      [L.shoulderL, L.elbowL, L.wristL],
      [L.shoulderR, L.elbowR, L.wristR],
    ],
    downBelow: 105, // elbow angle at the bottom
    upAbove: 150,   // elbow angle locked out
    cue: "hands on the desk edge, stand side-on to the camera",
  },
};

// Angle at vertex b, in degrees, formed by points a-b-c.
export function angleAt(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1e-9;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

// Average joint angle across whichever sides are confidently in frame,
// or null when neither side is visible enough to trust.
export function visibleAngle(lm, ex, minVisibility = 0.5) {
  const angles = [];
  for (const [a, b, c] of ex.sides) {
    const pts = [lm[a], lm[b], lm[c]];
    if (pts.every((p) => p && (p.visibility ?? 1) > minVisibility)) {
      angles.push(angleAt(pts[0], pts[1], pts[2]));
    }
  }
  return angles.length ? angles.reduce((s, x) => s + x, 0) / angles.length : null;
}

// Hysteresis state machine: down past one threshold, up past the other = 1 rep.
// Light exponential smoothing so landmark jitter can't fake a rep, and a
// minimum down-phase duration so a bounce can't either.
export class RepCounter {
  constructor(ex, { minDownMs = 350, alpha = 0.35 } = {}) {
    this.ex = ex;
    this.minDownMs = minDownMs;
    this.alpha = alpha;
    this.phase = "up";
    this.downAt = 0;
    this.smoothed = null;
  }
  feed(angle, now) {
    this.smoothed =
      this.smoothed === null ? angle : (1 - this.alpha) * this.smoothed + this.alpha * angle;
    if (this.phase === "up" && this.smoothed < this.ex.downBelow) {
      this.phase = "down";
      this.downAt = now;
      return false;
    }
    if (this.phase === "down" && this.smoothed > this.ex.upAbove && now - this.downAt > this.minDownMs) {
      this.phase = "up";
      return true;
    }
    return false;
  }
}
