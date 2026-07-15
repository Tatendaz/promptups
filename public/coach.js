// The coach: counts your reps and talks trash while Claude talks tokens.
// Canned lines by default. With `promptups start --ai-coach`, session-end
// lines come fresh from a local `claude -p` Haiku call (see /api/quip),
// and these banks become the offline fallback.

export const LINES = {
  start: [
    "Claude's typing. Drop.",
    "Tokens are streaming. So is your sweat. Go.",
    "The agent works. You work. Deal.",
    "Inference started. Legs, bend.",
    "You prompted. Now you pay. Move.",
    "While it thinks, you lift. House rules.",
  ],
  milestone: [
    "The compiler fears you.",
    "Your code reviewer could never.",
    "That's more reps than your test coverage.",
    "Somewhere, a standing desk is jealous.",
    "Keep going. The tokens aren't done.",
    "Form check: better than your git history.",
  ],
  finish: [
    "Claude shipped. So did your legs.",
    "Code's ready. You're readier.",
    "That's a merge. Go read the diff.",
    "Nice set. Now review what the robot wrote.",
    "Gains committed. Push approved.",
  ],
  zeroReps: [
    "Claude's done. You did nothing. Bold strategy.",
    "Zero reps. The AI is carrying this whole team.",
    "The model did more work than you. Again.",
  ],
  attention: [
    "Claude needs a human. That's you. Keyboard, now.",
    "Permission check. Go click the button, champ.",
    "Pause. The robot has questions.",
  ],
  roast: [
    "Twenty-five seconds. Zero reps. The camera sees everything.",
    "You know standing there is not an exercise, right?",
    "Claude is on line 200. You are on rep zero.",
  ],
};

// Shuffle-bag picker: no repeats until a bank is exhausted.
const bags = {};
function pick(bank) {
  if (!bags[bank] || bags[bank].length === 0) {
    bags[bank] = [...LINES[bank]].sort(() => Math.random() - 0.5);
  }
  return bags[bank].pop();
}

// Ask the server for an AI-generated line; fall back to the banks.
async function quip(moment, reps, exercise) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const res = await fetch(
      `/api/quip?moment=${encodeURIComponent(moment)}&reps=${reps}&exercise=${encodeURIComponent(exercise)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    const data = await res.json();
    if (data.quip) return data.quip;
  } catch {
    /* server down or --ai-coach off: use the banks */
  }
  if (moment === "done") return pick(reps > 0 ? "finish" : "zeroReps");
  return pick(moment in LINES ? moment : "milestone");
}

export const coach = { pick, quip };
