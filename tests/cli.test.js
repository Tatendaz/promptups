import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const bin = fileURLToPath(new URL("../bin/promptups.js", import.meta.url));

// Each test drives the real CLI against a throwaway settings.json,
// so the user's actual ~/.claude/settings.json is never touched.
function tempSettings(initial) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "promptups-cli-"));
  const file = path.join(dir, "settings.json");
  if (initial !== undefined) fs.writeFileSync(file, JSON.stringify(initial, null, 2));
  return { dir, file, env: { ...process.env, PROMPTUPS_SETTINGS: file } };
}

const countOurHooks = (settings) =>
  Object.values(settings.hooks || {})
    .flat()
    .filter((e) => (e.hooks || []).some((h) => h.command.includes("/promptups/"))).length;

test("init --yes installs the three hooks", async () => {
  const { dir, file, env } = tempSettings();
  await run("node", [bin, "init", "--yes"], { env });
  const settings = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(countOurHooks(settings), 3);
  assert.ok(settings.hooks.UserPromptSubmit, "UserPromptSubmit hook missing");
  assert.ok(settings.hooks.Stop, "Stop hook missing");
  assert.ok(settings.hooks.Notification, "Notification hook missing");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("init is idempotent and preserves existing settings", async () => {
  const existing = {
    model: "opus",
    hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] },
  };
  const { dir, file, env } = tempSettings(existing);
  await run("node", [bin, "init", "--yes"], { env });
  const { stdout } = await run("node", [bin, "init", "--yes"], { env });
  assert.match(stdout, /already installed/i);

  const settings = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(countOurHooks(settings), 3);
  assert.equal(settings.model, "opus", "unrelated settings must survive");
  assert.ok(
    settings.hooks.Stop.some((e) => e.hooks.some((h) => h.command === "echo mine")),
    "pre-existing hooks must survive"
  );
  const backups = fs.readdirSync(dir).filter((f) => f.includes("bak-promptups"));
  assert.ok(backups.length >= 1, "expected a backup of the existing settings file");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("rejects a non-numeric --port before writing any hooks", async () => {
  const { dir, file, env } = tempSettings();
  await assert.rejects(run("node", [bin, "init", "--yes", "--port=banana"], { env }));
  assert.equal(fs.existsSync(file), false, "no settings should be written on invalid port");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("uninstall removes only our hooks", async () => {
  const existing = {
    hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] },
  };
  const { dir, file, env } = tempSettings(existing);
  await run("node", [bin, "init", "--yes"], { env });
  await run("node", [bin, "uninstall"], { env });

  const settings = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(countOurHooks(settings), 0);
  assert.ok(
    settings.hooks.Stop.some((e) => e.hooks.some((h) => h.command === "echo mine")),
    "user's own hooks must survive uninstall"
  );
  assert.equal(settings.hooks.UserPromptSubmit, undefined, "emptied events are cleaned up");
  fs.rmSync(dir, { recursive: true, force: true });
});
