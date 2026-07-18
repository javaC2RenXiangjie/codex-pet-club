import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
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
  assert.match(html, /领一只会陪你/);
  assert.match(html, /挑一只带走/);
  assert.match(html, /复制唯一 ID/);
  assert.match(html, /SKILL ONLY/);
  assert.match(html, /官方 Skill/);
  assert.match(html, /codex-pet-club-skill\.zip/);
  assert.match(html, /github\.com\/javaC2RenXiangjie\/codex-pet-club-skill/);
  assert.match(html, /分享我的桌宠/);
  assert.doesNotMatch(html, /-source\.zip|拿源文件|直接下载可编辑的源文件/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships only the official Skill and removes direct pet downloads", async () => {
  const [page, layout, packageJson, downloads] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readdir(new URL("../public/downloads/", import.meta.url)),
  ]);

  assert.match(page, /type RegistryPet/);
  assert.match(page, /copyPetCommand/);
  assert.match(page, /UNIQUE PET ID/);
  assert.doesNotMatch(page, /-source\.zip|contributor-template\.zip|拿源文件/);
  assert.match(page, /codex-pet-club-skill\.zip/);
  assert.match(page, /https:\/\/github\.com\/javaC2RenXiangjie\/codex-pet-club-skill/);
  assert.match(page, /id="skill"/);
  assert.match(page, /navigator\.clipboard\.writeText/);
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

test("declares registry storage and exposes the pet API", async () => {
  const [hosting, listRoute, detailRoute, packageRoute] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pets/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pets/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pets/[id]/package/route.ts", import.meta.url), "utf8"),
  ]);

  assert.deepEqual(JSON.parse(hosting), { d1: "DB", r2: "PET_FILES" });
  assert.match(listRoute, /export async function GET/);
  assert.match(listRoute, /export async function POST/);
  assert.match(detailRoute, /getPublishedPet/);
  assert.match(packageRoute, /getPublishedPackage/);
  assert.match(packageRoute, /x-pet-key/);
  assert.match(packageRoute, /x-codex-pet-client/);
});
