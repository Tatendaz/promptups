# Feature: pin down the AirPods motion-ingest contract

**Branch:** docs/motion-ingest-trust-boundary
**Date:** 2026-07-27

## Summary
Three gaps closed in the `POST /api/motion` contract proposed by
`docs/research/airpods-head-tracking.md` §"Architecture options" (a): the
endpoint now has a stated trust boundary and authentication scheme, a stable
request envelope, and a complete `loc` enum. Research-doc only — no code exists
for this endpoint yet, which is exactly why the spec is the right place to fix
it.

## Motivation
CodeRabbit flagged the contract as a Major security finding on PR #1:
*"Line 38 introduces a state-changing POST endpoint without defining
authentication or its trust boundary."* That was correct, and PR #1 merged
without the fix, so the unqualified version is on `main` today.

The failure mode is not abstract. "It only listens on localhost" is a common and
wrong reason to skip auth on an ingest endpoint:

- Any page in any browser can issue a **simple cross-origin `POST`** to
  `127.0.0.1`. It is not preflighted, so no CORS policy is consulted before the
  request is delivered — the opaque response only stops the attacker *reading*
  the reply, not the write landing.
- **DNS rebinding** turns an attacker-controlled hostname into a loopback
  origin, defeating host-header and same-origin reasoning alike.
- Every local process on the machine can post too.

Left as written, whoever implements this builds an unauthenticated writable
endpoint that any visited web page can push forged rep data into.

Two smaller defects sat in the same paragraph. The envelope was a bare sample
object, so a batch of one and a batch of fifty would not parse identically
despite the prose calling the payload "batched samples". And `loc` was typed
`"left"|"right"`, but `CMDeviceMotion.sensorLocation` also reports `.default`
when samples come from the device's own sensors rather than a bud — an
unenumerated third case that would fall through whatever the adapter does with
an unknown location.

## What changed
- `docs/research/airpods-head-tracking.md` — the option (a) inbound-contract
  paragraph only. Adds:
  - **Trust boundary.** States that localhost is not a boundary and why: a
    simple cross-origin `POST` is not preflighted, so no CORS policy is
    consulted before the write lands; DNS rebinding turns an attacker hostname
    into a loopback origin; and every local process can post too. The server
    binds loopback only — which `server.js` already does — and **before it
    reads a body** requires `Authorization: Bearer <token>` and rejects any
    request whose `Origin` is present and is not exactly the app's own
    (`http://127.0.0.1:<port>`, or the `localhost` spelling — `server.js:111`
    and `:195` are where that origin comes from).
  - **Token handoff.** Minted at startup, never a fixed default, and explicitly
    **not** passed in `argv` — process arguments are world-readable via `ps`.
    An inherited file descriptor, or a `0600` file under `$PROMPTUPS_DATA_DIR`.
  - **Envelope.** Always `{"samples": [...]}`, never a bare array or bare
    sample, so batch-of-one and batch-of-fifty parse identically. The server
    re-broadcasts one SSE `motion` event per **accepted** sample, so batching
    stays a pure transport optimisation and the adapter never sees batch
    boundaries.
  - **Validation and batch atomicity.** Strict JSON types; `t`, `av` and
    `pitch` finite and in range; a maximum body size and `samples` length,
    enforced while reading; empty `samples` is a `400`. One invalid sample
    rejects the whole batch and nothing from it is broadcast, so a malformed
    tail cannot half-apply or poison the detector.
  - **Session boundary.** A `session` identifier minted at startup, carried on
    the `POST` and on every rebroadcast event. This is what makes "timestamps
    compare only within a session" actionable: `t` is monotonic-since-boot and
    its origin resets on helper restart, so the adapter resets state when the
    identifier changes rather than trying to infer a restart from time running
    backwards.
  - **`loc` enum and quarantine.** A wire enum over `CMDeviceMotion.SensorLocation`:
    `headphoneLeft`→`left`, `headphoneRight`→`right`, `.default`→`"default"`.
    Quarantine is assigned explicitly to **the adapter**, not the server:
    `"default"` samples are still rebroadcast like any other, so the per-sample
    guarantee holds without exception, but the adapter does not count them and
    resets its filter/baseline/hysteresis on any `loc` change, including to or
    from `"default"`.

## Notes
Docs-only; no source file changes, so the `New code has new tests` gate has
nothing to require and `npm test` is unaffected (57 tests, unchanged).

The capability token is specified as *minted at startup and passed out-of-band*
rather than a config value on purpose. A token with a documented default is not
a token — it ships as a shared secret that every install and every attacker
knows.

This lands the fix that PR #1 merged without. Nothing else from that PR's review
is carried here; the remaining findings on the roadmap and exercise-catalog docs
are untouched and still open.
