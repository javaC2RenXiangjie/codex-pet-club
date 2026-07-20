import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("filters and paginates the moderation queue with exact duplicate hints", async () => {
  const [registry, route] = await Promise.all([
    readFile(new URL("../lib/pet-registry.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/pets/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(registry, /type ModerationSubmissionPage/);
  assert.match(registry, /byPetKey/);
  assert.match(registry, /bySha256/);
  assert.match(registry, /reasons: Array<"petKey" \| "sha256">/);
  assert.match(registry, /normalizedQuery/);
  assert.match(registry, /duplicatesOnly/);
  assert.match(registry, /filtered\.slice/);
  assert.match(route, /searchParams\.get\("status"\)/);
  assert.match(route, /searchParams\.get\("query"\)/);
  assert.match(route, /searchParams\.get\("duplicates"\)/);
  assert.match(route, /submissionPage/);
});

test("requires a consistent review checklist and reasoned negative decisions", async () => {
  const [admin, decision, styles] = await Promise.all([
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/pets/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(admin, /搜索投稿/);
  assert.match(admin, /只看历史重复/);
  assert.match(admin, /发现历史相似投稿/);
  assert.match(admin, /动作与图集/);
  assert.match(admin, /授权与来源/);
  assert.match(admin, /commonRejectReasons/);
  assert.match(admin, /disabled=\{processing \|\| !reviewReady\}/);
  assert.match(decision, /approvalChecklistKeys/);
  assert.match(decision, /Complete every approval checklist item/);
  assert.match(decision, /A review reason is required/);
  assert.match(styles, /admin-review-checklist/);
  assert.match(styles, /admin-common-reasons/);
  assert.match(styles, /admin-duplicate-warning/);
});

test("licenses system code separately from submitted pet artwork", async () => {
  const [license, packageJson, readme, terms, layout, socialImage] = await Promise.all([
    readFile(new URL("../LICENSE", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../app/terms/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/og.png", import.meta.url)),
  ]);

  assert.match(license, /^MIT License/);
  assert.equal(packageJson.version, "0.5.0");
  assert.equal(packageJson.license, "MIT");
  assert.match(readme, /用户投稿的桌宠、角色形象、图集/);
  assert.match(terms, /不自动覆盖用户投稿的角色形象/);
  assert.match(layout, /openGraph/);
  assert.match(layout, /twitter/);
  assert.equal(socialImage.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(socialImage.readUInt32BE(16), 1200);
  assert.equal(socialImage.readUInt32BE(20), 630);
});
