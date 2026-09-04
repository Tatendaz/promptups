// PromptUps local server: static files + SSE event bus + session stats.
// Zero dependencies. Hooks POST to /promptups/start and /promptups/stop;
// the browser listens on /events and does all pose detection itself.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.PROMPTUPS_DATA_DIR || path.join(os.homedir(), ".promptups");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
// Exported so the CLI can bake the resolved path into the hook commands, and so
// the tests can read what the server actually minted.
export const TOKEN_FILE = path.join(DATA_DIR, "token");

// Reject a body before it can be buffered. A session record is a handful of
// fields; anything approaching this is either a bug or someone filling the disk.
const MAX_BODY_BYTES = 64 * 1024;
// Sanity bounds for a single session record. Not security-critical on their own —
// the token is the boundary — but they keep one bad request from poisoning the
// all-time stats, which are just a sum over this file.
const MAX_EXERCISE_LEN = 64;
const MAX_REPS = 10_000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const clients = new Set();
let state = { thinking: false, startedAt: null, reason: null };

function broadcast(event) {
  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) {
    try {
      res.write(line);
    } catch {
      clients.delete(res); // a stale client must not break the others
    }
  }
}

function readSessions() {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeSessions(sessions) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function aggregateStats() {
  const sessions = readSessions();
  const today = new Date().toDateString();
  let totalReps = 0;
  let todayReps = 0;
  let bestSet = 0;
  for (const s of sessions) {
    const reps = Number(s.reps) || 0;
    totalReps += reps;
    bestSet = Math.max(bestSet, reps);
    if (new Date(s.endedAt).toDateString() === today) todayReps += reps;
  }
  return { totalReps, todayReps, bestSet, sessions: sessions.length };
}

function sendJson(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

function serveStatic(req, res, urlPath) {
  const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: "forbidden" });
  fs.readFile(filePath, (err, buf) => {
    if (err) return sendJson(res, 404, { error: "not found" });
    const type = MIME[path.extname(filePath)] || "application/octet-stream";
    // The page needs the token to call its own API. It is injected here rather
    // than served from an endpoint, because any endpoint that hands out the
    // token would have to be unauthenticated to be useful — which would hand it
    // to the attacker too. A cross-origin page cannot read this HTML, so being
    // served it is itself the proof of local access.
    if (filePath === path.join(PUBLIC_DIR, "index.html") && TOKEN) {
      const html = buf
        .toString("utf8")
        .replace("</head>", `  <meta name="promptups-token" content="${TOKEN}" />\n</head>`);
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      return res.end(html);
    }
    res.writeHead(200, { "content-type": type });
    res.end(buf);
  });
}

// Resolves { ok: true, body } or { ok: false, reason }. The cap is enforced
// while reading: past the limit nothing further is kept, so memory stays bounded
// no matter how much the caller sends.
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    let bytes = 0;
    let done = false;
    let tooLarge = false;
    req.on("data", (c) => {
      if (done) return;
      bytes += c.length;
      if (bytes > MAX_BODY_BYTES) {
        // Stop accumulating, but keep draining. Destroying the socket here
        // would reset the connection before the 413 could be written, and the
        // caller would see a network error instead of the reason it was
        // refused. Memory stays bounded either way: nothing more is kept.
        tooLarge = true;
        data = "";
        return;
      }
      data += c;
    });
    req.on("end", () => {
      if (done) return;
      done = true;
      if (tooLarge) return resolve({ ok: false, reason: "too_large" });
      try {
        const body = JSON.parse(data || "{}");
        // A JSON body can be a string, number or array and still parse. Only an
        // object can carry the fields this endpoint reads.
        if (body === null || typeof body !== "object" || Array.isArray(body)) {
          return resolve({ ok: false, reason: "bad_json" });
        }
        resolve({ ok: true, body });
      } catch {
        resolve({ ok: false, reason: "bad_json" });
      }
    });
    req.on("error", () => {
      if (done) return;
      done = true;
      resolve({ ok: false, reason: "bad_json" });
    });
  });
}

// ---------------------------------------------------------------------------
// Capability token.
//
// Every state-changing endpoint below is reachable by any page the user visits:
// the port is fixed, and a cross-origin POST with a CORS-safelisted content type
// is not preflighted, so the browser sends it before any policy is consulted.
// The token is what makes "can reach it" different from "may use it".
// ---------------------------------------------------------------------------

let TOKEN = null;

function mintToken() {
  const token = crypto.randomBytes(32).toString("hex"); // 256 bits
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
  // `mode` above only applies when the file is created. An existing file keeps
  // its old permissions, so narrow them explicitly every time.
  fs.chmodSync(TOKEN_FILE, 0o600);
  return token;
}

function tokenMatches(supplied) {
  if (typeof supplied !== "string" || !TOKEN) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(TOKEN);
  // timingSafeEqual throws on a length mismatch, so the lengths are compared
  // first. Length is not a secret; the value is.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function bearer(req) {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : null;
}

// A browser attaches Origin to cross-origin requests; curl attaches none. So an
// absent Origin is the hook, and a present one has to be ours.
function originAllowed(req, port) {
  const origin = req.headers.origin;
  if (!origin) return true;
  return origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
}

// Hooks written by an older `init` carry no token. They also end in `|| true`
// and time out after a second, so they fail silently — sets would just stop
// counting with nothing to see. Say it once, in the terminal running the server.
let warnedStaleHook = false;
function warnStaleHook(pathname) {
  if (warnedStaleHook) return;
  warnedStaleHook = true;
  console.error(
    `\npromptups: a request to ${pathname} arrived with no token.\n` +
      "  If your sets stopped counting, your Claude Code hooks predate authentication.\n" +
      "  Fix: run `promptups init` again to rewrite them.\n"
  );
}

// Returns true when the request may proceed; otherwise it has already answered.
function authorize(req, res, port, pathname) {
  if (!originAllowed(req, port)) {
    sendJson(res, 403, { error: "forbidden origin" });
    return false;
  }
  const supplied = bearer(req);
  if (supplied === null) warnStaleHook(pathname);
  if (!tokenMatches(supplied)) {
    sendJson(res, 401, { error: "unauthorized" });
    return false;
  }
  return true;
}

export function startServer(port) {
  TOKEN = mintToken();

  const server = http.createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      console.error("promptups: request failed:", err);
      if (!res.headersSent) return sendJson(res, 500, { error: "internal error" });
      res.end();
    }
  });

  // The port actually bound, which is not `port` when the caller passed 0 to
  // get an ephemeral one. The Origin allowlist is built from this, so asking
  // for port 0 must not silently make every browser request look foreign.
  const boundPort = () => server.address()?.port ?? port;

  async function handle(req, res) {
    const url = new URL(req.url, `http://127.0.0.1:${boundPort()}`);

    // Event bus: the hooks hit these. POST only — when GET was allowed, a bare
    // <img src> on any page fired them, and an image load is not something CORS
    // ever prevented.
    if (url.pathname === "/promptups/start" || url.pathname === "/promptups/stop") {
      if (req.method !== "POST") return sendJson(res, 405, { error: "method not allowed" });
      if (!authorize(req, res, boundPort(), url.pathname)) return;

      if (url.pathname === "/promptups/start") {
        state = { thinking: true, startedAt: Date.now(), reason: null };
        broadcast({ type: "start", at: state.startedAt });
      } else {
        const reason = url.searchParams.get("reason") || "done";
        state = { thinking: false, startedAt: null, reason };
        broadcast({ type: "stop", reason, at: Date.now() });
      }
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname === "/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.write(`data: ${JSON.stringify({ type: "hello", ...state })}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      res.on("error", () => clients.delete(res));
      return;
    }

    if (url.pathname === "/api/state") return sendJson(res, 200, state);
    if (url.pathname === "/api/stats") return sendJson(res, 200, aggregateStats());

    // Optional AI coach: one Haiku one-liner per set, via the local `claude` CLI.
    // Off by default; enable with `promptups start --ai-coach`. The browser
    // falls back to canned coach lines when this returns { quip: null }.
    if (url.pathname === "/api/quip") {
      if (process.env.PROMPTUPS_AI_COACH !== "1") return sendJson(res, 200, { quip: null });
      // Authorized even though it changes no local state: it spends the user's
      // Claude quota and puts caller-supplied text into a prompt sent upstream.
      if (!authorize(req, res, boundPort(), url.pathname)) return;
      const reps = url.searchParams.get("reps") || "0";
      const exercise = url.searchParams.get("exercise") || "squats";
      const moment = url.searchParams.get("moment") || "done";
      const prompt =
        `You are a gym coach for a programmer who exercises while their AI finishes coding. ` +
        `Moment: ${moment}. They just did ${reps} ${exercise}. ` +
        `Reply with ONE spoken line under 15 words. Funny, specific, no emoji, no quotes.`;
      execFile(
        "claude",
        ["-p", prompt, "--model", "haiku"],
        { timeout: 6000 },
        (err, stdout) => {
          if (err || !stdout.trim()) return sendJson(res, 200, { quip: null });
          sendJson(res, 200, { quip: stdout.trim().split("\n")[0].slice(0, 140) });
        }
      );
      return;
    }

    if (url.pathname === "/api/session" && req.method === "POST") {
      if (!authorize(req, res, boundPort(), url.pathname)) return;

      const result = await readBody(req);
      if (!result.ok) {
        return result.reason === "too_large"
          ? sendJson(res, 413, { error: "payload too large" })
          : sendJson(res, 400, { error: "invalid json" });
      }
      const body = result.body;

      const reps = Number(body.reps) || 0;
      if (!Number.isFinite(reps) || reps < 0 || reps > MAX_REPS) {
        return sendJson(res, 400, { error: "invalid reps" });
      }
      const session = {
        exercise: String(body.exercise || "unknown").slice(0, MAX_EXERCISE_LEN),
        reps: Math.floor(reps),
        startedAt: body.startedAt || null,
        endedAt: body.endedAt || new Date().toISOString(),
        reason: body.reason || "done",
      };
      const sessions = readSessions();
      sessions.push(session);
      writeSessions(sessions);
      return sendJson(res, 200, aggregateStats());
    }

    return serveStatic(req, res, url.pathname);
  }

  // Keep idle SSE connections alive through proxies and sleep/wake.
  setInterval(() => {
    for (const res of clients) {
      try {
        res.write(":hb\n\n");
      } catch {
        clients.delete(res);
      }
    }
  }, 25_000).unref();

  server.listen(port, "127.0.0.1");
  return server;
}
