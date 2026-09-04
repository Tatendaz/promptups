# Session: implement the auth gap from issue #7

**Branch:** fix/server-auth-token
**Date:** 2026-07-27

## Prompts

Quoted verbatim.

1. "The server.js auth gap  create an issue"
2. "Can you go through https://github.com/Tatendaz/promptups/pull/6 and also work
   on https://github.com/Tatendaz/promptups/issues/7 I could not understand what
   my agent was rambling on about"

Prompt 2 carried a second instruction worth recording: the previous explanations
were too long and too dense to follow. Shorter answers, plainer language.

## Steps taken
- Read `server.js` end to end before designing anything, rather than working from
  the issue text. That turned up a fourth affected endpoint the issue had listed
  (`/api/quip`) and confirmed the two properties that make the others reachable:
  `start`/`stop` accept GET, and `readBody` accepts any JSON.
- Checked `tests/coach.test.js` **before** writing `public/auth.js`. It imports
  `coach.js` under `node:test`, so a module that read `document` at import time
  would have broken the suite. That is why the token accessor is a lazy function.
- Implemented, then ran the suite: 2 pre-existing tests failed because they called
  the endpoints without a token. Updated those rather than weakening the check.
- Wrote 11 new tests and found **three real bugs in my own implementation**:
  - `startServer(0)` binds an ephemeral port, but `authorize()` was comparing
    `Origin` against the *requested* port `0`, so every browser request looked
    foreign. Fixed by reading `server.address().port`.
  - Calling `req.destroy()` on an oversized body reset the connection before the
    `413` could be written; the caller saw a network error instead of a reason.
    Now it stops accumulating and drains.
  - `JSON.stringify("not json")` is valid JSON, so a string body sailed through
    and became a session with 0 reps. Non-object bodies are now rejected.
- Ran the real hook command against a live server to confirm the whole path, not
  just the unit tests: valid token 200, missing token 401 plus the warning, right
  token with a foreign `Origin` 403, GET 405, and the token file at `0600`.
- Broke a `perl -pi` substitution over `server.js` — it rewrote the function
  *definition* as well as the call sites, producing invalid syntax and 9 failures.
  Fixed by hand. A regex across a whole file was the wrong tool.

## Decisions
- **Inject the token into `index.html` rather than serve it from an endpoint.**
  Any endpoint that hands out the token has to be unauthenticated to be useful,
  which hands it to the attacker too. A cross-origin page cannot read our HTML,
  so being served the page is itself the proof of local access.
- **Read the token from a file in the hook instead of baking it in.** Baking it
  into `settings.json` puts a live secret in a world-readable file and breaks on
  every restart, since the token is per-run.
- **Truncate an over-long exercise name; reject out-of-range reps.** The name is
  cosmetic, so dropping a real set over it would lose the reps. A nonsense rep
  count is the thing that actually corrupts the stats.
- **Left `/events` open.** Read-only, and `EventSource` cannot send headers, so it
  needs a different mechanism (query token or cookie) than everything else. Out
  of scope for #7, noted in the feature entry.
- **Made "current" mean byte-identical to what `init` would write today**, rather
  than "contains an Authorization header". One rule catches both a missing token
  and a stale port, and it fixed the documented `--port` trap for free.
