#!/usr/bin/env node
// PromptUps CLI.
//   promptups                 start the server and open the workout page
//   promptups init            install Claude Code hooks (asks first, backs up settings)
//   promptups uninstall       remove the hooks
//   promptups --help          usage; --version prints the version
// Flags: --port=7887  --yes  --ai-coach

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { startServer, TOKEN_FILE } from "../server.js";

const args = process.argv.slice(2);
// Anything not starting with "-" is the subcommand. Short flags like -h count
// as flags, not as a command name.
const cmd = args.find((a) => !a.startsWith("-")) || "start";
const flag = (name) => args.some((a) => a === `--${name}`);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};

const COMMANDS = ["start", "init", "uninstall"];

const USAGE = `PromptUps — reps while Claude thinks.

Usage: promptups [command] [flags]

Commands:
  start            Start the server and open the workout page. (default)
  init             Install the Claude Code hooks. Asks first, backs up settings.json.
  uninstall        Remove the hooks PromptUps installed. Leaves yours alone.

Flags:
  --port=N         Port to listen on. Default 7887, or $PROMPTUPS_PORT.
  --yes            Skip the confirmation prompt in \`init\`.
  --ai-coach       End-of-set lines come from \`claude -p\` instead of the line banks.
  -h, --help       Print this and exit.
  -v, --version    Print the version and exit.

Docs: https://github.com/Tatendaz/promptups`;

function version() {
  try {
    return JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  } catch {
    return "unknown";
  }
}

// --help and --version have to be handled before anything else. start() boots a
// server that never exits, so anything that falls through to it hangs forever —
// which is exactly what `promptups --help` used to do.
if (flag("help") || args.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}
if (flag("version") || args.includes("-v")) {
  console.log(version());
  process.exit(0);
}
if (!COMMANDS.includes(cmd)) {
  console.error(`promptups: unknown command '${cmd}'.\n`);
  console.error(USAGE);
  process.exit(1);
}

const PORT = Number(opt("port", process.env.PROMPTUPS_PORT || 7887));
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`Invalid port ${JSON.stringify(opt("port", process.env.PROMPTUPS_PORT))}: use --port=1-65535.`);
  process.exit(1);
}
const MARKER = "/promptups/"; // identifies our hook commands for idempotent install/uninstall
const SETTINGS = process.env.PROMPTUPS_SETTINGS || path.join(os.homedir(), ".claude", "settings.json");

// The server mints a token at startup and writes it 0600 to TOKEN_FILE; the
// hook reads it at call time rather than baking the value in, so a restart (new
// token) does not require rewriting settings.json. The token never appears in
// the command line of a long-lived process — `$(cat ...)` is expanded by the
// shell into curl's argv for the length of one 1-second request. Baking the
// literal token into settings.json would instead leave it on disk in a
// world-readable file.
const AUTH = `-H "Authorization: Bearer $(cat '${TOKEN_FILE}' 2>/dev/null)"`;
const hook = (pathAndQuery) =>
  `curl -s -m 1 -X POST ${AUTH} 'http://127.0.0.1:${PORT}${pathAndQuery}' >/dev/null 2>&1 || true`;

const HOOK_EVENTS = {
  UserPromptSubmit: hook("/promptups/start"),
  Stop: hook("/promptups/stop?reason=done"),
  Notification: hook("/promptups/stop?reason=attention"),
};

// A hook that matches MARKER is ours, but "ours" is not the same as "still
// works": it may predate the token, or point at a port we are no longer serving.
// Current means byte-identical to what we would write right now, which catches
// both without needing a rule per failure mode.
const DESIRED = new Set(Object.values(HOOK_EVENTS));
const isCurrent = (command) => DESIRED.has(String(command));

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
  const stale = [];
  for (const [event, command] of Object.entries(HOOK_EVENTS)) {
    const entries = (settings.hooks[event] = settings.hooks[event] || []);
    const ours = entries.flatMap((e) =>
      (e.hooks || []).filter((h) => String(h.command).includes(MARKER))
    );
    if (ours.length === 0) additions.push([event, command]);
    else if (ours.some((h) => !isCurrent(h.command))) stale.push([event, command, ours]);
  }

  if (additions.length === 0 && stale.length === 0) {
    console.log("PromptUps hooks already installed and up to date. Nothing to do.");
    return;
  }

  if (additions.length) {
    console.log(`This adds ${additions.length} hook(s) to ${SETTINGS}:\n`);
    for (const [event, command] of additions) console.log(`  ${event}\n    ${command}\n`);
  }
  if (stale.length) {
    console.log(`This updates ${stale.length} existing hook(s) in ${SETTINGS}.\n`);
    console.log("They don't match what PromptUps would write now — either they predate");
    console.log("the access token, or they point at a different port. Both fail the same");
    console.log("way: silently, because a failing hook is deliberately invisible to Claude");
    console.log("Code, so your sets just stop counting. The new commands:\n");
    for (const [event, command] of stale) console.log(`  ${event}\n    ${command}\n`);
  }
  console.log("Each pings the local PromptUps server and gives up after 1 second,");
  console.log("so Claude Code is never slowed down, even when PromptUps is not running.\n");

  if (!(await confirm(stale.length && !additions.length ? "Update?" : "Install?"))) {
    console.log("Skipped. Run `promptups init` any time.");
    return;
  }

  const backup = backupSettings();
  for (const [event, command] of additions) {
    settings.hooks[event].push({ hooks: [{ type: "command", command }] });
  }
  for (const [, command, ours] of stale) {
    for (const h of ours) h.command = command;
  }
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));

  if (backup) console.log(`Backed up previous settings to ${backup}`);
  const what = [additions.length && `installed ${additions.length}`, stale.length && `updated ${stale.length}`]
    .filter(Boolean)
    .join(", ");
  console.log(`Hooks ${what}. Restart open Claude Code sessions (or run /hooks) to pick them up.`);
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
  Hooks:         ${{
    current: "installed",
    stale: "OUT OF DATE or incomplete — sets will not count.\n                 Fix: node bin/promptups.js init",
    none: "not installed — run: node bin/promptups.js init",
  }[hookStatus()]}

  Prompt Claude in another terminal. Then move.
`);
  const openFailed = () => console.log(`  Could not open a browser. Visit ${url} yourself.`);
  if (process.platform === "win32") {
    // `start` is a cmd builtin, not an executable; the empty "" is its window title.
    spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).on("error", openFailed);
  } else {
    const opener = process.platform === "darwin" ? "open" : "xdg-open";
    spawn(opener, [url], { stdio: "ignore", detached: true }).on("error", openFailed);
  }
}

// "none" | "stale" | "current". `stale` is the case that used to be invisible:
// the hooks are present, so nothing looks wrong, but they predate the token and
// the server now rejects them.
function hookStatus() {
  const settings = readSettings();
  const ours = Object.entries(HOOK_EVENTS).map(([event]) =>
    (settings.hooks?.[event] || []).flatMap((e) =>
      (e.hooks || []).filter((h) => String(h.command).includes(MARKER))
    )
  );
  if (ours.every((hooks) => hooks.length === 0)) return "none";
  // Every one of the three events must be present *and* match. A partial
  // install is stale, not current: with only Stop wired up, sets would never
  // start, and reporting "installed" would send you looking anywhere but here.
  const complete = ours.every((hooks) => hooks.length > 0 && hooks.every((h) => isCurrent(h.command)));
  return complete ? "current" : "stale";
}

// cmd is already validated against COMMANDS above, so `else` can only be "start".
if (cmd === "init") await init();
else if (cmd === "uninstall") await uninstall();
else start();
