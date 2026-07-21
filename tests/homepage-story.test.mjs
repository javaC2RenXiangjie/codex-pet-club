import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function request(pathname) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("homepage-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "application/json" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("returns a real, unique, bounded homepage pet cast", async () => {
  const response = await request("/api/homepage/pets");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /max-age=300/);
  const payload = await response.json();
  assert.ok(Array.isArray(payload.pets));
  assert.ok(payload.pets.length > 0 && payload.pets.length <= 5);
  assert.equal(payload.heroPetId, payload.pets[0].id);
  assert.equal(new Set(payload.pets.map((pet) => pet.id)).size, payload.pets.length);
  assert.ok(payload.pets.every((pet) => typeof pet.isOfficial === "boolean"));
});

test("selects curated pets first and fills remaining slots with category diversity", async () => {
  const registry = await readFile(new URL("../lib/public-registry.ts", import.meta.url), "utf8");
  assert.match(registry, /filter\(\(pet\) => pet\.homepageFeatured\)/);
  assert.match(registry, /right\.homepagePriority - left\.homepagePriority/);
  assert.match(registry, /selectedCategories\.has\(pet\.category\)/);
  assert.match(registry, /if \(selected\.length >= safeLimit\) break/);
  assert.match(registry, /heroPetId: selected\[0\]\?\.id \?\? null/);
});

test("keeps homepage curation server-owned and published-only", async () => {
  const [registry, route, adminRoute, migration] = await Promise.all([
    readFile(new URL("../lib/pet-registry.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/homepage/pets/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/pets/[id]/homepage/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../migrations/0004_v0_6_0_homepage_curation.sql", import.meta.url), "utf8"),
  ]);
  assert.match(registry, /WHERE status = 'published'/);
  assert.match(registry, /files\.head\(row\.file_key\)/);
  assert.match(registry, /Only published pets can be curated for the homepage/);
  assert.match(registry, /priority must be an integer between 0 and 100/);
  assert.match(route, /listHomepagePets\(5\)/);
  assert.match(adminRoute, /adminOnlyResponse/);
  assert.match(adminRoute, /updateHomepagePresentation/);
  assert.match(migration, /is_official/);
  assert.match(migration, /homepage_featured/);
  assert.match(migration, /homepage_priority/);
});

test("renders the story from API data without hard-coded pet identities", async () => {
  const [story, catalog, player, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pets/pet-catalog-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/pet-sprite-player.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(story, /fetch\("\/api\/homepage\/pets"/);
  assert.match(story, /pets\.slice\(0, mobile \? 2 : 5\)/);
  assert.match(story, /data-story-step="0"/);
  assert.match(story, /data-story-step="4"/);
  assert.match(story, /还没有桌宠/);
  assert.match(story, /复制它的/);
  assert.match(story, /把这个桌宠下载到我本地，ID：/);
  assert.match(story, /已加入 Codex 宠物列表/);
  assert.doesNotMatch(story, /story-portal-ring|SKILL PORTAL|唯一 ID<\/span><i>/);
  assert.doesNotMatch(story, /凤喜|橘宝|OrangeWhiteKitty/);
  assert.match(catalog, /href={`\/pets\/\$\{pet\.id\}`}/);
  assert.match(player, /active\?: boolean/);
  assert.match(player, /frameDurations: \[280, 110, 110, 140, 140, 320\]/);
  assert.match(player, /current\.frame \+ 1\) % action\.frameDurations\.length/);
  assert.doesNotMatch(player, /current \+ 1\) % 8/);
  assert.match(story, /rootMargin: "-48% 0px -48% 0px"/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  const reducedMotionStyles = styles.split("@media (prefers-reduced-motion: reduce)")[1] ?? "";
  assert.doesNotMatch(reducedMotionStyles, /\.story-stage \{ position: relative/);
  assert.match(styles, /\.public-nav-toggle/);
});
