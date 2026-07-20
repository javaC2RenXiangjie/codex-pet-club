import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const python = process.platform === "win32" ? "python" : "python3";

test("runs backup verification before removing expired operational records", async () => {
  const [maintenance, worker, health, migration] = await Promise.all([
    readFile(new URL("../lib/maintenance.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/registry-health.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0004_maintenance_runs.sql", import.meta.url), "utf8"),
  ]);
  assert.ok(maintenance.indexOf("createRegistryBackup(at)") < maintenance.indexOf("cleanupExpiredOperationalData(at)"));
  assert.ok(maintenance.indexOf("verifyRegistryBackup(backup.key)") < maintenance.indexOf("cleanupExpiredOperationalData(at)"));
  assert.match(maintenance, /DELETE FROM email_login_codes WHERE expires_at < \?/);
  assert.match(maintenance, /DELETE FROM user_sessions WHERE expires_at < \?/);
  assert.match(maintenance, /DELETE FROM auth_rate_limits WHERE window_start < \?/);
  assert.match(maintenance, /DELETE FROM submission_rate_limits WHERE window_start < \?/);
  assert.match(maintenance, /daily_maintenance_already_running/);
  assert.match(worker, /runDailyMaintenance\(controller\.scheduledTime\)/);
  assert.match(health, /maintenance\.ok/);
  assert.match(migration, /CREATE TABLE `maintenance_runs`/);
});

test("keeps the production baseline migration idempotent", async () => {
  const migrationUrl = new URL("../migrations/0001_v0_4_5_baseline.sql", import.meta.url);
  const migrationPath = decodeURIComponent(migrationUrl.pathname.replace(/^\/(?=[A-Za-z]:)/u, ""));
  const script = String.raw`
import json, sqlite3, sys
sql = open(sys.argv[1], encoding="utf-8").read()
connection = sqlite3.connect(":memory:")
connection.executescript(sql)
connection.executescript(sql)
tables = sorted(row[0] for row in connection.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
))
print(json.dumps(tables))
`;
  const { stdout } = await execFileAsync(python, ["-c", script, migrationPath]);
  assert.deepEqual(JSON.parse(stdout), [
    "auth_rate_limits",
    "email_login_codes",
    "maintenance_runs",
    "moderation_events",
    "pet_submissions",
    "review_notifications",
    "submission_rate_limits",
    "user_api_keys",
    "user_sessions",
    "users",
  ]);
});

test("publishes privacy, submission rules, scheduled smoke, and one-command release checks", async () => {
  const [privacy, terms, footer, account, workflow, release] = await Promise.all([
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/terms/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/site-footer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/production-smoke.yml", import.meta.url), "utf8"),
    readFile(new URL("../scripts/release-production.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(privacy, /过期验证码/);
  assert.match(terms, /投稿者的确认/);
  assert.match(footer, /举报与版权反馈/);
  assert.match(account, /acceptedRules/);
  assert.match(workflow, /cron: "30 1 \* \* \*"/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/);
  assert.match(release, /shell: useShell/);
  assert.ok(release.indexOf("d1\", \"export") < release.indexOf("migrations\", \"apply"));
  assert.ok(release.indexOf("migrations\", \"apply") < release.indexOf("wrangler\", \"deploy"));
  assert.ok(release.indexOf("wrangler\", \"deploy") < release.indexOf("run\", \"smoke"));
});
