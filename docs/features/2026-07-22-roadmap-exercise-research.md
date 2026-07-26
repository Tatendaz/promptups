# Feature: Roadmap + seated/standing exercise catalogs + AirPods tracking research

**Branch:** docs/roadmap-exercise-research
**Date:** 2026-07-22

## Summary
Adds `ROADMAP.md` (v0.2 → v1.0 plan) and the three research documents behind it: a 16-exercise seated arm/upper-body catalog, a 16-exercise standing 1m×1m catalog built around head-bob detection, and a technical feasibility brief for AirPods head-motion tracking. Docs only — no code changes.

## Motivation
v0.1 knows two exercises and requires generous camera framing. The next releases need exercises that work where users actually are — seated in a desk chair, or standing in the square meter between chair and desk — and rep detection that works from head movement alone (camera nose-landmark, later AirPods IMU), so squats count even when legs are out of frame and eventually without a camera at all.

## What changed
- `ROADMAP.md`: design principles, a detection-primitive table (`angle-triple`, `landmark-displacement`, `head-bob`, `timer`), phased milestones (v0.2 seated mode, v0.3 standing 1×1 + head-bob squats, v0.4 AirPods helper, v0.5 calories/streaks, v0.6 Apple Watch/HealthKit, v1.0), a ranked list of ten user-facing improvements, and non-goals. Carries over every item from the old README roadmap.
- `docs/exercises/seated-upper-body.md`: 16 seated exercises with coaching copy, Compendium-matched MET values, noise/sweat ratings, per-exercise detection specs written against `public/reps.js` conventions, 4 curated plans, and a cut list.
- `docs/exercises/standing-1x1.md`: 16 standing exercises for a strict 1m×1m footprint, head-bob amplitudes and AirPods detectability per exercise, a squat-vs-hinge-vs-noise disambiguation cheat sheet, 4 curated plans, and a cut list.
- `docs/research/airpods-head-tracking.md`: CMHeadphoneMotionManager capabilities (macOS 14+), the no-browser-API constraint that forces a native helper, recommended architecture (Swift menu-bar helper → localhost → existing SSE bus), a rep-detection algorithm with pseudocode, prior art, a device support matrix, and top risks.
- `README.md`: roadmap section now points at `ROADMAP.md` instead of duplicating it.

## Notes
- Research was produced by three parallel subagents with web search; MET values are matched to the 2024 Adult Compendium of Physical Activities rather than invented, and unverifiable claims (exact AirPods sample rate, Intel-Mac support) are flagged as such in the docs.
- Key design insight recorded in the roadmap: head-bob squat detection ships first as pure vision (nose landmark Y), and AirPods later feeds the same detector — the primitives are signal-source-agnostic.
- No code, tests, or behavior changes in this PR.
