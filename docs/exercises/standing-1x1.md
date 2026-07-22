# Standing 1m×1m catalog

> Exercise content research for the v0.3 "1×1 box" milestone (see [ROADMAP.md](../../ROADMAP.md)).
> Built around the **head-bob** detection primitive: nose-Y oscillation counts reps even when
> knees/ankles are cropped out of a desk-height webcam frame — and the same signal is detectable
> by AirPods IMU with no camera at all (see [airpods-head-tracking.md](../research/airpods-head-tracking.md)).

**Detection conventions used below.** Baseline = median nose Y over the 2s before the set starts, refreshed between reps at standing. All amplitudes assume a ~1.7m adult; in code, normalize by the nose-to-hip pixel distance (≈0.65m real) so thresholds survive camera geometry. Counters arm only after 2–3 consecutive cycles of consistent amplitude and period — this single rule kills most false positives (picking up a pen, sitting down, leaning for the mouse are one-shot, aperiodic events). AirPods = CMHeadphoneMotionManager: fused attitude + user acceleration at ~25 Hz (developer-reported, not Apple-documented — see [airpods-head-tracking.md](../research/airpods-head-tracking.md)), ample for 0.2–2.5 Hz rep frequencies; it senses acceleration and pitch, not absolute position, so AirPods detectability below is always stated in IMU terms (acceleration amplitude, pitch, periodicity — the cm figures describe what the camera sees), and slow reps and static holds are its weak spot.

MET values below are matched to the **2024 Adult Compendium of Physical Activities** (pacompendium.com): calisthenics light 2.8 (02024), general 3.5 (02030), moderate 3.8 (02022), vigorous 7.5 (02020); bodyweight resistance general 3.0 (02056), high-intensity 6.5 (02057); squats/deadlift slow-or-explosive 5.0 (02052); jogging in place 4.8 (12025); walking, household 2.3 (17150). There is **no Compendium code for marching in place** — estimates for it are interpolations and marked as such.

---

## The catalog

### Air Squat (`airSquat`)
**How-to:** Feet shoulder-width, toes slightly out. Push hips back and down until thighs near parallel, chest up, heels down. Drive up through mid-foot and squeeze glutes at the top.
**Targets:** Quads, glutes, adductors — the exact muscles that shut off during 8 hours of sitting; hip extension counters chair posture.
**Reps:** 30s: 10 · 60s: 20 · 120s: 35–40.
**MET:** 5.0 (02052, squats slow/explosive) for continuous effortful sets; 3.0 (02056) at leisure pace.
**Ratings:** silent · sweat low · knees moderate (shorten depth if cranky).
**Detection:** `head-bob`, primary. Nose drops 25–45cm (~0.4–0.7 torso-lengths); quarter squat ~15cm. Hysteresis: down when nose Y < baseline − 20cm, up when back within 8cm. AirPods: strong — down-brake-up vertical-acceleration signature at 0.2–0.5 Hz, judged on calibrated acceleration amplitude + periodicity (not distance); fidgeting is low-amplitude and aperiodic, far outside this signature. The most IMU-detectable exercise in the catalog. The legacy hip–knee–ankle `angle-triple` (down <110°, up >155°) requires knees/ankles in frame, i.e. user stepping ~2m back — violates the 1m-from-desk reality; keep only as an optional high-fidelity mode.
**Confusion:** vs good morning — in a squat the hip landmark Y drops with the nose; in a hinge it doesn't. vs sitting down — no up-phase within 4s, no count. See cheat sheet below.
**Safety:** Knees track over toes; don't let heels lift. Stop depth at pain-free range.

### Chair-Touch Squat (`chairTouchSquat`)
**How-to:** Set your chair behind you (lock the wheels or use the desk for a fingertip). Squat until glutes lightly touch the seat — no sitting, no plopping — then stand. The chair standardizes depth and catches you.
**Targets:** Same as air squat; the entry point for beginners and tired knees. Cleveland Clinic's desk-exercise guidance uses exactly this pattern.
**Reps:** 30s: 8 · 60s: 16 · 120s: 30.
**MET:** 3.0 (02056, bodyweight resistance general).
**Ratings:** silent · sweat low · knees friendly (best-in-family).
**Detection:** `head-bob`, identical detector to airSquat with a bonus: chair height fixes bottom depth, so amplitude variance is tiny — a very clean, self-calibrating signal. AirPods: strong. Chair-touch pause reads as a plateau at minimum; allow 0–1.5s dwell.
**Safety:** Wheeled chairs must be braced against the desk. Touch, don't rest.

### Tempo Squat (`tempoSquat`)
**How-to:** Same squat, but 3 seconds down, 1 second pause at the bottom, drive up in 1. Count the descent in your head; the pause is where the work lives.
**Targets:** Same muscles, double the time-under-tension — more strength stimulus per rep, valuable when a set is only 8 reps long.
**Reps:** 30s: 5–6 · 60s: 11 · 120s: 22.
**MET:** 5.0 (02052 — "slow effort" squats is literally this code).
**Ratings:** silent · sweat low-moderate · knees moderate.
**Detection:** `head-bob`, same amplitude as airSquat at 0.15–0.2 Hz. Camera: trivial (position-based, speed-agnostic). AirPods: degraded — slow movement means low acceleration; rely on attitude/gravity-referenced velocity reversals and accept lower confidence. Flag tempo mode in the detector so the long bottom plateau isn't mistaken for "user sat down."
**Safety:** Don't hold breath during the pause; exhale on the drive up.

### Pulse Squat (`pulseSquat`)
**How-to:** Sink to just above parallel and stay there, pulsing up-down 10–15cm without standing. Burn is the point; keep heels planted.
**Targets:** Quad/glute endurance and capillary work; big burn, small movement — good for shared offices where big motion feels conspicuous.
**Reps:** 30s: 20 pulses · 60s: 40 · 120s: 2×35 with a stand break.
**MET:** 3.8–6.5 depending on duration (02022 moderate → 02057 high-intensity bodyweight).
**Ratings:** silent · sweat moderate · knees hard (sustained deep flexion — skip with patellofemoral pain).
**Detection:** `head-bob` with a unique signature: mean nose Y depressed 25–35cm below baseline with 8–15cm ripple at 1–2 Hz. Nothing else in the catalog produces "low mean + fast small oscillation," so it's cleanly separable from full squats. AirPods: good — continuous small-amplitude oscillation is easy to pick out of a 25 Hz stream.
**Safety:** Highest knee-load entry here; hard stop on sharp kneecap pain.

### Sumo Squat (`sumoSquat`)
**How-to:** Feet wide (still inside the metre), toes out 30–45°. Squat between your thighs, knees pushed out over toes, torso more upright than a regular squat.
**Targets:** Adductors and glute medius — hip stabilizers desk workers lose; the upright torso is gentler on low backs.
**Reps:** 30s: 10 · 60s: 18 · 120s: 32.
**MET:** 5.0 (02052) brisk; 3.0 (02056) easy.
**Ratings:** silent · sweat low · knees moderate.
**Detection:** `head-bob`, 20–35cm (usually shallower than air squat). **Honest limitation: indistinguishable from airSquat by head signal alone.** If hips/knees are in frame, verify stance via knee-X spread > 1.5× shoulder width (`landmark-displacement`); otherwise trust the user's exercise selection and count with the squat detector. AirPods: strong, same caveat.
**Safety:** Knees out, never caving in; wide stance on a non-slip surface.

### Squat Hold (`squatHold`) — timed hold
**How-to:** Sink to thighs near parallel, arms forward or hands at chest, and hold. Breathe steadily; quads should burn, back should not.
**Targets:** Isometric quad/glute endurance; a wall-sit substitute that needs no wall.
**Reps:** timed — 30s: 20–25s hold · 60s: 40s · 120s: 2×45s.
**MET:** ~2.8 (02024 light calisthenics — plank-class isometric).
**Ratings:** silent · sweat moderate · knees moderate-hard (isometric flexion).
**Detection:** `timer` gated by `head-bob` state: nose Y sustained below baseline − 20cm; pause clock if the user rises early. Camera: trivial. AirPods: weak for the hold itself (statics produce no acceleration) — detect entry descent, then absence of an ascent; medium confidence.
**Safety:** Keep weight in heels/mid-foot; come up if knees tremble toward collapse.

### Bodyweight Good Morning (`goodMorning`)
**How-to:** Hands to temples, soft knees. Push hips straight back and fold the torso forward to ~45–60°, flat back, until hamstrings pull; squeeze glutes to stand tall.
**Targets:** Hamstrings, glutes, spinal erectors — the posterior chain that chair-sitting atrophies; teaches the hip hinge that protects backs.
**Reps:** 30s: 10 · 60s: 18 · 120s: 32.
**MET:** 3.0–3.5 (02056 / 02030).
**Ratings:** silent · sweat low · knees friendly (back-technique-sensitive instead).
**Detection:** `head-bob` + discriminators. Nose drops 30–50cm and translates toward the desk/camera (nose scale grows). The squat/hinge disambiguation is the catalog's central detection problem — resolve with: (a) hip landmark Y stays ~constant in a hinge, drops in a squat; (b) shoulder–hip segment rotates toward horizontal; (c) AirPods attitude **pitch rotates 45–90° in a hinge vs <20° in a squat** — for AirPods-only mode, pitch is the single best squat-vs-hinge feature. vs picking something off the floor: one aperiodic cycle, blocked by the 2–3-cycle arming rule.
**Safety:** The spine stays neutral — range ends where the back wants to round. Never load this pattern in a hurry.

### Standing RDL Reach (`standingRdl`)
**How-to:** Soft knees, hinge at the hips while sliding both hands down your thighs toward the knees/shins, back flat. Stand by driving hips forward. Desk-assisted single-leg variant: fingertips on desk, free leg extends behind you inside the box.
**Targets:** Hamstring length + hinge patterning; the single-leg version adds balance and ankle/hip stabilizers.
**Reps:** 30s: 8 · 60s: 15 · 120s: 14 per side (single-leg).
**MET:** 3.0 (02056); the weighted version of this pattern is 02052's "deadlift," 5.0 — bodyweight is honestly not that.
**Ratings:** silent · sweat low · knees friendly.
**Detection:** `head-bob` (hinge-class, same as goodMorning) + `landmark-displacement`: wrist Y descends toward knee Y while hip Y holds — wrist tracking is the goodMorning-vs-RDL separator (hands stay at head vs slide down legs). Single-leg variant: one wrist pinned at desk height throughout. AirPods: same strong pitch signature as goodMorning; cannot tell the two hinges apart — camera can.
**Safety:** Hinge, don't toe-touch with a rounded back; single-leg only with desk contact.

### Calf Raise (`calfRaise`)
**How-to:** Feet hip-width, fingertips on the desk for balance. Rise onto the balls of your feet as high as possible, pause one beat, lower with control. Single-leg (desk-supported) when 25+ reps get easy.
**Targets:** Gastrocnemius/soleus — the venous pump; standing calf work directly counters lower-leg pooling from sitting. Hinge Health and Cleveland Clinic both put calf raises in their desk lists.
**Reps:** 30s: 15 · 60s: 28 · 120s: 25 per leg (single-leg).
**MET:** 2.8 (02024 light calisthenics).
**Ratings:** silent · sweat minimal · knees friendliest in catalog.
**Detection:** `head-bob`, inverted: nose **rises** 5–8cm above baseline (~0.1 torso-lengths) at 0.5–1 Hz. Sign alone separates it from every squat/hinge (above vs below baseline). Small amplitude demands smoothing + normalized thresholds. AirPods: excellent — crisp, metronomic vertical acceleration pulses; regularity + consistent amplitude over 3+ cycles distinguishes it from restless bouncing, which is irregular. Arguably the best AirPods-only exercise.
**Safety:** Full range beats fast partials; hold the desk, especially single-leg.

### March in Place (`marchInPlace`)
**How-to:** March on the spot, lifting each knee toward hip height, opposite arm swinging. Land toes-first and quiet. Keep it brisk — this is a walk, not a shuffle.
**Targets:** Hip flexors, circulation, step count; the classic "moving during a phone call" filler (UCLA Health, BYU HR desk-exercise guidance).
**Reps:** counted as steps — 30s: 50 · 60s: 100 · 120s: 200.
**MET:** ~3.5 **estimated** — no Compendium code exists for marching in place; interpolated between walking-household 2.3 (17150) and jogging in place 4.8 (12025); brisk high-arm marching approaches military-march-moderate 4.5 (17088).
**Ratings:** quiet (soft steps, no flight phase) · sweat low · knees friendly.
**Detection:** `landmark-displacement`, primary: alternating knee-Y spikes — and here the cropped framing helps: knees are out of frame at rest but **enter the frame bottom when lifted**, so "knee landmark appears + rises toward hip line, alternating L/R" is the counter. Nose bob is only 2–5cm — too near noise to count alone. AirPods: moderate — rhythmic 1.5–2.5 Hz bounce, but nearly identical to actually walking away; camera confirms nose X and scale are stationary.
**Safety:** None beyond footwear; socks on hard floors get slippery.

### High-Knee March (`highKneeMarch`)
**How-to:** March with intent: knee above hip line each rep, fast arm drive, quick ground contact — but always one foot down. No bouncing, no jogging; speed comes from turnover, not impact.
**Targets:** Heart rate, hip flexors, coordination — the flagship "get the heart rate up quietly" move.
**Reps:** 30s: 40 knees · 60s: 80 · 120s: 150.
**MET:** ~4.8–6.0 — anchored to jogging in place 4.8 (12025; the 2024 Compendium cut this from the old 8.0, so be suspicious of sources still quoting 8); hard arm-drive versions push toward vigorous-calisthenics territory (02020, 7.5) without honestly reaching it.
**Ratings:** quiet if coached (flag: the jogged version is thumpy — the app should coach "one foot always down") · sweat moderate-high · knees friendly, hip-flexor-demanding.
**Detection:** `landmark-displacement`: same knee-spike counter as marchInPlace with two discriminators — knee peak Y crosses **above** the hip line (the primary separator; march knees stop below it), and cadence ≥1.2 Hz, consistent with the 40-knees/30s target (~1.3 Hz). Nose bob 4–8cm, secondary confirmation. AirPods: moderate-good — higher-frequency, higher-amplitude bounce than march; still confusable with jogging somewhere, so camera remains primary.
**Safety:** Land forefoot, stay tall; downgrade to marchInPlace when form frays.

### Standing Knee-to-Elbow (`standingKneeToElbow`)
**How-to:** Hands behind head, elbows wide. Crunch one knee up and across while the opposite elbow drives down to meet it near the midline; alternate sides with control.
**Targets:** Obliques and rectus abdominis with the spine loaded vertically — the honest standing-core pick (unlike side bends, which we cut; see below).
**Reps:** 30s: 16 total · 60s: 30 · 120s: 55.
**MET:** 3.8 (02022 moderate calisthenics).
**Ratings:** silent · sweat low-moderate · knees friendly.
**Detection:** `landmark-displacement`, compound: opposite elbow Y drops while knee Y spikes — minimize elbow-to-knee pixel distance per rep — plus a 10–20cm nose dip with lateral nose-X shift (rotation). The elbow-drop separates it from marchInPlace even when the knee is briefly out of frame. AirPods: moderate — pitch-plus-roll wobble per rep is distinctive but small; camera-first.
**Safety:** Pull the elbow down with the abs, not the neck; slow beats fast.

### Desk Push-Up (`deskPushUp`)
**How-to:** Hands on the desk edge just wider than shoulders, walk feet back until your body is a straight ~45° plank, core braced. Lower chest to the desk edge, elbows ~45° from ribs, press back to straight arms.
**Targets:** Chest, anterior delts, triceps, serratus — identical recruitment pattern to a floor push-up at reduced load (NASM lists incline push-up as the standard regression); the only push in the catalog.
**Reps:** 30s: 12 · 60s: 22 · 120s: 40 (ACSM endurance range is 12–20/set — split accordingly).
**MET:** 3.8 (02022 — push-ups, moderate effort).
**Ratings:** silent · sweat low · knees n/a; wrists/shoulders moderate.
**Detection:** the one exercise where `angle-triple` genuinely works at 1m: the user faces the desk — and the camera — dead-on with the upper body filling the frame. Shoulder–elbow–wrist angle: down <100°, up >155°, all landmarks reliably visible. Backup `landmark-displacement`: inter-shoulder pixel width surges 30–60% as the chest approaches the camera (scale oscillation), robust even if the face exits the frame top. Head-bob exists (nose drops 15–25cm, mostly toward-camera) but is perspective-distorted — use scale, not Y. AirPods: good — periodic forward-down pitch bobbing, though lighter than a squat signature.
**Safety:** Desk must be stable (beware rolling standing-desk frames); body straight, no sagging hips.
**Note:** ships in v0.1 as `deskPushups` (side-on framing) — this entry re-tunes it for face-on framing at 1m.

### Desk Burpee (`deskBurpee`)
**How-to:** Squat, place hands on the desk edge, step (never jump) back one foot at a time into the incline plank, optionally one desk push-up, step back in, stand tall with a reach. All inside the box — at 45° incline your feet stay ~0.7m from the desk.
**Targets:** Full body, heart rate — the burpee's conditioning effect with no floor phase, no jump, no noise.
**Reps:** 30s: 5 · 60s: 10 · 120s: 18.
**MET:** ~6.5 (02057 high-intensity bodyweight; true burpees sit in 02020 at 7.5 — the no-jump desk version honestly lands just under).
**Ratings:** quiet (steps, no impact) · sweat high — the sweatiest thing here; cap sets in offices · knees moderate.
**Detection:** state machine over `head-bob` + `landmark-displacement`: large 40–60cm multi-phase nose drop with plateau, shoulder-width scale surge during the plank phase (chest nears desk/camera), 4–6s period. Honest: the hardest detector in the catalog; v1 can count "big slow dip cycles" with the squat detector at a wider tolerance and accept occasional merged reps. AirPods: good — big, unmistakable multi-phase signature.
**Safety:** Stable desk mandatory; step, don't hop, the feet back.

### Step Jack (`stepJack`)
**How-to:** A jumping jack minus the jump: step one foot out to a side tap while both arms sweep overhead, step back in as arms lower; alternate sides. Continuous, rhythmic, flat-footed.
**Targets:** Shoulders, heart rate, coordination — vigorous-jack cardio at neighbor-safe impact.
**Reps:** 30s: 20 · 60s: 40 · 120s: 75.
**MET:** ~3.5–3.8 estimated (02030/02022; full jumping jacks earn 7.5 under 02020 precisely because of the flight phase this removes — do not claim jack-level burn).
**Ratings:** quiet · sweat moderate · knees friendly.
**Detection:** `landmark-displacement`, primary: both wrist Ys rise **above nose Y** each rep at 1–1.5 Hz — large, unambiguous, and fully in frame. Head bob is only 3–6cm. **AirPods: poor — arm motion barely moves the head; this is a camera-only exercise and the catalog's clearest example of the two sensors disagreeing.**
**Safety:** Mind ceiling lamps and monitor arms on the overhead sweep.

### Squat-to-Reach (`squatReach`)
**How-to:** Squat to parallel, then stand explosively while driving both arms straight overhead like a bodyweight thruster; pull arms down as you descend into the next rep.
**Targets:** Legs + shoulders + lungs in one move; the best strength-cardio blend per second of prompt-wait.
**Reps:** 30s: 8 · 60s: 16 · 120s: 30.
**MET:** ~5.0–6.5 (02052 squats 5.0; brisk continuous sets reach 02057, 6.5).
**Ratings:** silent · sweat moderate-high · knees moderate.
**Detection:** `head-bob` + `landmark-displacement` compound: 25–40cm nose drop followed by both wrists above nose at the top — a two-token signature no other exercise or daily-life motion produces; effectively zero confusion. AirPods: strong via the squat component (reach is invisible to it, harmless for counting).
**Safety:** Overhead clearance; shorten the reach under low shelves.

---

### Detector disambiguation cheat sheet

| Signal | airSquat | goodMorning/RDL | pick-up-pen (noise) | sit-down (noise) | calfRaise |
|---|---|---|---|---|---|
| Nose ΔY | −25–45cm, periodic | −30–50cm, periodic | −30–60cm, once | −30cm, stays | +5–8cm, periodic |
| Hip Y | drops | ~constant | varies | drops, stays | constant |
| AirPods pitch | <20° | 45–90° | large, once | small | ~0° |
| Counted? | yes | yes | no (arming rule) | no (no up-phase) | yes |

goodMorning vs standingRdl: wrists at head vs wrists sliding to knees. airSquat vs sumoSquat: not separable by head — user selection. stepJack: wrists-over-nose, no meaningful head bob. Everything counts only during an active set, which bounds false positives structurally.

---

## Curated plans

**Hotfix (~30s)** — 12 air squats, done. One move, zero decisions, breaks sitting inertia. Optimizes: blood flow, habit formation. Fallback for tired days: 15 calf raises.

**Compile Break (~90s)** — 15 air squats → 12 desk push-ups → 15 calf raises. Push–legs–pump in one screenful. Optimizes: strength stimulus across the whole body with silent-rated moves only.

**Refactor (~3min)** — 30s march in place → 12 chair-touch squats → 10 desk push-ups → 12 good mornings → 15 calf raises → 30s march. Optimizes: joints and posture — every hinge/press pattern a desk ruins, warm-up and flush included, all knee-moderate or friendlier.

**The Long Inference (~5min)** — 45s high-knee march → 12 squat-to-reach → 8 desk burpees → 12 standing knee-to-elbow → 20 pulse squats → 12 tempo squats → 45s march to cool. Optimizes: heart rate (peaks early with the ~4.8–6.5 MET block) then descends into strength/tension work as breathing settles. Quiet-rated throughout; the sweatiest plan — offer a "meeting in 10 min" variant that swaps desk burpees for desk push-ups.

---

## Cut list

Considered and rejected — so we don't relitigate them later:

- **Jumping jacks / star jumps** — flight phase: thumpy, downstairs-neighbor-hostile. Step Jack keeps the pattern at office impact.
- **Jogging in place (12025, 4.8 MET)** — real code, but every stride is an impact; high-knee march delivers similar METs silently.
- **Forward/reverse lunges** — stride length flirts with the 1m box, the working knee is below frame, and the head signal is a squat lookalike: footprint risk + detection ambiguity for no unique benefit.
- **Wall sit** — a free wall is not guaranteed in front of a desk, and a motionless body against a wall gives the camera and IMU nothing; squatHold covers it wall-free.
- **Standing side bends** — honest verdict: trivial load for obliques (light-calisthenics 2.8 at best), and the nose moves laterally ~10cm with near-zero vertical or IMU signature — weak stimulus and weak signal. Knee-to-elbow replaces it.

---

**Sources:** [2024 Adult Compendium — Conditioning Exercise](https://pacompendium.com/conditioning-exercise/) · [Walking](https://pacompendium.com/walking/) · [Running (jogging in place 12025)](https://pacompendium.com/running/) · [2024 Adult Compendium update paper](https://pubmed.ncbi.nlm.nih.gov/38242596/) · [NASM incline push-up](https://www.nasm.org/resource-center/exercise-library/incline-push-up) · [Cleveland Clinic desk exercises](https://health.clevelandclinic.org/desk-exercises) · [UCLA Health — active with a desk job](https://www.uclahealth.org/news/article/how-stay-active-with-desk-job) · [Hinge Health desk exercises](https://www.hingehealth.com/resources/articles/exercises-to-do-at-your-desk) · [CMHeadphoneMotionManager docs](https://developer.apple.com/documentation/coremotion/cmheadphonemotionmanager) · [AirPods motion ~25 Hz characterization](https://anandchowdhary.com/notes/2025/airpods-based-head-motion-racing)
