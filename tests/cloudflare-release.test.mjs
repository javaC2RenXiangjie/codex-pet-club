import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("publishes the two approved pets with stable IDs and checksums", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("../registry/catalog.json", import.meta.url), "utf8"),
  );

  assert.equal(catalog.schemaVersion, 2);
  assert.equal(catalog.pets.length, 2);
  assert.deepEqual(
    catalog.pets.map((pet) => [pet.id, pet.displayName, pet.status, pet.activeVersion]),
    [
      ["063e4124-91e3-440d-9f3b-40034565a54f", "凤喜 3D", "published", "1.0.0"],
      ["e9029e8c-de60-4f0b-bf79-81156c978126", "凤喜", "published", "1.0.0"],
    ],
  );
  assert.equal(catalog.pets[0].releases[0].sha256, "8ce62b254f873e1b7c7969b5cbde36340e52a54796406af0ec27c3090059944b");
  assert.equal(catalog.pets[1].releases[0].sha256, "99f2aa0000b3577c813259afe98716309dbcf597a7096bdaa59b0266b066e810");
});

test("keeps pet packages in Cloudflare R2 behind the Skill route", async () => {
  const route = await readFile(
    new URL("../app/api/pets/[id]/package/route.ts", import.meta.url),
    "utf8",
  );

  await assert.rejects(
    access(new URL("../public/registry/packages/fengxi.zip", import.meta.url)),
  );
  await assert.rejects(
    access(new URL("../public/registry/packages/fengxi-3d.zip", import.meta.url)),
  );
  assert.match(route, /getPetRegistryBindings\(\)\?\.PET_FILES/);
  assert.match(route, /request\.headers\.get\("x-codex-pet-client"\) !== "skill-v1"/);
  assert.match(route, /x-pet-sha256/);
  assert.match(route, /x-pet-key/);
  assert.match(route, /x-pet-version/);
  assert.doesNotMatch(route, /getStore|packagePath|registry\/packages/);
});

test("publishes the pinned automatic Skill update manifest", async () => {
  const [releaseText, route, packageText, smoke] = await Promise.all([
    readFile(new URL("../registry/skill-release.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/skill/version/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/post-deploy-smoke.mjs", import.meta.url), "utf8"),
  ]);
  const release = JSON.parse(releaseText);
  const packageJson = JSON.parse(packageText);

  assert.equal(release.schemaVersion, 1);
  assert.equal(release.version, "0.4.4");
  assert.equal(packageJson.version, "0.6.0");
  assert.equal(release.sizeBytes, 20535);
  assert.match(release.sha256, /^[a-f0-9]{64}$/);
  assert.equal(
    release.archiveUrl,
    "https://github.com/javaC2RenXiangjie/codex-pet-club-skill/releases/download/v0.4.4/codex-pet-club-skill-v0.4.4.zip",
  );
  assert.match(route, /registry\/skill-release\.json/);
  assert.match(route, /cache-control/);
  assert.match(route, /no-store/);
  assert.match(smoke, /CODEX_PET_SMOKE_HAS_BODY/);
  assert.match(smoke, /FromBase64String\(\$env:CODEX_PET_SMOKE_BODY\)/);
});

test("serves previews through the Cloudflare asset binding without self-fetching", async () => {
  const route = await readFile(
    new URL("../app/api/pets/[id]/preview/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /getPetRegistryBindings\(\)\?\.ASSETS/);
  assert.match(route, /assets\.fetch/);
  assert.doesNotMatch(route, /await fetch\(new URL/);
});

test("declares production R2 and D1 bindings", async () => {
  const [hosting, vite, worker, generatedWrangler] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../dist/server/wrangler.json", import.meta.url), "utf8"),
  ]);

  assert.deepEqual(JSON.parse(hosting), { r2: "PET_FILES", d1: "DB" });
  assert.match(vite, /workers_dev: true/);
  assert.match(vite, /binding: "PET_FILES"/);
  assert.match(vite, /assets:\s*{\s*binding: "ASSETS"/);
  assert.match(vite, /bucket_name: "codex-pet-club-packages"/);
  assert.match(vite, /binding: "DB"/);
  assert.match(vite, /database_name: "codex-pet-club-db"/);
  assert.match(vite, /migrations_dir: "\.\.\/\.\.\/migrations"/);
  assert.match(worker, /PET_FILES: R2Bucket/);
  assert.match(worker, /DB: D1Database/);
  assert.equal(JSON.parse(generatedWrangler).assets.binding, "ASSETS");
  assert.equal(JSON.parse(generatedWrangler).d1_databases[0].binding, "DB");
  assert.deepEqual(JSON.parse(generatedWrangler).triggers.crons, ["0 3 * * *", "*/5 * * * *"]);
});

test("ships valid WebP previews for every public pet", async () => {
  const previewNames = [
    "063e4124-91e3-440d-9f3b-40034565a54f.webp",
    "e9029e8c-de60-4f0b-bf79-81156c978126.webp",
  ];

  for (const name of previewNames) {
    const bytes = await readFile(new URL(`../public/registry/previews/${name}`, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
    assert.ok(bytes.length > 100_000, `${name} is unexpectedly small`);
  }
});

test("accepts moderated Skill submissions", async () => {
  const route = await readFile(new URL("../app/api/pets/route.ts", import.meta.url), "utf8");

  assert.match(route, /listPublicPetCatalog/);
  assert.match(route, /export async function POST/);
  assert.match(route, /createSubmission/);
  assert.match(route, /status: 202/);
  assert.match(route, /multipart\/form-data/);
  assert.match(route, /enforceSubmissionRateLimit/);
});

test("adds rate limits, audit events, unpublish, and R2 backups", async () => {
  const [registry, backup, decisionRoute, backupRoute, migration, worker] =
    await Promise.all([
      readFile(new URL("../lib/pet-registry.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/registry-backup.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/admin/pets/[id]/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/admin/backups/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../drizzle/0001_registry_operations.sql", import.meta.url), "utf8"),
      readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    ]);

  assert.match(registry, /SUBMISSION_RATE_LIMIT = 3/);
  assert.match(registry, /submission_rate_limits/);
  assert.match(registry, /moderation_events/);
  assert.match(registry, /unpublishSubmission/);
  assert.match(registry, /sha256 = \?/);
  assert.match(decisionRoute, /unpublished/);
  assert.match(backup, /backups\/d1\//);
  assert.match(backup, /moderationEvents/);
  assert.match(backupRoute, /createRegistryBackup/);
  assert.match(backup, /verifyRegistryBackup/);
  assert.match(backupRoute, /export async function PATCH/);
  assert.match(migration, /CREATE TABLE `moderation_events`/);
  assert.match(migration, /CREATE TABLE `submission_rate_limits`/);
  assert.match(worker, /async scheduled/);
  assert.match(worker, /runDailyMaintenance/);
});

test("reports registry health, validates restores, and paginates the audit log", async () => {
  const [health, healthRoute, registry, eventRoute, restoreDrill] = await Promise.all([
    readFile(new URL("../lib/registry-health.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/health/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/pet-registry.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/events/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/restore-backup-drill.py", import.meta.url), "utf8"),
  ]);

  assert.match(health, /overall: "healthy" \| "degraded"/);
  assert.match(health, /ageHours <= 36/);
  assert.match(healthRoute, /adminOnlyResponse/);
  assert.match(registry, /queryModerationEvents/);
  assert.match(registry, /LIMIT \? OFFSET \?/);
  assert.match(eventRoute, /pageSize/);
  assert.match(eventRoute, /操作类型无效/);
  assert.match(restoreDrill, /sqlite3\.connect\(":memory:"\)/);
  assert.match(restoreDrill, /Restored row count does not match/);
});

test("protects online moderation with a Worker secret", async () => {
  const [layout, guard, adminList, adminPage] = await Promise.all([
    readFile(new URL("../app/admin/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/admin-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/pets/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(layout, /notFound\(\)/);
  assert.match(guard, /ADMIN_TOKEN/);
  assert.match(guard, /status: 401/);
  assert.match(guard, /crypto\.subtle\.digest/);
  assert.match(adminList, /adminOnlyResponse/);
  assert.doesNotMatch(adminPage, /sessionStorage/);
  assert.match(adminPage, /刷新后需要重新输入/);
  assert.match(adminPage, /type="password"/);
});

test("has no seed endpoint or deploy-time secret in the final tree", async () => {
  await assert.rejects(access(new URL("../app/api/internal/seed/route.ts", import.meta.url)));
  await assert.rejects(access(new URL("../.env", import.meta.url)));
});

test("keeps the story, catalog, and Skill installation as separate pages", async () => {
  const [storyPage, catalogPage, skillPage] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pets/pet-catalog-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/skill/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(storyPage, /\/api\/homepage\/pets/);
  assert.match(storyPage, /data-story-step="4"/);
  assert.match(storyPage, /href="\/pets"/);
  assert.match(catalogPage, /查看九种动作与安装方式/);
  assert.match(catalogPage, /href={`\/pets\/\$\{pet\.id\}`}/);
  assert.doesNotMatch(catalogPage, /pet-detail-modal|setSelectedPet/);
  assert.doesNotMatch(skillPage, /codex-pet-club-skill\.zip/);
  assert.match(skillPage, /codex-pet-club-skill/);
});
