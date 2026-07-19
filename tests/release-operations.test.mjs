import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPetPackage,
  createPublishPlan,
  createStatusPlan,
  validateCatalog,
} from "../scripts/pet-release.mjs";
import { runSmoke } from "../scripts/post-deploy-smoke.mjs";

const catalog = validateCatalog(
  JSON.parse(await readFile(new URL("../registry/catalog.json", import.meta.url), "utf8")),
);

async function builtWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("release-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

function workerEnvironment() {
  return {
    ASSETS: {
      fetch: async (request) => {
        const url = new URL(request.url);
        if (url.pathname.startsWith("/registry/previews/")) {
          return new Response(new Uint8Array([82, 73, 70, 70]), {
            headers: { "content-type": "image/webp" },
          });
        }
        return new Response("Not found", { status: 404 });
      },
    },
    PET_FILES: { get: async () => ({ body: new Uint8Array([80, 75, 3, 4]) }) },
  };
}

const workerContext = {
  waitUntil() {},
  passThroughOnException() {},
};

test("built registry exposes active version metadata and package header", async () => {
  const worker = await builtWorker();
  const listResponse = await worker.fetch(
    new Request("http://localhost/api/pets", { headers: { accept: "application/json" } }),
    workerEnvironment(),
    workerContext,
  );
  assert.equal(listResponse.status, 200);
  const list = await listResponse.json();
  assert.deepEqual(list.pets.map((pet) => pet.version), ["1.0.0", "1.0.0"]);

  const id = "063e4124-91e3-440d-9f3b-40034565a54f";
  const packageResponse = await worker.fetch(
    new Request(`http://localhost/api/pets/${id}/package`, {
      headers: { "x-codex-pet-client": "skill-v1" },
    }),
    workerEnvironment(),
    workerContext,
  );
  assert.equal(packageResponse.status, 200);
  assert.equal(packageResponse.headers.get("x-pet-version"), "1.0.0");

  const previewResponse = await worker.fetch(
    new Request(`http://localhost/api/pets/${id}/preview`),
    workerEnvironment(),
    workerContext,
  );
  assert.equal(previewResponse.status, 200);
  assert.equal(previewResponse.headers.get("content-type"), "image/webp");
});

test("builds a validated release and retains previous versions", async () => {
  const petDirectory = await mkdtemp(path.join(tmpdir(), "codex-pet-release-"));
  try {
    await writeFile(
      path.join(petDirectory, "pet.json"),
      JSON.stringify({
        id: "fengxi-3d",
        displayName: "凤喜 3D",
        description: "release test",
        spriteVersionNumber: 2,
        spritesheetPath: "spritesheet.webp",
      }),
    );
    await writeFile(
      path.join(petDirectory, "spritesheet.webp"),
      await readFile(
        new URL(
          "../public/registry/previews/063e4124-91e3-440d-9f3b-40034565a54f.webp",
          import.meta.url,
        ),
      ),
    );
    const packageInfo = await buildPetPackage(petDirectory);
    const plan = createPublishPlan(
      catalog,
      packageInfo,
      {
        id: "063e4124-91e3-440d-9f3b-40034565a54f",
        version: "1.1.0",
        reason: "Automated release test",
      },
      "2026-07-19T00:00:00.000Z",
    );

    assert.equal(plan.pet.activeVersion, "1.1.0");
    assert.equal(plan.pet.releases.length, 2);
    assert.equal(plan.release.sha256, packageInfo.sha256);
    assert.match(plan.release.packageKey, /packages\/063e4124-91e3-440d-9f3b-40034565a54f\/1\.1\.0\/[a-f0-9]{64}\.zip/);
    assert.equal(plan.release.previewPath, "/registry/previews/063e4124-91e3-440d-9f3b-40034565a54f/1.1.0.webp");
  } finally {
    await rm(petDirectory, { recursive: true, force: true });
  }
});

test("unpublishes without deleting releases and restores an explicit version", () => {
  const id = "063e4124-91e3-440d-9f3b-40034565a54f";
  const hidden = createStatusPlan(
    catalog,
    "unpublish",
    { id, reason: "Rights review" },
    "2026-07-19T01:00:00.000Z",
  );
  assert.equal(hidden.pet.status, "unpublished");
  assert.equal(hidden.pet.releases.length, 1);

  const restored = createStatusPlan(
    hidden.catalog,
    "restore",
    { id, version: "1.0.0", reason: "Review completed" },
    "2026-07-19T02:00:00.000Z",
  );
  assert.equal(restored.pet.status, "published");
  assert.equal(restored.pet.activeVersion, "1.0.0");
  assert.equal(restored.pet.statusHistory.at(-1).reason, "Review completed");
});

test("post-deploy smoke verifies metadata, access guard, preview, and package hash", async () => {
  const packageBytes = Buffer.from("validated package bytes");
  const sha256 = createHash("sha256").update(packageBytes).digest("hex");
  const id = "test-pet-0001";
  const smokeCatalog = {
    schemaVersion: 1,
    pets: [
      {
        id,
        petKey: "test-pet",
        displayName: "Test Pet",
        description: "",
        author: "Tests",
        license: "MIT",
        status: "published",
        activeVersion: "1.2.3",
        releases: [
          {
            version: "1.2.3",
            sha256,
            sizeBytes: packageBytes.length,
            publishedAt: "2026-07-19T00:00:00.000Z",
            packageKey: `packages/${id}/1.2.3/${sha256}.zip`,
            previewPath: `/registry/previews/${id}/1.2.3.webp`,
          },
        ],
        statusHistory: [
          { status: "published", at: "2026-07-19T00:00:00.000Z", reason: "test" },
        ],
      },
    ],
  };
  const publicPet = {
    id,
    petKey: "test-pet",
    displayName: "Test Pet",
    description: "",
    author: "Tests",
    license: "MIT",
    version: "1.2.3",
    sha256,
    sizeBytes: packageBytes.length,
    updatedAt: "2026-07-19T00:00:00.000Z",
  };
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname === "/admin") {
      response.writeHead(200).end();
    } else if (url.pathname === "/api/admin/pets") {
      response.writeHead(401).end();
    } else if (url.pathname === "/api/admin/backups") {
      response.writeHead(401).end();
    } else if (url.pathname === "/api/admin/events") {
      response.writeHead(401).end();
    } else if (url.pathname === "/api/admin/health") {
      response.writeHead(401).end();
    } else if (url.pathname === "/api/pets" && request.method === "POST") {
      response.writeHead(415).end();
    } else if (url.pathname === "/api/pets") {
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ pets: [publicPet] }));
    } else if (url.pathname === `/api/pets/${id}`) {
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ pet: publicPet }));
    } else if (url.pathname === `/api/pets/${id}/preview`) {
      response.writeHead(200, { "content-type": "image/webp" }).end("preview");
    } else if (url.pathname === `/api/pets/${id}/package` && request.headers["x-codex-pet-client"] !== "skill-v1") {
      response.writeHead(403).end();
    } else if (url.pathname === `/api/pets/${id}/package`) {
      response.writeHead(200, {
        "content-type": "application/zip",
        "x-pet-key": "test-pet",
        "x-pet-version": "1.2.3",
      }).end(packageBytes);
    } else {
      response.writeHead(200, { "content-type": "text/html" }).end("ok");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const result = await runSmoke({
      baseUrl: `http://127.0.0.1:${address.port}`,
      catalog: smokeCatalog,
    });
    assert.equal(result.pets[0].sha256, sha256);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
