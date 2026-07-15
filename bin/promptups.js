#!/usr/bin/env node
// PromptUps CLI.
//   promptups                 start the server and open the workout page
//   promptups init            install Claude Code hooks (asks first, backs up settings)
//   promptups uninstall       remove the hooks
// Flags: --port=7887  --yes  --ai-coach

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { startServer } from "../server.js";

const args = process.argv.slice(2);
const cmd = args.find((a) => !a.startsWith("--")) || "start";
const flag = (name) => args.some((a) => a === `--${name}`);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};

const PORT = Number(opt("port", process.env.PROMPTUPS_PORT || 7887));
const MARKER = "/promptups/"; // identifies our hook commands for idempotent install/uninstall
const SETTINGS = process.env.PROMPTUPS_SETTINGS || path.join(os.homedir(), ".claude", "settings.json");

const HOOK_EVENTS = {
  UserPromptSubmit: `curl -s -m 1 -X POST 'http://127.0.0.1:${PORT}/promptups/start' >/dev/null 2>&1 || true`,
  Stop: `curl -s -m 1 -X POST 'http://127.0.0.1:${PORT}/promptups/stop?reason=done' >/dev/null 2>&1 || true`,
  Notification: `curl -s -m 1 -X POST 'http://127.0.0.1:${PORT}/promptups/stop?reason=attention' >/dev/null 2>&1 || true`,
};

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
  } catch {
    return {};
  }
}

function confirm(question) {
  if (flag("yes")) return Promise.resolve(true);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    })
  );
}

function backupSettings() {
  if (!fs.existsSync(SETTINGS)) return null;
  const backup = `${SETTINGS}.bak-promptups-${Date.now()}`;
  fs.copyFileSync(SETTINGS, backup);
  return backup;
}

async function init() {
  const settings = readSettings();
  settings.hooks = settings.hooks || {};

  const additions = [];
  for (const [event, command] of Object.entries(HOOK_EVENTS)) {
    const entries = (settings.hooks[event] = settings.hooks[event] || []);
    const installed = entries.some((e) => (e.hooks || []).some((h) => String(h.command).includes(MARKER)));
    if (!installed) additions.push([event, command]);
  }

  if (additions.length === 0) {
    console.log("PromptUps hooks already installed. Nothing to do.");
    return;
  }

  console.log(`This adds ${additions.length} hook(s) to ${SETTINGS}:\n`);
  for (const [event, command] of additions) console.log(`  ${event}\n    ${command}\n`);
  console.log("Each pings the local PromptUps server and gives up after 1 second,");
  console.log("so Claude Code is never slowed down, even when PromptUps is not running.\n");

  if (!(await confirm("Install?"))) {
    console.log("Skipped. Run `promptups init` any time.");
    return;
  }

  const backup = backupSettings();
  for (const [event, command] of additions) {
    settings.hooks[event].push({ hooks: [{ type: "command", command }] });
  }
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));

  if (backup) console.log(`Backed up previous settings to ${backup}`);
  console.log("Hooks installed. Restart open Claude Code sessions (or run /hooks) to pick them up.");
}

async function uninstall() {
  const settings = readSettings();
  if (!settings.hooks) return console.log("No hooks found. Nothing to do.");

  let removed = 0;
  for (const event of Object.keys(settings.hooks)) {
    const before = settings.hooks[event].length;
    settings.hooks[event] = settings.hooks[event].filter(
      (e) => !(e.hooks || []).some((h) => String(h.command).includes(MARKER))
    );
    removed += before - settings.hooks[event].length;
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }

  if (removed === 0) return console.log("No PromptUps hooks found. Nothing to do.");
  const backup = backupSettings();
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));
  if (backup) console.log(`Backed up previous settings to ${backup}`);
  console.log(`Removed ${removed} PromptUps hook(s).`);
}

function start() {
  if (flag("ai-coach")) process.env.PROMPTUPS_AI_COACH = "1";
  startServer(PORT);
  const url = `http://localhost:${PORT}`;
  console.log(`
  ██ PROMPTUPS ██  reps while Claude thinks

  Workout page:  ${url}
  AI coach:      ${process.env.PROMPTUPS_AI_COACH === "1" ? "on (claude -p, haiku)" : "off (pass --ai-coach)"}
  Hooks:         ${hooksInstalled() ? "installed" : "not installed — run: node bin/promptups.js init"}

  Prompt Claude in another terminal. Then move.
`);
  const opener = { darwin: "open", win32: "start", linux: "xdg-open" }[process.platform];
  if (opener) spawn(opener, [url], { stdio: "ignore", detached: true }).on("error", () => {});
}

function hooksInstalled() {
  const settings = readSettings();
  return Object.values(settings.hooks || {}).some((entries) =>
    entries.some((e) => (e.hooks || []).some((h) => String(h.command).includes(MARKER)))
  );
}

if (cmd === "init") await init();
else if (cmd === "uninstall") await uninstall();
else start();
