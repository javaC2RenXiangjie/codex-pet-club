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
  assert.match(html, /像素柯基/);
  assert.match(html, /云朵水獭/);
  assert.match(html, /分享我的桌宠/);
  assert.match(html, /\/downloads\/pixel-corgi-source\.zip/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships editable pet source kits and removes starter-only code", async () => {
  const [page, layout, packageJson, downloads] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readdir(new URL("../public/downloads/", import.meta.url)),
  ]);

  assert.match(page, /const categories: Category\[\]/);
  assert.match(page, /\/downloads\/\$\{pet\.slug\}-source\.zip/);
  assert.match(page, /contributor-template\.zip/);
  assert.match(page, /navigator\.clipboard\.writeText/);
  assert.match(layout, /lang="zh-CN"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  assert.deepEqual(downloads.sort(), [
    "cloud-otter-source.zip",
    "code-ghost-source.zip",
    "contributor-template.zip",
    "mecha-dragon-source.zip",
    "neon-black-cat-source.zip",
    "pixel-corgi-source.zip",
    "retro-tv-source.zip",
  ]);

  for (const name of downloads) {
    const bytes = await readFile(new URL(`../public/downloads/${name}`, import.meta.url));
    assert.equal(bytes.subarray(0, 2).toString("ascii"), "PK", `${name} is not a ZIP archive`);
  }

  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
  await assert.rejects(access(new URL("public/_sites-preview", projectRoot)));
});
