import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("creator and admin metadata routes enforce their separate authorization boundaries", async () => {
  const [creatorRoute, adminRoute, registry] = await Promise.all([
    readFile(new URL("../app/api/submissions/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/pets/[id]/metadata/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/pet-registry.ts", import.meta.url), "utf8"),
  ]);

  assert.match(creatorRoute, /export async function PATCH/);
  assert.match(creatorRoute, /currentUser\(request\)/);
  assert.match(creatorRoute, /updateCreatorSubmissionMetadata/);
  assert.match(adminRoute, /adminOnlyResponse\(request\)/);
  assert.match(adminRoute, /updateAdminSubmissionMetadata/);
  assert.match(registry, /current\.owner_user_id !== actor\.userId/);
  assert.match(registry, /throw new RegistryError\("Submission not found", 404\)/);
  assert.match(registry, /INSERT INTO submission_metadata_events/);
  assert.match(registry, /before_json, after_json/);
});

test("public creator profiles contain published work without private account fields", async () => {
  const [registry, apiRoute, creatorPage, catalogPage, detailClient] = await Promise.all([
    readFile(new URL("../lib/pet-registry.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/creators/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/creators/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pets/[id]/pet-detail-client.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(registry, /export async function getPublicCreatorProfile/);
  assert.match(registry, /SELECT id, display_name, created_at/);
  assert.match(registry, /status = 'published'/);
  assert.match(apiRoute, /getPublicCreatorProfile/);
  assert.doesNotMatch(apiRoute, /email|api.?key|credential/i);
  assert.match(creatorPage, /creator\.pets/);
  assert.match(catalogPage, /\/creators\/\$\{pet\.creatorId\}/);
  assert.match(detailClient, /\/creators\/\$\{pet\.creatorId\}/);
});

test("v0.5.2 migration and backup preserve metadata audit history", async () => {
  const [migration, backup, restore] = await Promise.all([
    readFile(new URL("../migrations/0003_v0_5_2_content_management.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/registry-backup.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/restore-backup-drill.py", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS submission_metadata_events/);
  assert.match(migration, /submission_metadata_events_submission_idx/);
  assert.match(backup, /schemaVersion: 5/);
  assert.match(backup, /submissionMetadataEvents: metadataChanges/);
  assert.match(restore, /schema_version not in \(1, 2, 3, 4, 5\)/);
  assert.match(restore, /submission_metadata_events/);

  const script = String.raw`
import json, pathlib, sqlite3, sys
db = sqlite3.connect(":memory:")
for migration_path in sys.argv[1:]:
    db.executescript(pathlib.Path(migration_path).read_text(encoding="utf-8"))
tables = [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type = 'table'")]
indexes = [row[1] for row in db.execute("PRAGMA index_list(submission_metadata_events)")]
print(json.dumps({"tables": tables, "indexes": indexes}))
`;
  const migrations = [
    new URL("../migrations/0001_v0_4_5_baseline.sql", import.meta.url),
    new URL("../migrations/0002_v0_5_1_catalog_taxonomy.sql", import.meta.url),
    new URL("../migrations/0003_v0_5_2_content_management.sql", import.meta.url),
  ].map((url) => decodeURIComponent(url.pathname.replace(/^\/(?=[A-Za-z]:)/u, "")));
  const { stdout } = await execFileAsync("python", ["-c", script, ...migrations]);
  const result = JSON.parse(stdout);
  assert.ok(result.tables.includes("submission_metadata_events"));
  assert.ok(result.indexes.includes("submission_metadata_events_submission_idx"));
});

test("built worker rejects unauthenticated metadata mutations", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("content-management-test", `${process.pid}-${Date.now()}`);
  const worker = (await import(workerUrl.href)).default;
  const environment = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    ADMIN_TOKEN: "configured-test-token",
  };
  const context = { waitUntil() {}, passThroughOnException() {} };
  const options = {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ metadata: { displayName: "Unauthorized" } }),
  };

  const creatorResponse = await worker.fetch(
    new Request("http://localhost/api/submissions/00000000-0000-4000-8000-000000000000", options),
    environment,
    context,
  );
  assert.equal(creatorResponse.status, 401);

  const adminResponse = await worker.fetch(
    new Request("https://app.test/api/admin/pets/00000000-0000-4000-8000-000000000000/metadata", options),
    environment,
    context,
  );
  assert.equal(adminResponse.status, 401);
});
