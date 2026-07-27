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

// Every command below is run with a timeout. `start()` boots a server that
// never exits, so a regression that lets one of these fall through to it would
// otherwise hang the whole suite instead of failing.
const RUN_TIMEOUT = 10_000;

// --- hook freshness (issue #7) -------------------------------------------
// A hook that predates the token, points at another port, or is only partly
// installed all fail the same way: silently, because the commands end in
// `|| true`. `init` has to be able to repair them, or the only fix is to know
// to run `uninstall` first.

test("init rewrites hooks that predate the access token", async () => {
  const stale = {
    hooks: {
      UserPromptSubmit: [
        { hooks: [{ type: "command", command: "curl -s -m 1 -X POST 'http://127.0.0.1:7887/promptups/start' || true" }] },
      ],
    },
  };
  const { dir, file, env } = tempSettings(stale);
  const { stdout } = await run("node", [bin, "init", "--yes"], { env, timeout: RUN_TIMEOUT });
  assert.match(stdout, /updates 1 existing hook/i, "should offer to update, not skip");

  const after = JSON.parse(fs.readFileSync(file, "utf8"));
  const rewritten = after.hooks.UserPromptSubmit[0].hooks[0].command;
  assert.match(rewritten, /Authorization: Bearer/, "the rewritten hook must carry the token");
  assert.equal(countOurHooks(after), 3, "the two missing hooks should be added too");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("init repairs hooks left pointing at a port nobody serves", async () => {
  // Install on the default port, then re-init on another one.
  const { dir, file, env } = tempSettings({});
  await run("node", [bin, "init", "--yes"], { env, timeout: RUN_TIMEOUT });
  const before = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.match(JSON.stringify(before), /7887/);

  const { stdout } = await run("node", [bin, "init", "--yes", "--port=8000"], { env, timeout: RUN_TIMEOUT });
  assert.match(stdout, /updates 3 existing hook/i);
  const after = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.doesNotMatch(JSON.stringify(after), /7887/, "no hook should still point at the old port");
  assert.equal(countOurHooks(after), 3, "repair must not duplicate hooks");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("init leaves a complete, current install alone", async () => {
  const { dir, file, env } = tempSettings({});
  await run("node", [bin, "init", "--yes"], { env, timeout: RUN_TIMEOUT });
  const first = fs.readFileSync(file, "utf8");

  const { stdout } = await run("node", [bin, "init", "--yes"], { env, timeout: RUN_TIMEOUT });
  assert.match(stdout, /already installed and up to date/i);
  assert.equal(fs.readFileSync(file, "utf8"), first, "a no-op init must not rewrite the file");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--help prints usage and exits 0 instead of starting the server", async () => {
  const { dir, file, env } = tempSettings();
  const { stdout } = await run("node", [bin, "--help"], { env, timeout: RUN_TIMEOUT });
  assert.match(stdout, /Usage: promptups/);
  for (const command of ["start", "init", "uninstall"]) {
    assert.match(stdout, new RegExp(`\\b${command}\\b`), `usage should list '${command}'`);
  }
  assert.doesNotMatch(stdout, /PROMPTUPS ██/, "help must not boot the server banner");
  assert.equal(fs.existsSync(file), false, "help must not touch settings.json");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("-h is the same as --help", async () => {
  const { dir, env } = tempSettings();
  const { stdout } = await run("node", [bin, "-h"], { env, timeout: RUN_TIMEOUT });
  assert.match(stdout, /Usage: promptups/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--version prints the package version", async () => {
  const { dir, env } = tempSettings();
  const pkg = JSON.parse(fs.readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"));
  for (const arg of ["--version", "-v"]) {
    const { stdout } = await run("node", [bin, arg], { env, timeout: RUN_TIMEOUT });
    assert.equal(stdout.trim(), pkg.version, `\`promptups ${arg}\` should print ${pkg.version}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test("an unknown command exits non-zero with usage instead of hanging", async () => {
  const { dir, file, env } = tempSettings();
  await assert.rejects(
    run("node", [bin, "bogus"], { env, timeout: RUN_TIMEOUT }),
    (err) => {
      assert.equal(err.code, 1, `expected exit 1, got ${err.code} (signal ${err.signal})`);
      assert.match(err.stderr, /unknown command 'bogus'/);
      assert.match(err.stderr, /Usage: promptups/);
      return true;
    }
  );
  assert.equal(fs.existsSync(file), false, "a bad command must not touch settings.json");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--help wins over an invalid --port", async () => {
  const { dir, env } = tempSettings();
  const { stdout } = await run("node", [bin, "--help", "--port=banana"], { env, timeout: RUN_TIMEOUT });
  assert.match(stdout, /Usage: promptups/);
  fs.rmSync(dir, { recursive: true, force: true });
});

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
