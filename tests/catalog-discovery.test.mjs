import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function request(pathname, accept = "application/json") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("catalog-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("filters, sorts, and paginates the public catalog API", async () => {
  const response = await request(
    "/api/pets?query=%E5%87%A4%E5%96%9C&category=character&tag=3D&sort=name&page=1&pageSize=1",
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 1);
  assert.equal(result.total, 1);
  assert.equal(result.totalPages, 1);
  assert.equal(result.pets[0].displayName, "凤喜 3D");
  assert.equal(result.pets[0].category, "character");
  assert.ok(result.pets[0].tags.includes("3D"));
  assert.ok(result.categories.some((category) => category.id === "character" && category.count === 2));
  assert.ok(result.tags.some((tag) => tag.name === "3D"));
});

test("renders a stable independent pet detail URL", async () => {
  const id = "063e4124-91e3-440d-9f3b-40034565a54f";
  const response = await request(`/pets/${id}`, "text/html");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /凤喜 3D/);
  assert.match(html, /NOW PLAYING/);
  assert.match(html, /复制详情链接/);
  assert.match(html, new RegExp(`/pets/${id}`));
});

test("migrates taxonomy fields and preserves them in backups", async () => {
  const [migration, schema, registry, backup, restore, detailPage] = await Promise.all([
    readFile(new URL("../migrations/0002_v0_5_1_catalog_taxonomy.sql", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/pet-registry.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/registry-backup.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/restore-backup-drill.py", import.meta.url), "utf8"),
    readFile(new URL("../app/pets/[id]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /ADD COLUMN category/);
  assert.match(migration, /ADD COLUMN tags/);
  assert.match(schema, /petPublishedCategoryUpdatedIdx|pet_published_category_updated_idx/);
  assert.match(registry, /normalizePetTags/);
  assert.match(registry, /metadata\.category/);
  assert.match(backup, /schemaVersion: 5/);
  assert.match(restore, /SUBMISSION_COLUMNS_V4/);
  assert.match(detailPage, /generateMetadata/);
  assert.match(detailPage, /canonical/);
});

test("applies the v0.5.1 migration to an existing registry", async () => {
  const script = String.raw`
import json, pathlib, sqlite3, sys
db = sqlite3.connect(":memory:")
db.executescript(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
db.execute("""INSERT INTO pet_submissions (
  id, slug, name, status, file_key, sha256, size_bytes, created_at, updated_at
) VALUES (?, ?, ?, 'published', ?, ?, ?, ?, ?)""", (
  "community-cat-0001", "orange-white-kitty", "OrangeWhiteKitty",
  "packages/test.zip", "a" * 64, 1024, "2026-07-19T00:00:00Z", "2026-07-19T00:00:00Z"
))
db.executescript(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
columns = [row[1] for row in db.execute("PRAGMA table_info(pet_submissions)")]
indexes = [row[1] for row in db.execute("PRAGMA index_list(pet_submissions)")]
row = db.execute("SELECT category, tags FROM pet_submissions WHERE id = 'community-cat-0001'").fetchone()
print(json.dumps({"columns": columns, "indexes": indexes, "row": row}))
`;
  const baseline = new URL("../migrations/0001_v0_4_5_baseline.sql", import.meta.url);
  const taxonomy = new URL("../migrations/0002_v0_5_1_catalog_taxonomy.sql", import.meta.url);
  const { stdout } = await execFileAsync("python", [
    "-c",
    script,
    decodeURIComponent(baseline.pathname.replace(/^\/(?=[A-Za-z]:)/u, "")),
    decodeURIComponent(taxonomy.pathname.replace(/^\/(?=[A-Za-z]:)/u, "")),
  ]);
  const result = JSON.parse(stdout);
  assert.ok(result.columns.includes("category"));
  assert.ok(result.columns.includes("tags"));
  assert.ok(result.indexes.includes("pet_published_category_updated_idx"));
  assert.deepEqual(result.row, ["animal", "[]"]);
});
