// PromptUps local server: static files + SSE event bus + session stats.
// Zero dependencies. Hooks POST to /promptups/start and /promptups/stop;
// the browser listens on /events and does all pose detection itself.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.PROMPTUPS_DATA_DIR || path.join(os.homedir(), ".promptups");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

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
    res.writeHead(200, { "content-type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(buf);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

export function startServer(port) {
  const server = http.createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      console.error("promptups: request failed:", err);
      if (!res.headersSent) return sendJson(res, 500, { error: "internal error" });
      res.end();
    }
  });

  async function handle(req, res) {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    // Event bus: hooks hit these. GET allowed too so `curl` testing is easy.
    if (url.pathname === "/promptups/start") {
      state = { thinking: true, startedAt: Date.now(), reason: null };
      broadcast({ type: "start", at: state.startedAt });
      return sendJson(res, 200, { ok: true });
    }
    if (url.pathname === "/promptups/stop") {
      const reason = url.searchParams.get("reason") || "done";
      state = { thinking: false, startedAt: null, reason };
      broadcast({ type: "stop", reason, at: Date.now() });
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
      const body = await readBody(req);
      const session = {
        exercise: String(body.exercise || "unknown"),
        reps: Number(body.reps) || 0,
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
