# AirPods head-motion tracking — feasibility

> Technical research for the v0.4 "AirPods mode" milestone (see [ROADMAP.md](../../ROADMAP.md)).
> TL;DR: feasible on macOS 14+ via a small native Swift helper; impossible from the browser alone.
> Rep detection should mirror the camera path's hysteresis philosophy, applied to vertical
> acceleration + head pitch instead of joint angles.

## API capabilities

[`CMHeadphoneMotionManager`](https://developer.apple.com/documentation/coremotion/cmheadphonemotionmanager) (CoreMotion) streams head motion from Apple/Beats headphones that support **spatial audio with dynamic head tracking** — that's the governing hardware rule per [WWDC23 "What's new in Core Motion"](https://wwdcnotes.com/documentation/wwdc23-10179-whats-new-in-core-motion/).

**Data per sample** — a full [`CMDeviceMotion`](https://developer.apple.com/documentation/coremotion/cmheadphonemotionmanager/devicemotion): `attitude` (quaternion), `rotationRate`, `userAcceleration`, `gravity`, plus a headphone-specific `sensorLocation` (left/right bud — data comes from **one bud at a time**, WWDC23). Gravity is confirmed populated in practice: [Headitude](https://github.com/DanielRudrich/Headitude) "uses the gravity data and some quaternion magic" for calibration on macOS. This matters: we can project `userAcceleration` onto the gravity vector without caring about yaw.

**Sample rate**: not documented by Apple; developer consensus is **~25 Hz, fixed, not configurable** (no `deviceMotionUpdateInterval` exists on this class). Source: [Anand Chowdhary's RidePods write-up](https://anandchowdhary.com/notes/2025/airpods-based-head-motion-racing) — "attitude quaternion and fused gyro and accel at around 25 Hz." Treat as developer-reported, not Apple-verified. 25 Hz is ample for 0.2–0.5 Hz squat reps.

**Permission model**: `NSMotionUsageDescription` in Info.plist is mandatory ([Apple](https://developer.apple.com/documentation/bundleresources/information-property-list/nsmotionusagedescription)); per-app authorization via `authorizationStatus()`. On iOS the Settings > Privacy & Security > Motion & Fitness toggle governs it; if toggled off, status reads `restricted` until app relaunch ([forum report](https://developer.apple.com/forums/thread/756452)). On macOS a comparable TCC motion consent prompt appears on first use — the helper should be a bundled `.app` (not a bare binary) so the prompt attributes correctly. *Flagged: exact macOS Settings-pane location not verified in docs.*

**Known quirks** (developer-reported):
- **In-ear detection gates delivery**: removing a bud fires disconnect events; reinsertion reconnects (WWDC23). Handle via `CMHeadphoneMotionManagerDelegate` / `startConnectionStatusUpdates()`.
- **Audio does not need to be playing** — posture apps ([Posture Pal](https://apps.apple.com/us/app/posture-pal-improve-alert/id1590316152), [workwell](https://github.com/wizenheimer/workwell)) monitor continuously without playback. But an audio session using the AirPods **microphone** (SCO/HFP) kills IMU updates ([forum thread 661325](https://developer.apple.com/forums/thread/661325)) — don't grab the AirPods mic from the helper.
- **Automatic device switching** (AirPods hopping to iPhone on a call/Siri) interrupts the stream mid-session; also "yaw drift… and odd behavior when the buds lose fit" ([RidePods](https://anandchowdhary.com/notes/2025/airpods-based-head-motion-racing)).
- iOS backgrounding stops updates without the Motion & Fitness background mode ([forum](https://developer.apple.com/forums/thread/126045)) — moot for a Mac helper.

**Coordinate frame**: attitude reference is **arbitrary** — set when tracking starts, unknown wear orientation, yaw drifts (no magnetometer reference). Apple doesn't document it. Headitude requires a user calibration gesture for absolute orientation. **For rep counting we don't need it**: `gravity` and `userAcceleration` share the same device frame, so vertical acceleration = `-dot(userAcceleration, normalize(gravity))` — self-calibrating, yaw-immune.

## Platform support

From Apple's own availability metadata ([docs JSON](https://developer.apple.com/tutorials/data/documentation/coremotion/cmheadphonemotionmanager.json)): **iOS 14.0+, iPadOS 14.0+, Mac Catalyst 14.0+, watchOS 7.0+, and native macOS 14.0+ (Sonoma)**. WWDC23 confirms: "coming to macOS 14… stream device motion from audio products that support spatial audio with dynamic head tracking." Before Sonoma the class was `API_UNAVAILABLE(macos)` — which is why [MacPaw's 2022 research](https://research.macpaw.com/publications/headphones-accessibility) had to proxy through an iPhone. [Headitude](https://github.com/DanielRudrich/Headitude) proves native macOS 14 access works today. *Flagged: one forum-derived claim says native macOS may require Apple silicon; I could not verify against Apple docs — test on Intel Sonoma if you care ([portal-labs/CMHeadphoneMotionManagerMac](https://github.com/portal-labs/CMHeadphoneMotionManagerMac) exists specifically to troubleshoot macOS quirks).* visionOS: not listed.

## Browser limitation

**There is no web API that exposes headphone IMU data. A native companion is mandatory.**
- [`DeviceMotionEvent`](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent) reads the **hosting device's** accelerometer/gyro only (the Mac — which has none that matter).
- Web Bluetooth speaks BLE GATT; AirPods carry motion over Apple's proprietary protocol on Classic Bluetooth/L2CAP and expose no GATT IMU service. Every known consumer of this data goes through CoreMotion — the entire bridge ecosystem below exists precisely because of this.

## Architecture options

**(a) Native macOS helper — recommended.** Tiny Swift menu-bar (or LSUIElement) app on macOS 14+: `CMHeadphoneMotionManager` → project accel onto gravity → stream samples to the Node server on localhost → page consumes via the SSE channel. **Inbound contract (new work — today's `/events` is outbound-only and nothing ingests motion):** a new `POST /api/motion` endpoint accepting batched samples `{"samples": [{"t": <ms>, "av": <vertical accel, g>, "pitch": <deg>, "loc": "left"|"right"|"default"}]}` — samples are the **sole** inbound payload.

Details:

- **Envelope.** Always the `samples` object — never a bare array or bare sample — so a batch of one and a batch of fifty parse identically. The server re-broadcasts **one SSE `motion` event per accepted sample**, so batching is purely a transport optimisation and the adapter never sees batch boundaries.
- **Validation, before anything is broadcast.** Strict JSON types; `t`, `av` and `pitch` must be finite numbers within documented ranges; a maximum body size and a maximum `samples` length, both enforced while reading rather than after. An empty `samples` array is a `400`. **A batch is atomic:** one invalid sample rejects the whole batch and nothing from it is broadcast, so a malformed tail cannot half-apply or poison the detector. Without the size and range caps this is a trivial local resource-exhaustion target.
- **Trust boundary.** The endpoint is state-changing, and localhost is *not* a boundary: a page in any browser can issue a simple cross-origin `POST` to `127.0.0.1` — not preflighted, so no CORS policy is consulted before the write lands — DNS rebinding can turn an attacker's hostname into a loopback origin, and every local process can post as well. So the server binds loopback only (as `server.js` already does) and, **before it reads a body**, requires `Authorization: Bearer <token>` and rejects any request whose `Origin` header is present and is not exactly the app's own (`http://127.0.0.1:<port>`, or the `localhost` spelling of it).
- **Token handoff.** Minted by the server at startup, never a fixed default. It must not travel in `argv` — process arguments are world-readable via `ps` on a shared machine. Pass it on an inherited file descriptor, or write it `0600` under `$PROMPTUPS_DATA_DIR` for the helper to read.
- **Session boundary.** The server mints a `session` identifier at startup alongside the token and carries it on the `POST` and on **every** rebroadcast `motion` event. `t` is the Core Motion sample timestamp ([monotonic seconds since boot](https://developer.apple.com/documentation/coremotion/cmlogitem/timestamp)), converted to ms **once in the helper** and preserved unchanged through rebroadcast — the server never substitutes receive time. Its origin resets on reboot or helper restart, so timestamps are comparable only within one `session`; the adapter watches that identifier and resets on a change, rather than inferring a restart from time appearing to run backwards.
- **`loc` enum and quarantine.** A wire enum over `CMDeviceMotion.SensorLocation`: `headphoneLeft`→`left`, `headphoneRight`→`right`, and `.default` — what Core Motion reports when samples come from the device's own sensors rather than a bud — as `"default"`. Delivery hops between buds on in-ear changes, so **the adapter** (not the server) resets its filter/baseline/hysteresis whenever `loc` changes, including to or from `"default"`, or a handoff discontinuity could fake or swallow a rep. `"default"` samples are still rebroadcast like any other, so the per-sample guarantee holds without exception, but the adapter does not count them.

A browser-side adapter feeds accepted samples into the shared head-bob rep counter (`reps.js`). Rep detection lives only in that adapter — the helper never sends pre-counted rep events, so there is exactly one counting path and no double-count risk. The SSE bus covers only the outbound half; endpoint, schema, and adapter are new integration surface, sized into the estimate. Effort: **small** — ~300 LOC Swift + ~50 LOC server/adapter; Headitude is a working reference for the CoreMotion + calibration half. Distribution: for the maintainer's own Mac, ad-hoc signing is fine; for public distribution outside the App Store, **Developer ID signing + notarization is required** by Gatekeeper ([Apple: Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)) — $99/yr Apple Developer account. Ship as a bundled `.app` so the motion permission prompt works cleanly.
- **Zero-Swift variant**: tell users to run Headitude (existing OSC sender) and add a ~20-line UDP/OSC listener (`osc` npm package) to the Node server. Good for a v0 spike; orientation-only output (Euler/quaternion, no raw acceleration), so you'd detect reps from pitch instead — weaker signal.

**(b) iOS companion app** streaming over local network (Bonjour discovery + WebSocket to the Node server). Exactly [MacPaw's architecture](https://research.macpaw.com/publications/headphones-accessibility) (iOS proxy → Bonjour → Mac client). Covers pre-Sonoma Macs and adds phone-accelerometer fallback, but: App Store review or TestFlight friction, `NSLocalNetworkUsageDescription` prompt, phone must stay unlocked-ish with app foregrounded (or use audio/motion background mode). Effort: medium. Keep as fallback, not the primary path.

**(c) Existing open-source bridges** (all CoreMotion wrappers; none browser-native):
- [DanielRudrich/Headitude](https://github.com/DanielRudrich/Headitude) — **macOS 14** menu app, AirPods attitude → OSC. Closest prior art to option (a).
- [tukuyo/AirPodsPro-Motion-Sampler](https://github.com/tukuyo/AirPodsPro-Motion-Sampler) — iOS sampler; README documents the classic device list.
- [emanuelgollob/AirPodsPro-Motion-OSC-Forwarder](https://github.com/emanuelgollob/AirPodsPro-Motion-OSC-Forwarder) — iOS → OSC.
- [Mach1Studios/M1-AirPodOSC](https://github.com/Mach1Studios/M1-AirPodOSC) — iOS OSC transmitter.
- [anastasiadevana/HeadphoneMotion](https://github.com/anastasiadevana/HeadphoneMotion) — Unity plugin.
- [XHMM/react-native-headphone-motion](https://github.com/XHMM/react-native-headphone-motion), [flutter_airpods](https://pub.dev/documentation/flutter_airpods/latest/) — RN/Flutter wrappers.
- [wizenheimer/workwell](https://github.com/wizenheimer/workwell) — iOS posture monitor using head pitch thresholds (~-22°).

**Recommendation for PromptUps**: ship (a). macOS 14+ with any head-tracking AirPods covers most of the target audience; the helper emits the same normalized sample-JSON shape the camera path could also emit, so the Node server treats both as interchangeable signal sources. Detect helper absence → fall back to camera.

## Detection algorithm

Double-integrating `userAcceleration` to displacement is a dead end: consumer-IMU bias + noise integrates to meters of drift within seconds (the reason all earable papers use band-limited/peak methods, e.g. [ExerSense](https://www.mdpi.com/1424-8220/21/1/91/htm), which counts reps via peak detection robust to sensor position). What works:

1. **Vertical channel**: `a_v = -dot(userAcceleration, ĝ)` where `ĝ = normalize(gravity)` — same frame, no calibration, yaw-drift-immune.
2. **Band-pass ~0.1–0.7 Hz** (2nd-order Butterworth or cascaded EMA). Justified: rep tempos run ~2–8 s with 2–6 s mainstream ([ACE tempo review](https://www.acefitness.org/continuing-education/certified/april-2025/8843/repetition-tempo-and-muscular-development-what-s-the-connection/)) → 0.125–0.5 Hz fundamental, and the 0.1 Hz low edge keeps the slowest accepted cycle (8 s = 0.125 Hz) inside the passband with only edge rolloff to budget for (a Butterworth cutoff is its −3 dB point; an EMA cascade's edge loss depends on its coefficients) — validate the cutoffs against detector recall on real slow reps, and keep them matched to the state machine's 1.5–8 s bounds. This kills walking (1.5–2.5 Hz), nods (~1–3 Hz, and mostly rotational anyway), and DC drift. **Jitter-safe by construction:** Bluetooth delivery never guarantees uniform spacing (risk 3), so either uniformly resample to a fixed grid (e.g. linear-interpolate to 25 Hz) before filtering or derive the filter coefficients from each sample's actual `dt`; and every duration in the detector (the 300 ms qualification window, the refractory period, the 1.5–8 s cycle bounds) is measured on sample timestamps, never sample counts.
3. **Hysteresis state machine** on the filtered signal — same philosophy as the existing camera counter: descend when `a_v < -T_down` sustained ≥300 ms, count on return through `+T_up`, refractory ≥1 s, reject cycles outside 1.5–8 s.

```text
# all filters on a resampled uniform grid (or dt-aware coefficients);
# all durations measured on sample timestamps, not sample counts
ĝ ← normalize(lowpass(gravity))           # slow EMA, τ≈2s
a_v ← -dot(userAccel, ĝ)                  # +up, in g (CMAcceleration units)
x ← bandpass(a_v, 0.1–0.7 Hz)
state machine:
  IDLE  → DOWN  when x < -T_down for ≥0.3s        # T≈0.06–0.12 g, calibrate
  DOWN  → UP    when x > +T_up                     # T_up < T_down (hysteresis)
  UP    → count rep if 1.5s ≤ cycle ≤ 8s; refractory 1s → IDLE
session gate: require 2 consecutive valid cycles before counting from rep 1
              (retro-credit rep 1), stop after 10s of quiet
```

**Complementary signals**: (i) filtered integration of `a_v` to vertical velocity with zero-velocity clamping between reps (ZUPT-style — reset integrator whenever `|x|` is small for >0.5 s) gives amplitude estimates to reject small motions; (ii) attitude **pitch delta** — people look down/lean forward in the descent; workwell shows pitch thresholds (~20°) are dependable. Require `pitch_delta > ~8°` OR strong `a_v` amplitude to score a rep.

**Confounders**: sit-down/stand-up and picking something up = 1–2 cycles → the ≥2-periodic-cycles session gate excludes them; nodding = high `rotationRate.pitch`, negligible sustained `a_v` (ear translation of cm, not tens of cm) → amplitude + rotation/translation ratio check; walking away = wrong frequency band + no in-band periodicity. Periodicity (autocorrelation of the last ~10 s, or simply the cycle-time consistency check above) is the single strongest discriminator.

## Prior art

- **Apple ships head-gesture detection**: iOS 18 nod-to-accept / shake-to-decline on H2 AirPods ([Apple Support](https://support.apple.com/guide/airpods/use-controls-and-gestures-with-your-airpods-devb2c431317/web)) — proof the sensor pipeline resolves deliberate head motion reliably.
- **Posture apps on this exact API**: [Posture Pal (Jordi Bruin)](https://apps.apple.com/us/app/posture-pal-improve-alert/id1590316152) ([9to5Mac](https://9to5mac.com/2022/03/17/posture-pal-iphone-app-airpods/)), [workwell](https://github.com/wizenheimer/workwell).
- **Academic earables**: [eSense open earable platform](https://www.semanticscholar.org/paper/11a74cc4107dfd42ca3e3c8bf6ac374dc8cd026d) (6-axis ear IMU; [kinetic sensing paper](https://akhilmathurs.github.io/papers/min_wearsys18.pdf)); [earbud-IMU head-angle validity study during squats/lunges](https://pmc.ncbi.nlm.nih.gov/articles/PMC8780408/) (ear IMU vs 3D mocap: strong sagittal-plane validity — directly supports squat detection from the ear); [ExerSense](https://www.mdpi.com/1424-8220/21/1/91/htm) (position-robust IMU rep counting, >90% accuracy incl. squats).
- **Head-tracking games/tools**: [RidePods](https://anandchowdhary.com/notes/2025/airpods-based-head-motion-racing), [KhaosT demo](https://github.com/KhaosT/CMHeadphoneMotionManagerDemo), Headitude (above).

## Device matrix

| Headphone | Motion API | Basis |
|---|---|---|
| AirPods Pro 1 / 2 | Yes | [tukuyo list](https://github.com/tukuyo/AirPodsPro-Motion-Sampler); Apple sample lists Pro 2 |
| AirPods Pro 3 (2025) | Yes (expected) | All AirPods Pro have dynamic head tracking ([Apple](https://support.apple.com/guide/airpods/control-spatial-audio-and-head-tracking-dev00eb7e0a3/web)); not yet seen named in API docs — verify on hardware |
| AirPods 3 | Yes | tukuyo; Posture Pal |
| AirPods 4 (ANC and non-ANC) | Yes | [Apple sample article](https://developer.apple.com/documentation/CoreMotion/getting-motion-activity-data-from-headphones) names AirPods 4 |
| AirPods Max (both revisions) | Yes | tukuyo; Apple spatial-audio list |
| AirPods 1 / 2 | **No** | No head tracking hardware |
| Beats Fit Pro | Yes | tukuyo list |
| Powerbeats Pro 2 | Yes (expected) | [Spatial audio w/ dynamic head tracking](https://www.beatsbydre.com/earbuds/powerbeats-pro-2) — API support inferred, unverified |
| Beats Studio Pro | Likely | Personalized spatial audio w/ head tracking; API support unverified |
| Beats Studio Buds / + | **No** | No head tracking |

Gate at runtime on `isDeviceMotionAvailable` rather than a model allowlist.

## Risks

1. **macOS < 14 users get nothing native** → detect at startup; fall back to camera or the iOS-companion path (option b). Keep camera as the default signal source.
2. **Auto-switching/multipoint steals the stream** (AirPods jump to iPhone on a call mid-set) → subscribe to connection status updates, pause the set with a visible "signal lost" state instead of silently missing reps; document disabling automatic switching.
3. **~25 Hz cap, BT jitter, one-bud delivery and in-ear-detection dropouts** → timestamp-based processing (never assume fixed dt), gap tolerance up to ~0.5 s inside a rep cycle, hysteresis thresholds sized for a noisy 25 Hz signal.
4. **Permission + Gatekeeper friction** (motion TCC prompt; unsigned helper won't launch on other people's Macs) → notarized Developer ID build for release, clear first-run prompt copy via `NSMotionUsageDescription`, README note on re-granting permission.
5. **False/missed reps** (sit-downs, bends, nods; heads-still squatters) → periodicity gate + amplitude/pitch dual criterion; when camera and AirPods are both live, cross-validate and prefer agreement; expose a sensitivity setting mirroring the existing hysteresis tuning.

Unverified items flagged above: exact 25 Hz figure (developer-reported only), Apple-silicon requirement for native macOS, AirPods Pro 3 / Powerbeats Pro 2 / Beats Studio Pro explicit API support, and macOS permission-pane specifics.
