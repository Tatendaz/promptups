# Seated arm & upper-body catalog

> Exercise content research for the v0.2 "seated mode" milestone (see [ROADMAP.md](../../ROADMAP.md)).
> Every entry includes a detection spec in the vocabulary of `public/reps.js`:
> `angle-triple` (ships today), `landmark-displacement` (new primitive), or `timer` (new primitive).
> MET values are nearest honest matches from the 2024 Adult Compendium of Physical Activities.

All MET values are honest nearest matches from the 2024 Adult Compendium of Physical Activities (pacompendium.com). Seated versions sit at the low end of each range. MediaPipe indices: shoulder 11/12, elbow 13/14, wrist 15/16, hip 23/24, nose 0, ears 7/8. All exercises are fully seated and rolling-chair-safe unless flagged.

## The catalog

### 1. `overheadPress` — Ceiling Press
- **How-to:** Fists at shoulder height, elbows bent. Press both hands straight up until arms are fully extended overhead, then lower with control back to shoulders. Keep ribs down — don't arch your lower back to finish the rep.
- **Targets:** Delts, triceps, upper traps. Re-activates shoulders stuck in mouse position.
- **Reps:** 30s: 10 · 60s: 18 · 120s: 2×14 (20s rest)
- **MET:** 2.8 — Compendium 02024, calisthenics, light effort. *Variant:* water bottles/light dumbbells, 3.5 — Compendium 02054, resistance training, 8–15 reps.
- **Noise/Sweat:** silent / light
- **Detection:** `angle-triple` shoulder–elbow–wrist (11-13-15 / 12-14-16). downBelow 100°, upAbove 150°. Framing: scoot back so fists at lockout stay in frame. Vertical-plane motion, confidence high.
- **Safety:** Check ceiling/lamp clearance. Shoulder pain at lockout → stop short of full extension.

### 2. `lateralRaise` — Wingspan
- **How-to:** Arms at your sides, slight elbow bend, thumbs up. Raise both arms out to a T at shoulder height, pause, lower slowly. Stop at shoulder height — no higher.
- **Targets:** Lateral delts, upper traps. Wakes up the shoulder girdle after hours of 10cm mouse movements.
- **Reps:** 30s: 10 · 60s: 16 · 120s: 2×12
- **MET:** 2.8 — Compendium 02024, calisthenics, light effort. *Variant:* light dumbbells/bottles, 3.5 — Compendium 02054.
- **Noise/Sweat:** silent / light
- **Detection:** `angle-triple` hip–shoulder–elbow (23-11-13 / 24-12-14). downBelow 35°, upAbove 70°. MediaPipe infers hips acceptably even when the chair occludes them; frontal-plane motion, confidence high. Framing: both elbows visible at the T.
- **Safety:** Thumbs-up, shoulder-height max — protects against impingement. Bend elbows 90° if a neighbor is within a meter.

### 3. `bicepCurl` — Phantom Curls
- **How-to:** Elbows pinned to your ribs, palms up. Curl both fists to your shoulders, squeeze, then lower until arms are fully straight. Slow negatives — empty hands still count if you flex hard the whole way.
- **Targets:** Biceps, forearms. Grip/elbow blood flow for keyboard arms.
- **Reps:** 30s: 12 · 60s: 20 · 120s: 3×12
- **MET:** 2.8 — Compendium 02024, calisthenics, light effort. *Variant:* bottle/band under feet, 3.5 — Compendium 02054.
- **Noise/Sweat:** silent / none–light
- **Detection:** `angle-triple` shoulder–elbow–wrist (11-13-15 / 12-14-16). Inverted semantics: "down" phase = curled, angle < 60°; rep counts on extension > 150°. Forearm sweeps the frontal plane, confidence high. Framing: elbows stay at ribs.
- **Safety:** Wrists neutral; skip the weighted variant during RSI flare-ups.

### 4. `victoryRaise` — Victory Raise
- **How-to:** Straight arms starting at your thighs. Sweep them out and up into a wide overhead V, like you just shipped to prod, then lower along the same arc. Shoulders down away from ears the whole time.
- **Targets:** Delts, lower traps, lats (stretch). Full range antidote to the T-rex desk arm.
- **Reps:** 30s: 8 · 60s: 14 · 120s: 2×12
- **MET:** 2.8 — Compendium 02024, calisthenics, light effort.
- **Noise/Sweat:** silent / light
- **Detection:** `angle-triple` hip–shoulder–wrist (23-11-15 / 24-12-16). downBelow 45°, upAbove 130°. Frontal plane, confidence high. Framing: lean back a touch so wrists stay in frame overhead.
- **Safety:** Impingement-prone shoulders: keep the V wide (45° off vertical), not a narrow overhead reach.

### 5. `airAngel` — Air Angels
- **How-to:** Goalpost arms — elbows at shoulder height, bent 90°, palms forward. Slide both hands up until arms are nearly straight overhead, then pull elbows back down toward your ribs, squeezing shoulder blades. It's a wall angel without the wall.
- **Targets:** Lower traps, serratus, rear delts; opens chest after hunching. Physio staple for upper-crossed posture.
- **Reps:** 30s: 8 · 60s: 12 · 120s: 2×10 (slow)
- **MET:** 2.8 — Compendium 02024, calisthenics, light effort.
- **Noise/Sweat:** silent / none–light
- **Detection:** `landmark-displacement` — both wrists' Y above nose (0) Y = up; both wrists' Y back below shoulder Y (11/12) = down, one cycle per rep. Frontal plane, confidence high. Framing: whole goalpost in frame.
- **Safety:** Only rise as far as you can without the lower back arching or shoulders shrugging.

### 6. `reverseFly` — T-Opens
- **How-to:** Arms straight out in front at shoulder height, palms in, hands together. Sweep both arms horizontally out to a full T, pinching your shoulder blades, then return. Chest proud, neck long.
- **Targets:** Rear delts, mid-traps, rhomboids. The direct counter-move to keyboard hunch.
- **Reps:** 30s: 8 · 60s: 14 · 120s: 2×12
- **MET:** 2.8 — Compendium 02024, calisthenics, light effort. *Variant:* band pull-apart (band held at shoulder height), 3.5 — Compendium 02054.
- **Noise/Sweat:** silent / none–light
- **Detection:** `landmark-displacement` — wrist X separation normalized to shoulder width: closed < 1.2×, open > 1.8×. Start position is toward-camera (foreshortened) but the 2D open/close signature is strong; confidence medium-high. Framing: full T must fit — needs the ~1m side clearance.
- **Safety:** Don't punch a monitor or coworker on the return; band variant: keep tension modest, no jerking.

### 7. `armCircles` — Prop Wash
- **How-to:** Arms out in a T, then draw big, slow backward circles — hands rise above your head and dip below the seat back. Backward only; that's the direction desk posture stole from you.
- **Targets:** Delts, rotator cuff, scapular rhythm. Continuous shoulder lubrication.
- **Reps:** 30s: 10 circles · 60s: 2×10 (switch to tiny pulses if burning) · 120s: 3×12
- **MET:** 2.8 — Compendium 02115, upper body exercise, arm ergometer, general, light (nearest continuous-arm-work match).
- **Noise/Sweat:** silent / light
- **Detection:** `landmark-displacement` — wrist Y oscillation: above nose Y (top) then below shoulder Y (bottom) = one circle. Only big circles count reliably; small circles are noise. Confidence medium. Framing: same clearance as T-Opens.
- **Safety:** Shoulder clunking or pinching → shrink the circle or skip.

### 8. `crossJab` — Crossfire Punches
- **How-to:** Fists up in a guard. Throw alternating punches across your body — right fist toward the left edge of your screen and back, then left fist right. Snappy out, controlled back, shoulders loose.
- **Targets:** Delts, pecs, obliques, plus actual heart rate. The closest thing to seated cardio.
- **Reps:** 30s: 24 (12/side) · 60s: 44 · 120s: 2×40
- **MET:** 3.5 — Compendium 02030, calisthenics, light or moderate effort, general (fast pace approaches 02143, video exercise workout moderate, 4.0).
- **Noise/Sweat:** quiet (chair may creak) / light, real by 3 min
- **Detection:** `landmark-displacement` — wrist X crosses the opposite shoulder's X, alternating sides. Cross-body path keeps motion in the frontal plane (a straight jab at the camera would be undetectable). Confidence high at moderate speed; very fast punching may outrun pose FPS — cap cadence in coaching.
- **Safety:** Punch across, never at the desk; keep elbows soft at extension. Plant feet so the chair doesn't swivel.

### 9. `shoulderRolls` — Debug Rolls
- **How-to:** Sit tall, arms relaxed. Lift both shoulders toward your ears, roll them back and down in a big circle. Up-back-down, exaggerated — make each roll a production.
- **Targets:** Upper traps release, scapular mobility. First-aid for tension you didn't know you were holding.
- **Reps:** 30s: 8 · 60s: 12 · 120s: 2×10
- **MET:** 2.3 — Compendium 02101, stretching, mild (nearest gentle-mobility match).
- **Noise/Sweat:** silent / none
- **Detection:** `landmark-displacement` — both shoulders' (11/12) Y rise above baseline by ≥ 0.3× the ear–shoulder distance, then return. Small amplitude; needs per-user baseline calibration and heavy smoothing. Confidence medium.
- **Safety:** None significant. Roll backward, not forward.

### 10. `scapSqueeze` — Blade Runner *(timed hold)*
- **How-to:** Sit tall, arms at sides or bent 90°. Pull your shoulder blades back and together like you're pinching a pencil between them — without shrugging — and hold 10 seconds. Breathe; the blades do the work, not the neck.
- **Targets:** Rhomboids, mid/lower traps. Mayo Clinic's own pick for undoing the hunch.
- **Reps:** 30s: 2×10s hold · 60s: 4×10s · 120s: 6×12s
- **MET:** 2.8 — Compendium 02024, calisthenics, light effort (isometric/plank family).
- **Noise/Sweat:** silent / none
- **Detection:** `timer` — retraction is depth-axis, nearly invisible to a front camera. Optional posture check: shoulders not shrugging (ear–shoulder Y distance stable) and torso upright. Confidence of the check: low-medium.
- **Safety:** No shrugging, no breath-holding.

### 11. `chinTuck` — Turtle Mode *(timed hold)*
- **How-to:** Eyes on the horizon, then glide your head straight back like you're making a proud double chin — no tilting up or down. Hold 8 seconds, release. This is a small, subtle move; nobody on your video call will notice.
- **Targets:** Deep neck flexors; reverses forward-head posture. The single most physio-endorsed desk exercise.
- **Reps:** 30s: 3×8s · 60s: 5×8s · 120s: 8×10s
- **MET:** 2.3 — Compendium 02101, stretching, mild.
- **Noise/Sweat:** silent / none
- **Detection:** `timer` — motion is almost purely depth-axis; nose-to-shoulder 2D offset barely changes. Optional low-confidence check: nose (0) Y stays level (rules out looking down at the phone). Do not attempt rep counting.
- **Safety:** Gentle glide, never jam. Dizziness or nerve tingling → stop.

### 12. `neckRotations` — NACK Scan
- **How-to:** Sit tall, shoulders still. Slowly turn your head to look over your right shoulder, return to center, then over the left. Two seconds each way — this is a scan, not a whip.
- **Targets:** Cervical rotation mobility; counters locked-forward gaze. RSI/neck-issue friendly.
- **Reps:** 30s: 4/side · 60s: 7/side · 120s: 12/side
- **MET:** 2.3 — Compendium 02101, stretching, mild.
- **Noise/Sweat:** silent / none
- **Detection:** `landmark-displacement` — nose (0) X deviates from the shoulder midpoint by > 0.35× shoulder width, alternating sides (head yaw also collapses the 2D eye/ear spacing as a secondary signal). Confidence medium-high. Framing: face centered. *(Also a natural AirPods yaw-gyro exercise — see docs/research/airpods-head-tracking.md.)*
- **Safety:** Slow and pain-free range only; skip full 360° neck circles entirely.

### 13. `torsoTwist` — Merge Conflict
- **How-to:** Feet planted, hands crossed on chest. Rotate your ribcage to the right until your shoulders face 45°, return, then left. Twist from the mid-back — your hips and the chair stay put.
- **Targets:** Thoracic rotation, obliques. Un-fuses the mid-back that sitting welds solid.
- **Reps:** 30s: 5/side · 60s: 8/side · 120s: 14/side
- **MET:** 2.8 — Compendium 02024, calisthenics, light effort.
- **Noise/Sweat:** silent / none
- **Detection:** `landmark-displacement` — 2D shoulder X separation compresses below 0.65× calibrated width, alternating which shoulder is nearer (use landmark z or relative size). Rotation is partly depth-axis; a swiveling chair produces false positives. Confidence medium-low.
- **Safety:** **Brace feet so the chair doesn't swivel** (or lock the swivel) — the spine should rotate, not the chair. Keep it gentle with disc issues.

### 14. `prayerPress` — Prayer Press *(timed hold)*
- **How-to:** Palms together at mid-chest, elbows wide. Press your hands into each other hard — like you're begging CI to pass — and hold 10 seconds, breathing normally. Release slowly.
- **Targets:** Pecs, delts isometrically; zero joint movement makes it the most RSI-tolerant strength move here.
- **Reps:** 30s: 2×10s · 60s: 4×10s · 120s: 6×12s
- **MET:** 2.8 — Compendium 02024, calisthenics, light effort (isometric family).
- **Noise/Sweat:** silent / none–light
- **Detection:** `timer` with posture check: wrist X separation < 0.25× shoulder width and wrists' Y between shoulder and hip Y (hands actually pressed at chest). Force itself is invisible. Check confidence medium-high.
- **Safety:** Keep pressing effort below breath-holding/face-reddening; skip with wrist pain.

### 15. `wristReset` — RSI Rollback *(timed hold)*
- **How-to:** Right arm straight out, palm up; use your left hand to gently pull the right fingers down and back until the forearm stretches. Hold 20 seconds, then flip palm down and repeat, then switch arms.
- **Targets:** Wrist flexors/extensors — direct carpal-tunnel and mouse-arm relief.
- **Reps:** 30s: 1×20s one arm · 60s: 20s per arm · 120s: 2×20s per arm, both directions
- **MET:** 2.3 — Compendium 02101, stretching, mild.
- **Noise/Sweat:** silent / none
- **Detection:** `timer` with posture check: one elbow angle (shoulder–elbow–wrist) > 150° with that wrist near shoulder height; hand-pull detail is below pose-model resolution. Check confidence medium.
- **Safety:** Gentle tension, never pain; essential companion to any curl/press programming for RSI users.

### 16. `bandRow` — Cable Puller *(equipment variant — resistance band required)*
- **How-to:** Loop the band under both feet (shoes on), grab an end in each hand, sit tall. Pull both elbows straight back until hands reach your ribs, squeeze the shoulder blades, release slowly.
- **Targets:** Lats, rhomboids, biceps. The pulling strength desk work never gives you.
- **Reps:** 30s: 10 · 60s: 16 · 120s: 2×14
- **MET:** 3.5 — Compendium 02054, resistance training, 8–15 reps.
- **Noise/Sweat:** quiet (band slap possible) / light
- **Detection:** `angle-triple` shoulder–elbow–wrist (11-13-15 / 12-14-16): extended > 150° ("up"), pulled < 80° ("down" phase at ribs). Elbows travel behind the torso (partly depth-axis) but the projected elbow angle still closes clearly. Confidence medium.
- **Safety:** Band must be fully trapped under both feet — a snapped anchor hits your face. Inspect band for tears. Feet planted stops chair roll.

---

## Curated plans

### Quick Compile — ~30s
Ten seconds of setup is the enemy; this starts instantly from a sitting position.
1. `overheadPress` ×8
2. `reverseFly` ×6
**Optimizing:** maximum blood flow per token generated; zero equipment, zero sweat, safe 30 seconds before a standup.

### Code Review — ~90s
1. `shoulderRolls` ×6 (warm-up)
2. `lateralRaise` ×10
3. `airAngel` ×8
4. `crossJab` ×20
**Optimizing:** full shoulder-girdle coverage — mobility, raise, scap control, then a pulse finisher. Silent except mild chair creak.

### Full Rebuild — ~3min
1. `armCircles` ×8 backward
2. `overheadPress` ×12
3. `bicepCurl` ×15
4. `reverseFly` ×12
5. `crossJab` ×30
6. `scapSqueeze` 2×10s hold
**Optimizing:** real training volume — push, curl, pull-pattern, cardio, isometric close-out. The only plan that risks a visible glow; skip `crossJab` on video-call days.

### Tech Debt Repayment — ~3min, posture/RSI focus
1. `chinTuck` 3×8s
2. `neckRotations` ×6/side
3. `scapSqueeze` 3×10s
4. `airAngel` ×10
5. `reverseFly` ×12
6. `wristReset` 20s per arm
**Optimizing:** systematically reverses the day's damage — forward head, locked neck, hunched blades, tight chest, cooked wrists. 100% silent, sweat-free, and subtle enough to run mid-meeting.

---

## Cut list

Considered and rejected — so we don't relitigate them later:

1. **Chair dips (seat-edge triceps dips)** — load-bearing on a rolling chair edge is a tip-over hazard, deep dips are impingement-prone, and the body drops out of frame. Rejected: unsafe in chair.
2. **Desk push-ups** — violates fully-seated; face leaves frame at the bottom. Rejected for this catalog (already ships as a standing exercise in v0.1).
3. **Front raises & straight jab-cross at camera** — motion lives on the depth axis; foreshortening makes angle hysteresis fire randomly. Replaced by `lateralRaise` and `crossJab`. Rejected: undetectable.
4. **Triceps kickbacks / overhead triceps extensions** — wrists occluded behind torso or head, and the forward hinge exits frame. Rejected: undetectable.
5. **Seated knee raises / leg extensions** — knees and ankles are almost never in a chest-height webcam's frame, and it's out of scope for an arm/upper-body catalog. Rejected: undetectable.

Sources: [2024 Adult Compendium — Conditioning Exercise](https://pacompendium.com/conditioning-exercise/) · [Mayo Clinic — shoulder blade squeeze](https://www.mayoclinic.org/img-20076263) · [Mayo Clinic Health System — office exercises](https://www.mayoclinichealthsystem.org/hometown-health/speaking-of-health/dont-just-sit-there-exercises-for-the-office) · [PT Progress — chin tuck](https://www.ptprogress.com/chin-tuck-exercise/) · [Logan Physio — office worker posture](https://loganphysio.com.au/top-exercises-office-worker-posture-back-pain/)
