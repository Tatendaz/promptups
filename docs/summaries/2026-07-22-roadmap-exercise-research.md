# Session: Roadmap, exercise research subagents, and the ten improvements

**Branch:** docs/roadmap-exercise-research
**Date:** 2026-07-22

## Prompts

1. "can you create a roadmap we need to add exercises that you can do while sitting using your arms. we need to add exercises that you can do right in front of the computer so 1m by 1m space in front of the computer we need to add ipods tracking so instead of just vision we can use ipods to track head movement and detect whether someone is exercising, squats should be detected by head movement going up and down rather than the whole body. Start a couple of subagents that can research and come up with exercise plans that we can offer prompters that can be done in front of the computer either while sitting or standing in front of the computer. Come up with 10 improvements for our app that you think would be great for our users. like maybe calories burnt connect to apple watch"
2. "create a PR"

## Steps taken
- Read the whole codebase (836 lines) to ground the roadmap in the real architecture: `EXERCISES` angle-triple registry, `RepCounter` hysteresis, SSE hook bus, two-button picker.
- Launched three parallel research subagents with web search: seated arm exercises, standing 1m×1m exercises, and AirPods head-motion feasibility. Each returned structured markdown with sources.
- Wrote `docs/exercises/seated-upper-body.md` and `docs/exercises/standing-1x1.md` (16 exercises each: how-to, muscles, rep targets, Compendium METs, noise/sweat ratings, detection specs, plans, cut lists) and `docs/research/airpods-head-tracking.md` (API, architecture, algorithm, device matrix, risks).
- Wrote `ROADMAP.md` tying it together into v0.2–v1.0 milestones plus the requested ten user improvements; pointed the README roadmap section at it.
- Pre-push gate, then this PR.

## Decisions
- "ipods tracking" interpreted as **AirPods** (iPods have no motion sensors); confirmed browsers cannot access headphone IMU data, so the roadmap plans a small native macOS 14+ Swift helper streaming into the existing localhost SSE bus rather than a web-only approach.
- Squat-by-head-movement ships in two stages: v0.3 counts the camera's nose landmark bobbing (works with legs cropped out of frame today), v0.4 adds AirPods as a second source feeding the same head-bob detector — one primitive, two signal sources.
- The v0.1 hip–knee–ankle squat detector is kept as an opt-in "high-fidelity mode" rather than deleted, since it's stricter about depth when the user can step back.
- Exercises the research rejected (jumping jacks, lunges, chair dips, wall sits, side bends) are recorded in per-catalog cut lists with reasons, so they don't get relitigated.
- MET values come from the 2024 Adult Compendium; where no code exists (marching in place) the estimate is explicitly marked as an interpolation.
