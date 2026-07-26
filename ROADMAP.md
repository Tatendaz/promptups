# PromptUps Roadmap

*Last updated 2026-07-22. Supersedes the mini-roadmap in the README.*

v0.1 proved the loop: prompt Claude → camera counts → chime → diff. But it only knows two exercises, both need generous framing, and it's camera-or-nothing. The next arc is about meeting people **where they actually are — in a chair, or standing in the one square meter between it and the desk** — and counting reps from whatever signal is available, camera or AirPods.

Three research docs back this roadmap:

- [docs/exercises/seated-upper-body.md](docs/exercises/seated-upper-body.md) — 16 seated arm/upper-body exercises with detection specs, METs, and plans
- [docs/exercises/standing-1x1.md](docs/exercises/standing-1x1.md) — 16 standing exercises for a 1m×1m footprint, built around head-bob detection
- [docs/research/airpods-head-tracking.md](docs/research/airpods-head-tracking.md) — CMHeadphoneMotionManager feasibility, architecture, and rep-detection algorithm

## Design principles

1. **The desk is the gym.** Every exercise works seated in a desk chair or standing in a 1m×1m box in front of the computer. No "step back 2 meters" framing demands, no floor phase, no equipment by default.
2. **Detectors follow signals, not exercises.** One rep engine, multiple primitives (joint angle, head bob, landmark displacement, timed hold), multiple signal sources (camera, AirPods IMU). An exercise declares which primitive + source combinations can count it.
3. **The camera is honest — and stays home.** Everything keeps processing locally. New sensors follow the same rule: AirPods samples never leave the machine.
4. **Sets are 30 seconds to 5 minutes.** Programming, coaching, and calorie math are all tuned for many short sets a day, not workouts.

## Detection engine: from angles to primitives

The heart of the next three releases is generalizing `reps.js` from "angle-triple hysteresis" to a small family of primitives that all share the same hysteresis + smoothing + minimum-phase philosophy:

| Primitive | What it measures | Signal sources | Status | Unlocks |
| --- | --- | --- | --- | --- |
| `angle-triple` | joint angle at a landmark triple | camera | ✅ shipped (v0.1) | squats (legs in frame), desk push-ups, presses, curls, raises |
| `landmark-displacement` | a landmark crossing a body-relative line (wrist above nose, knee above hip, shoulder-width scale change) | camera | v0.2 | air angels, cross jabs, marches, step jacks, neck scans |
| `head-bob` | vertical oscillation of the nose landmark, normalized by nose–hip distance, with baseline + 2–3-cycle arming | camera **or AirPods** | v0.3 (camera), v0.4 (AirPods) | **squats without legs in frame**, calf raises, hinges, desk burpees |
| `timer` (+ posture gate) | timed holds, optionally gated by a pose check | camera, AirPods (entry/exit only) | v0.2 | scap squeezes, chin tucks, squat holds, planks, wrist resets |

The exercise registry grows matching metadata: `category` (seated / standing-1x1 / floor), `noise`, `sweat`, `knee` rating, `met` value, `equipment`, and per-primitive detection specs — all already written per-exercise in the catalog docs.

---

## v0.2 — Sit Down, Arms Up *(seated mode)*

Reps without leaving the chair. Catalog: [seated-upper-body.md](docs/exercises/seated-upper-body.md).

- [ ] Registry metadata expansion in `reps.js` (category, METs, noise/sweat, equipment, detection spec) — keep the "one entry = one exercise" contributor story
- [ ] `landmark-displacement` primitive + `timer`/hold primitive with posture gates
- [ ] Ship the high-confidence seated eight first: `overheadPress`, `lateralRaise`, `bicepCurl`, `victoryRaise`, `airAngel`, `reverseFly`, `crossJab`, `neckRotations`
- [ ] Second wave: holds (`scapSqueeze`, `chinTuck`, `prayerPress`, `wristReset`) and the trickier detectors (`armCircles`, `shoulderRolls`, `torsoTwist`, `bandRow`)
- [ ] Exercise picker UI that scales past 2 buttons: grouped seated/standing, filter by silent/no-sweat ("on a call" mode)
- [ ] Curated plans as a first-class concept (sequence + rep targets): *Quick Compile*, *Code Review*, *Full Rebuild*, *Tech Debt Repayment*
- [ ] Rolling-chair safety copy in cues (brace feet, lock wheels) per catalog safety notes

## v0.3 — The 1×1 Box *(standing mode + head-bob detection)*

Stand up between the chair and the desk; the camera counts you even though your legs are cropped. Catalog: [standing-1x1.md](docs/exercises/standing-1x1.md).

- [ ] **`head-bob` detector (camera)**: nose-Y baseline capture, normalization by nose–hip distance, hysteresis + 2–3-cycle arming rule, between-rep baseline refresh
- [ ] **Squats re-detected from head movement** — nose drop 20cm+ replaces the hip–knee–ankle angle as the default squat counter; the v0.1 angle-triple stays as an opt-in "high-fidelity mode" for people who can step back
- [ ] Squat family: `airSquat`, `chairTouchSquat`, `tempoSquat`, `pulseSquat`, `sumoSquat`, `squatHold`
- [ ] Hinge disambiguation (squat vs `goodMorning`/`standingRdl` vs picking-up-a-pen) via hip-Y + torso-rotation discriminators — cheat-sheet in the catalog
- [ ] The rest of the box: `calfRaise` (inverted head-bob), `marchInPlace` + `highKneeMarch` (knee-spike counter), `standingKneeToElbow`, `stepJack`, `squatReach`, `deskBurpee`, face-on `deskPushUp` re-tune
- [ ] Standing plans: *Hotfix*, *Compile Break*, *Refactor*, *The Long Inference*
- [ ] Noise/impact ratings surfaced in the picker (apartment-friendly filter — everything shipped is flight-phase-free)

## v0.4 — Ears On, Camera Optional *(AirPods head tracking)*

Count squats with the lid closed, the camera off, or your back to the screen. Research: [airpods-head-tracking.md](docs/research/airpods-head-tracking.md).

- [ ] **`promptups-motion` helper**: ~300-line Swift menu-bar app (macOS 14+, CMHeadphoneMotionManager) streaming gravity-projected vertical acceleration + pitch to the Node server on localhost
- [ ] Server: `/api/motion` ingest → existing SSE bus; browser treats camera and AirPods as interchangeable head-bob signal sources
- [ ] IMU rep counter per the researched algorithm: project onto gravity → band-pass 0.15–0.7 Hz → hysteresis state machine with periodicity gate (pseudocode in the research doc)
- [ ] Squat-vs-hinge via attitude pitch (<20° squat, 45–90° hinge); nod/sit-down/walk-away rejection via amplitude + periodicity
- [ ] Sensor fusion when both are live: cross-validate, prefer agreement, surface disagreement as a form cue
- [ ] Connection UX: in-ear/dropout/auto-switching handling — pause the set visibly, never silently miss reps
- [ ] Camera-free mode: audio-only coaching through the AirPods (the coach was built for this)
- [ ] Distribution: Developer ID signing + notarization for the helper; graceful fallback to camera on macOS < 14 or no-motion AirPods (runtime `isDeviceMotionAvailable` gate, not a model list)

## v0.5 — Make It Count *(calories, goals, streaks)*

The stats page grows from four numbers into a reason to come back tomorrow.

- [ ] Calories per set/day/all-time: MET × weight × duration, using the per-exercise MET values already in the catalogs; optional body-weight setting (local only), honest "estimate" labeling
- [ ] Daily goal + streak tracking, streak-aware coach lines
- [ ] Achievements: first 100-rep day, 7-day streak, 1,000 lifetime squats, every-exercise-once…
- [ ] `reps per 1k tokens` — someone has to invent the metric *(carried over from v0.1 roadmap)*
- [ ] Shareable end-of-day set card *(carried over)*, plus a weekly recap
- [ ] "Coach picks" smart rotation: balance push/pull/legs/neck across the day's prompts, never repeat yesterday's sore spot, respect injury/noise filters

## v0.6 — Health Ecosystem *(Apple Watch + HealthKit)*

- [ ] Companion iOS/watchOS app: log each set as a HealthKit workout → ring credit, real calorie tracking
- [ ] Real heart rate from the Watch during sets → replace MET estimates with measured burn where available
- [ ] Watch haptics for rep milestones; Start/stop mirroring on the wrist
- [ ] This companion doubles as architecture option (b) for AirPods motion on pre-Sonoma Macs

## v1.0 — Everyone's Gym

- [ ] Floor push-ups and sit-ups, tuned for a phone camera at floor level *(carried over)*
- [ ] Plank timer for long agentic runs *(carried over — lands early via the v0.2 `timer` primitive)*
- [ ] Adapters for other agent CLIs and triggers: Codex/Gemini CLI, CI pipelines, `npm install`, Pomodoro mode *(carried over — the trigger surface is still two HTTP endpoints)*
- [ ] Meeting-aware auto-pause (camera/mic-in-use detection, calendar hint)
- [ ] Opt-in team leaderboard / office challenge relay (self-hostable, aggregate reps only — no video, ever)
- [ ] Coach personality packs (drill sergeant / zen / hype / disappointed principal engineer) + pluggable TTS voices
- [ ] Headless-browser test harness for the camera orchestration in `app.js` *(carried over — should really land alongside v0.3's detector work)*
- [ ] npm publish (`npx promptups`)

---

## Ten improvements for users, ranked

The backlog behind the milestones above, in rough value order:

1. **Calories burned** — MET-based per-set estimates; the catalogs already carry honest MET values per exercise. *(v0.5)*
2. **Apple Watch + HealthKit sync** — sets become real workouts: ring credit, measured heart rate, calorie truth. *(v0.6)*
3. **Streaks, daily goals & achievements** — `sessions.json` already has every number needed; this is pure motivation UI. *(v0.5)*
4. **Coach-picks smart rotation** — stop letting users do 400 squats and nothing else; balance muscle groups across a day of prompts, avoid RSI from repetition. *(v0.5)*
5. **Form & depth feedback** — the engine already measures angles and amplitudes; grade rep quality ("last three were half reps") instead of only counting. *(v0.3+)*
6. **Shareable set cards + weekly recap** — end-of-day card for the group chat, weekly totals with trends. *(v0.5)*
7. **"On a call" mode** — one toggle that filters to silent, sweat-free, subtle exercises and mutes the coach; the noise/sweat metadata ships in v0.2. *(v0.2)*
8. **More triggers** — other agent CLIs, CI runs, long builds, Pomodoro; every long wait is a set opportunity. *(v1.0)*
9. **Injury-aware filters** — knee-friendly, shoulder-safe, RSI-flare modes driven by the per-exercise safety metadata. *(v0.5)*
10. **Coach personalities + AirPods audio-first coaching** — pick your abuser; with v0.4, the whole experience works eyes-free and camera-free. *(v0.4–v1.0)*

## Non-goals

- Cloud accounts, video upload, or any frame leaving the machine — the privacy badge is the product
- Real fitness-app ambitions (programs, progressive overload periodization) — this is the gym between prompts, not a coach replacement
- Windows/Linux AirPods support — no OS API exists; those platforms stay camera-first
