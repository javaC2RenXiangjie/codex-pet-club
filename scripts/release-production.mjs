#!/usr/bin/env node

import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const confirm = process.argv.includes("--confirm");
const ci = process.argv.includes("--ci");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

if (!confirm) {
  throw new Error("Production release requires --confirm");
}
if (!ci) {
  if (capture("git", ["branch", "--show-current"]) !== "main") {
    throw new Error("Production releases must run from main");
  }
  if (capture("git", ["status", "--porcelain"])) {
    throw new Error("Production releases require a clean worktree");
  }
  if (capture("git", ["rev-list", "--count", "HEAD...origin/main"]) !== "0") {
    throw new Error("Local main must match origin/main before release");
  }
}

run(npmCommand, ["run", "lint"]);
run(npmCommand, ["test"]);
mkdirSync("outputs", { recursive: true });
const timestamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
const backupPath = `outputs/codex-pet-club-db-before-release-${timestamp}.sql`;
run(npxCommand, [
  "wrangler", "d1", "export", "codex-pet-club-db", "--remote",
  "--skip-confirmation", "--output", backupPath, "--config", "dist/server/wrangler.json",
]);
run(npxCommand, [
  "wrangler", "d1", "migrations", "apply", "codex-pet-club-db", "--remote",
  "--config", "dist/server/wrangler.json",
]);
run(npxCommand, ["wrangler", "deploy", "--config", "dist/server/wrangler.json"]);
run(npmCommand, ["run", "smoke"]);
process.stdout.write(`Production release completed. Pre-release backup: ${backupPath}\n`);
