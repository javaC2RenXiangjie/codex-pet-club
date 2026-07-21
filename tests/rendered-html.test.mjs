import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the data-driven Codex Pet Club story", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>Codex Pet Club · 桌宠开源俱乐部<\/title>/i);
  assert.match(html, /想给 Codex/);
  assert.match(html, /找个桌面搭档/);
  assert.match(html, /桌宠库/);
  assert.match(html, /把 ID/);
  assert.match(html, /直接发给 Codex/);
  assert.match(html, /进入桌宠库/);
  assert.match(html, /安装 Skill/);
  assert.match(html, /href="\/skill"/);
  assert.match(html, /分享我的桌宠/);
  assert.doesNotMatch(html, /codex-pet-club-skill\.zip/);
  assert.doesNotMatch(html, /OFFICIAL CODEX SKILL/);
  assert.doesNotMatch(html, /-source\.zip|拿源文件|直接下载可编辑的源文件/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships only the official Skill and removes direct pet downloads", async () => {
  const [page, catalogPage, detailPage, skillPage, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pets/pet-catalog-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pets/[id]/pet-detail-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/skill/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /-source\.zip|contributor-template\.zip|拿源文件/);
  assert.doesNotMatch(page, /codex-pet-club-skill\.zip/);
  assert.doesNotMatch(page, /OFFICIAL CODEX SKILL/);
  assert.match(page, /href="\/skill#publish"/);
  assert.match(catalogPage, /href={`\/pets\/\$\{pet\.id\}`}/);
  assert.match(detailPage, /UNIQUE PET ID/);
  assert.match(detailPage, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(skillPage, /codex-pet-club-skill\.zip/);
  assert.match(skillPage, /https:\/\/github\.com\/javaC2RenXiangjie\/codex-pet-club-skill/);
  assert.match(skillPage, /OFFICIAL CODEX SKILL/);
  assert.match(skillPage, /copyInstallPrompt/);
  assert.match(skillPage, /copyRegistryPrompt/);
  assert.match(skillPage, /copyPublishPrompt/);
  assert.match(skillPage, /navigator\.clipboard\.writeText/);
  assert.match(layout, /lang="zh-CN"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("../public/downloads/codex-pet-club-skill.zip", import.meta.url)));
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
  await assert.rejects(access(new URL("public/_sites-preview", projectRoot)));
});

test("renders Skill installation on its own page", async () => {
  const response = await render("/skill");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /安装一次/);
  assert.match(html, /从安装到领养/);
  assert.match(html, /连接当前桌宠库/);
  assert.doesNotMatch(html, /codex-pet-club-skill\.zip/);
  assert.match(html, /github\.com\/javaC2RenXiangjie\/codex-pet-club-skill/);
  assert.match(html, /每次使用还会自动检查并安装官方最新版/);
  assert.match(html, /不会保留旧 Skill 副本/);
  assert.match(html, /返回桌宠库/);
});

test("declares registry storage and exposes the pet API", async () => {
  const [hosting, listRoute, detailRoute, packageRoute] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pets/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pets/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pets/[id]/package/route.ts", import.meta.url), "utf8"),
  ]);

  assert.deepEqual(JSON.parse(hosting), { r2: "PET_FILES", d1: "DB" });
  assert.match(listRoute, /export async function GET/);
  assert.match(listRoute, /export async function POST/);
  assert.match(detailRoute, /resolvePublicPet/);
  assert.match(packageRoute, /getPetRegistryBindings/);
  assert.match(packageRoute, /x-pet-key/);
  assert.match(packageRoute, /x-codex-pet-client/);
});

test("renders the protected online moderation workspace", async () => {
  const response = await render("/admin");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /进入桌宠审核台/);
});

test("exposes moderation list, decision, and sprite preview routes", async () => {
  const [
    adminPage,
    listRoute,
    decisionRoute,
    spriteRoute,
    publicPreviewRoute,
    player,
    registry,
    schema,
    eventRoute,
    healthRoute,
    backupRoute,
  ] =
    await Promise.all([
      readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/admin/pets/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/admin/pets/[id]/route.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../app/api/admin/pets/[id]/spritesheet/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/api/pets/[id]/preview/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/components/pet-sprite-player.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../lib/pet-registry.ts", import.meta.url), "utf8"),
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/admin/events/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/admin/health/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/admin/backups/route.ts", import.meta.url), "utf8"),
    ]);

  assert.match(adminPage, /data-testid={`review-card-/);
  assert.match(adminPage, /通过并公开/);
  assert.match(adminPage, /拒绝投稿/);
  assert.match(adminPage, /下架桌宠/);
  assert.match(adminPage, /最近操作/);
  assert.match(adminPage, /立即备份/);
  assert.match(adminPage, /恢复预检/);
  assert.match(adminPage, /服务运行状态/);
  assert.doesNotMatch(adminPage, /sessionStorage/);
  assert.match(listRoute, /listModerationSubmissions/);
  assert.match(listRoute, /queryModerationEvents/);
  assert.match(listRoute, /listRegistryBackups/);
  assert.match(eventRoute, /queryModerationEvents/);
  assert.match(healthRoute, /getRegistryHealth/);
  assert.match(backupRoute, /verifyRegistryBackup/);
  assert.match(decisionRoute, /export async function PATCH/);
  assert.match(decisionRoute, /moderateSubmission/);
  assert.match(spriteRoute, /image\/webp/);
  assert.match(publicPreviewRoute, /resolvePublicPet/);
  assert.match(publicPreviewRoute, /public, max-age=86400, immutable/);
  assert.match(player, /setTimeout/);
  assert.match(player, /action\.frameDurations\[frame\]/);
  assert.match(player, /backgroundPosition/);
  assert.match(player, /向右移动/);
  assert.match(player, /审核/);
  assert.match(registry, /Only pending submissions can be reviewed/);
  assert.match(registry, /A published pet already uses the id/);
  assert.match(registry, /Only published submissions can be unpublished/);
  assert.match(schema, /reviewNote/);
  assert.match(schema, /reviewedAt/);
});

test("published cards use the real animated pet preview", async () => {
  const [story, catalog, player] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pets/pet-catalog-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/pet-sprite-player.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(story, /PetSpritePlayer/);
  assert.match(story, /\/api\/pets\/\$\{pet\.id\}\/preview/);
  assert.match(story, /active={activeStep/);
  assert.match(story, /size="detail"/);
  assert.match(catalog, /ViewportPetSprite/);
  assert.match(catalog, /href={`\/pets\/\$\{pet\.id\}`}/);
  assert.doesNotMatch(catalog, /setSelectedPet|pet-detail-modal/);
  assert.match(player, /% action\.frameDurations\.length/);
  assert.doesNotMatch(player, /% 8/);
  assert.match(player, /frame \/ 7/);
  assert.match(player, /row \/ 10/);
  assert.match(player, /"card" \| "admin" \| "detail"/);
  assert.match(player, /if \(!active\) return/);
});

test("opens moderated uploads while keeping admin APIs authenticated", async () => {
  const [worker, uploadRoute, adminAuth] = await Promise.all([
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pets/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/admin-auth.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(worker, /firstLaunchGuard/);
  assert.match(uploadRoute, /createSubmission/);
  assert.match(uploadRoute, /apiKeyUser\(request\)/);
  assert.doesNotMatch(uploadRoute, /optionalApiKeyUser/);
  assert.match(uploadRoute, /status: 202/);
  assert.match(adminAuth, /authorization/);
  assert.match(adminAuth, /Bearer/);
});
