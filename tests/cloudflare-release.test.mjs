import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("publishes the two approved pets with stable IDs and checksums", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("../registry/catalog.json", import.meta.url), "utf8"),
  );

  assert.equal(catalog.schemaVersion, 1);
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

test("serves previews through the Cloudflare asset binding without self-fetching", async () => {
  const route = await readFile(
    new URL("../app/api/pets/[id]/preview/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /getPetRegistryBindings\(\)\?\.ASSETS/);
  assert.match(route, /assets\.fetch/);
  assert.doesNotMatch(route, /await fetch\(new URL/);
});

test("declares the production R2 binding without D1", async () => {
  const [hosting, vite, worker, generatedWrangler] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../dist/server/wrangler.json", import.meta.url), "utf8"),
  ]);

  assert.deepEqual(JSON.parse(hosting), { r2: "PET_FILES" });
  assert.match(vite, /workers_dev: true/);
  assert.match(vite, /binding: "PET_FILES"/);
  assert.match(vite, /assets:\s*{\s*binding: "ASSETS"/);
  assert.match(vite, /bucket_name: "codex-pet-club-packages"/);
  assert.match(worker, /PET_FILES: R2Bucket/);
  assert.doesNotMatch(worker, /DB: D1Database/);
  assert.equal(JSON.parse(generatedWrangler).assets.binding, "ASSETS");
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

test("keeps public uploads closed for the first release", async () => {
  const route = await readFile(new URL("../app/api/pets/route.ts", import.meta.url), "utf8");

  assert.match(route, /publicPets/);
  assert.match(route, /export async function POST/);
  assert.match(route, /Community submissions are not open in the first public release/);
  assert.match(route, /status: 403/);
});

test("keeps moderation local-only", async () => {
  const [layout, guard, adminList] = await Promise.all([
    readFile(new URL("../app/admin/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/local-only.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/pets/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /notFound\(\)/);
  assert.match(layout, /host !== "localhost"/);
  assert.match(guard, /status: 404/);
  assert.match(adminList, /localOnlyResponse/);
});

test("has no seed endpoint or deploy-time secret in the final tree", async () => {
  await assert.rejects(access(new URL("../app/api/internal/seed/route.ts", import.meta.url)));
  await assert.rejects(access(new URL("../.env", import.meta.url)));
});

test("keeps the catalog and Skill installation as separate pages", async () => {
  const [catalogPage, skillPage] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/skill/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(catalogPage, /查看全部动作/);
  assert.match(catalogPage, /data-testid="pet-detail-modal"/);
  assert.match(catalogPage, /href="\/skill"/);
  assert.doesNotMatch(catalogPage, /codex-pet-club-skill\.zip/);
  assert.match(skillPage, /codex-pet-club-skill\.zip/);
  assert.match(skillPage, /codex-pet-club-skill/);
});
