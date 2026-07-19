import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
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

test("server-renders the finished Codex Pet Club catalog", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>Codex Pet Club · 桌宠开源俱乐部<\/title>/i);
  assert.match(html, /给你的 Codex/);
  assert.match(html, /桌宠库/);
  assert.match(html, /复制唯一 ID/);
  assert.match(html, /SKILL ONLY/);
  assert.match(html, /安装 Skill/);
  assert.match(html, /href="\/skill"/);
  assert.match(html, /分享我的桌宠/);
  assert.doesNotMatch(html, /codex-pet-club-skill\.zip/);
  assert.doesNotMatch(html, /OFFICIAL CODEX SKILL/);
  assert.doesNotMatch(html, /-source\.zip|拿源文件|直接下载可编辑的源文件/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships only the official Skill and removes direct pet downloads", async () => {
  const [page, skillPage, layout, packageJson, downloads] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/skill/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readdir(new URL("../public/downloads/", import.meta.url)),
  ]);

  assert.match(page, /type RegistryPet/);
  assert.match(page, /copyPetCommand/);
  assert.match(page, /UNIQUE PET ID/);
  assert.doesNotMatch(page, /-source\.zip|contributor-template\.zip|拿源文件/);
  assert.doesNotMatch(page, /codex-pet-club-skill\.zip/);
  assert.doesNotMatch(page, /OFFICIAL CODEX SKILL/);
  assert.match(page, /href="\/skill"/);
  assert.match(page, /navigator\.clipboard\.writeText/);
  assert.match(skillPage, /codex-pet-club-skill\.zip/);
  assert.match(skillPage, /https:\/\/github\.com\/javaC2RenXiangjie\/codex-pet-club-skill/);
  assert.match(skillPage, /OFFICIAL CODEX SKILL/);
  assert.match(skillPage, /copyInstallPrompt/);
  assert.match(skillPage, /copyRegistryPrompt/);
  assert.match(skillPage, /copyPublishPrompt/);
  assert.match(skillPage, /navigator\.clipboard\.writeText/);
  assert.match(layout, /lang="zh-CN"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  assert.deepEqual(downloads.sort(), ["codex-pet-club-skill.zip"]);

  for (const name of downloads) {
    const bytes = await readFile(new URL(`../public/downloads/${name}`, import.meta.url));
    assert.equal(bytes.subarray(0, 2).toString("ascii"), "PK", `${name} is not a ZIP archive`);
  }

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
  assert.match(html, /codex-pet-club-skill\.zip/);
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
  assert.match(player, /setInterval/);
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
  const [page, player] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/pet-sprite-player.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /PetSpritePlayer/);
  assert.match(page, /\/api\/pets\/\$\{pet\.id\}\/preview/);
  assert.match(page, /LIVE IDLE/);
  assert.match(page, /setSelectedPet\(pet\)/);
  assert.match(page, /data-testid={`open-pet-/);
  assert.match(page, /data-testid="pet-detail-modal"/);
  assert.match(page, /PET_ACTIONS\.map/);
  assert.match(page, /查看全部动作/);
  assert.match(page, /size="detail"/);
  assert.doesNotMatch(page, /pet\.displayName\.slice\(0, 1\)/);
  assert.match(player, /% 8/);
  assert.match(player, /frame \/ 7/);
  assert.match(player, /row \/ 10/);
  assert.match(player, /"card" \| "admin" \| "detail"/);
});

test("opens moderated uploads while keeping admin APIs authenticated", async () => {
  const [worker, uploadRoute, adminAuth] = await Promise.all([
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pets/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/admin-auth.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(worker, /firstLaunchGuard/);
  assert.match(uploadRoute, /createSubmission/);
  assert.match(uploadRoute, /status: 202/);
  assert.match(adminAuth, /authorization/);
  assert.match(adminAuth, /Bearer/);
});
