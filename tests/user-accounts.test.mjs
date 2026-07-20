import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const python = process.platform === "win32" ? "python" : "python3";

test("adds verified email accounts with secure browser sessions", async () => {
  const [auth, requestCode, verifyCode, session, worker] = await Promise.all([
    readFile(new URL("../lib/user-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/request-code/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/verify-code/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(auth, /EMAIL_CODE_TTL_MS = 10 \* 60 \* 1000/);
  assert.match(auth, /EMAIL_CODE_ATTEMPTS = 5/);
  assert.match(auth, /SameSite=Lax/);
  assert.match(auth, /HttpOnly/);
  assert.match(auth, /; Secure/);
  assert.match(auth, /MAIL_SERVICE_URL/);
  assert.match(auth, /MAIL_SERVICE_TOKEN/);
  assert.match(auth, /\/v1\/verification-code/);
  assert.match(auth, /endpoint\.protocol !== "https:"/);
  assert.match(auth, /response\.status !== 202/);
  assert.match(requestCode, /requestEmailCode/);
  assert.match(verifyCode, /set-cookie/);
  assert.match(session, /logoutSession/);
  assert.match(worker, /AUTH_SECRET/);
  assert.match(worker, /MAIL_SERVICE_URL/);
  assert.match(worker, /MAIL_SERVICE_TOKEN/);
});

test("limits each account to three revocable hashed Skill keys", async () => {
  const [auth, listRoute, revokeRoute, meRoute] = await Promise.all([
    readFile(new URL("../lib/user-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/keys/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/keys/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/me/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(auth, /MAX_ACTIVE_API_KEYS = 3/);
  assert.match(auth, /cpc_sk_/);
  assert.match(auth, /key_hash TEXT NOT NULL UNIQUE/);
  assert.match(auth, /revoked_at IS NULL/);
  assert.match(auth, /SELECT COUNT\(\*\).*revoked_at IS NULL/s);
  assert.match(listRoute, /maxActiveKeys: 3/);
  assert.match(revokeRoute, /revokeUserApiKey/);
  assert.match(meRoute, /emailMasked/);
  assert.doesNotMatch(meRoute, /email: user\.email/);
});

test("requires authenticated submissions and binds them to a stable user id", async () => {
  const [registry, upload, schema, migration] = await Promise.all([
    readFile(new URL("../lib/pet-registry.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pets/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_user_accounts.sql", import.meta.url), "utf8"),
  ]);

  assert.match(registry, /owner_user_id/);
  assert.match(registry, /owner\?\.id \?\? null/);
  assert.match(registry, /owner\?\.displayName/);
  assert.match(upload, /apiKeyUser\(request\)/);
  assert.doesNotMatch(upload, /optionalApiKeyUser/);
  assert.match(upload, /createSubmission\([\s\S]*owner/);
  assert.match(schema, /ownerUserId/);
  assert.match(migration, /ALTER TABLE `pet_submissions` ADD `owner_user_id`/);
  assert.doesNotMatch(migration, /CREATE TABLE `moderation_events`/);
});

test("lists and opens only the authenticated creator's submissions", async () => {
  const [registry, listRoute, detailRoute] = await Promise.all([
    readFile(new URL("../lib/pet-registry.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/me/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/submissions/[id]/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(registry, /listCreatorSubmissions/);
  assert.match(registry, /owner_user_id = \?/);
  assert.match(registry, /WHERE id = \? AND owner_user_id = \?/);
  assert.match(registry, /ORDER BY created_at DESC, id DESC/);
  assert.match(listRoute, /currentUser\(request\)/);
  assert.match(listRoute, /status: rawStatus/);
  assert.match(listRoute, /private, no-store/);
  assert.match(detailRoute, /currentUser\(request\)/);
  assert.match(detailRoute, /getCreatorSubmission\(id, user\.id\)/);
  assert.doesNotMatch(detailRoute, /getSubmissionStatus/);
});

test("renders a creator account and Key management workspace", async () => {
  const account = await readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(account, /让每一只桌宠/);
  assert.match(account, /最多 3 个 Skill Key/);
  assert.match(account, /同一个 Key 可以在多台电脑使用/);
  assert.match(account, /Key 只完整展示一次/);
  assert.match(account, /\/api\/auth\/request-code/);
  assert.match(account, /\/api\/account\/keys/);
  assert.match(account, /\/api\/me\/submissions/);
  assert.match(account, /MY SUBMISSIONS/);
  assert.match(account, /查看详情/);
  assert.match(account, /复制安装指令/);
  assert.doesNotMatch(account, /localStorage|sessionStorage/);
  assert.match(page, /href="\/account"/);
});

test("migrates the existing registry without recreating operational tables", async () => {
  const root = new URL("../", import.meta.url);
  const migrations = [
    new URL("drizzle/0000_abandoned_groot.sql", root),
    new URL("drizzle/0001_registry_operations.sql", root),
    new URL("drizzle/0002_user_accounts.sql", root),
    new URL("drizzle/0003_review_notifications.sql", root),
  ];
  const script = String.raw`
import json, sqlite3, sys
connection = sqlite3.connect(":memory:")
for path in sys.argv[1:]:
    with open(path, encoding="utf-8") as handle:
        connection.executescript(handle.read().replace("--> statement-breakpoint", ""))
tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
columns = {row[1] for row in connection.execute("PRAGMA table_info(pet_submissions)")}
indexes = {row[1] for row in connection.execute("PRAGMA index_list('pet_submissions')")}
print(json.dumps({
    "tables": sorted(tables),
    "ownerColumn": "owner_user_id" in columns,
    "ownerIndex": "pet_submissions_owner_idx" in indexes,
}))
`;
  const { stdout } = await execFileAsync(python, [
    "-c",
    script,
    ...migrations.map((url) => decodeURIComponent(url.pathname.replace(/^\/(?=[A-Za-z]:)/u, ""))),
  ]);
  const result = JSON.parse(stdout);
  assert.deepEqual(result.tables, [
    "auth_rate_limits",
    "email_login_codes",
    "moderation_events",
    "pet_submissions",
    "review_notifications",
    "submission_rate_limits",
    "user_api_keys",
    "user_sessions",
    "users",
  ]);
  assert.equal(result.ownerColumn, true);
  assert.equal(result.ownerIndex, true);
});

test("backs up and restores account ownership with hashed keys", async () => {
  const backup = await readFile(new URL("../lib/registry-backup.ts", import.meta.url), "utf8");
  assert.match(backup, /schemaVersion: 5/);
  assert.match(backup, /users,/);
  assert.match(backup, /userApiKeys: apiKeys/);

  const directory = await mkdtemp(join(tmpdir(), "codex-pet-club-backup-"));
  const backupPath = join(directory, "backup.json");
  const payload = {
    schemaVersion: 3,
    source: "codex-pet-club-db",
    createdAt: "2026-07-19T00:00:00.000Z",
    submissions: [{
      id: "submission-1",
      slug: "orange-white-kitty",
      name: "OrangeWhiteKitty",
      description: "",
      author: "橘猫工作室",
      license: "unspecified",
      status: "pending",
      file_key: "submissions/submission-1.zip",
      sha256: "a".repeat(64),
      size_bytes: 1024,
      created_at: "2026-07-19T00:00:00.000Z",
      updated_at: "2026-07-19T00:00:00.000Z",
      published_at: null,
      reviewed_at: null,
      review_note: "",
      owner_user_id: "user-1",
    }],
    moderationEvents: [{
      id: "event-1",
      submission_id: "submission-1",
      pet_key: "orange-white-kitty",
      display_name: "OrangeWhiteKitty",
      action: "submitted",
      note: "",
      created_at: "2026-07-19T00:00:00.000Z",
    }],
    users: [{
      id: "user-1",
      email: "creator@example.com",
      display_name: "橘猫工作室",
      email_verified_at: "2026-07-19T00:00:00.000Z",
      status: "active",
      created_at: "2026-07-19T00:00:00.000Z",
      updated_at: "2026-07-19T00:00:00.000Z",
    }],
    userApiKeys: [{
      id: "key-1",
      user_id: "user-1",
      name: "我的电脑",
      prefix: "deadbeef",
      key_hash: "b".repeat(64),
      created_at: "2026-07-19T00:00:00.000Z",
      last_used_at: null,
      revoked_at: null,
    }],
    reviewNotifications: [{
      id: "notification-1",
      submission_id: "submission-1",
      user_id: "user-1",
      action: "published",
      status: "sent",
      attempts: 1,
      last_error: "",
      request_id: "mail-request-1",
      next_attempt_at: 1784419200000,
      created_at: "2026-07-19T00:00:00.000Z",
      updated_at: "2026-07-19T00:01:00.000Z",
      sent_at: "2026-07-19T00:01:00.000Z",
    }],
  };
  try {
    await writeFile(backupPath, JSON.stringify(payload), "utf8");
    const scriptPath = new URL("../scripts/restore-backup-drill.py", import.meta.url);
    const { stdout } = await execFileAsync(python, [
      decodeURIComponent(scriptPath.pathname.replace(/^\/(?=[A-Za-z]:)/u, "")),
      backupPath,
    ]);
    const result = JSON.parse(stdout);
    assert.equal(result.ok, true);
    assert.equal(result.submissions, 1);
    assert.equal(result.events, 1);
    assert.equal(result.users, 1);
    assert.equal(result.apiKeys, 1);
    assert.equal(result.notifications, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
