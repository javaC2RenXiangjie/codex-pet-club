#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCatalog } from "./pet-release.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultBaseUrl = "https://codex-pet-club.renxiangjie.workers.dev";
const userAgent = "Codex-Pet-Club-Release-Smoke/1.0";

function fail(message) {
  throw new Error(message);
}

function publishedPets(catalog) {
  return catalog.pets
    .filter((pet) => pet.status === "published")
    .map((pet) => {
      const release = pet.releases.find((candidate) => candidate.version === pet.activeVersion);
      if (!release) fail(`Published pet ${pet.id} has no active release`);
      return { ...pet, release };
    });
}

async function request(baseUrl, pathname, options = {}) {
  return fetch(new URL(pathname, `${baseUrl}/`), {
    ...options,
    headers: {
      "user-agent": userAgent,
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(options.timeout ?? 60_000),
  });
}

async function expectStatus(baseUrl, pathname, status, options) {
  const response = await request(baseUrl, pathname, options);
  if (response.status !== status) {
    const detail = await response.text().catch(() => "");
    fail(`${pathname} returned ${response.status}, expected ${status}: ${detail.slice(0, 300)}`);
  }
  return response;
}

export async function runSmoke({ baseUrl, catalog }) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const expectedPets = publishedPets(validateCatalog(catalog));
  await expectStatus(normalizedBaseUrl, "/", 200);
  await expectStatus(normalizedBaseUrl, "/skill", 200);
  await expectStatus(normalizedBaseUrl, "/admin", 404);
  await expectStatus(normalizedBaseUrl, "/api/pets", 403, { method: "POST" });

  const listResponse = await expectStatus(normalizedBaseUrl, "/api/pets", 200, {
    headers: { accept: "application/json" },
  });
  const list = await listResponse.json();
  if (!Array.isArray(list.pets) || list.pets.length !== expectedPets.length) {
    fail(`/api/pets returned ${list.pets?.length ?? "invalid"} pets, expected ${expectedPets.length}`);
  }

  for (const pet of expectedPets) {
    const listed = list.pets.find((candidate) => candidate.id === pet.id);
    if (!listed) fail(`/api/pets omitted ${pet.id}`);
    if (listed.version !== pet.release.version || listed.sha256 !== pet.release.sha256) {
      fail(`/api/pets returned stale release metadata for ${pet.id}`);
    }
    const detailResponse = await expectStatus(normalizedBaseUrl, `/api/pets/${pet.id}`, 200, {
      headers: { accept: "application/json" },
    });
    const detail = await detailResponse.json();
    if (detail.pet?.version !== pet.release.version || detail.pet?.sha256 !== pet.release.sha256) {
      fail(`/api/pets/${pet.id} returned stale release metadata`);
    }
    const preview = await expectStatus(normalizedBaseUrl, `/api/pets/${pet.id}/preview`, 200);
    if (!/^image\/webp\b/i.test(preview.headers.get("content-type") ?? "")) {
      fail(`/api/pets/${pet.id}/preview did not return image/webp`);
    }
    await preview.body?.cancel();

    await expectStatus(normalizedBaseUrl, `/api/pets/${pet.id}/package`, 403);
    const packageResponse = await expectStatus(normalizedBaseUrl, `/api/pets/${pet.id}/package`, 200, {
      headers: {
        accept: "application/zip",
        "x-codex-pet-client": "skill-v1",
      },
    });
    const packageBytes = Buffer.from(await packageResponse.arrayBuffer());
    const sha256 = createHash("sha256").update(packageBytes).digest("hex");
    if (sha256 !== pet.release.sha256) fail(`Package checksum mismatch for ${pet.id}`);
    if (packageResponse.headers.get("x-pet-key") !== pet.petKey) {
      fail(`Package pet key mismatch for ${pet.id}`);
    }
    if (packageResponse.headers.get("x-pet-version") !== pet.release.version) {
      fail(`Package version header mismatch for ${pet.id}`);
    }
  }

  return {
    baseUrl: normalizedBaseUrl,
    pets: expectedPets.map((pet) => ({
      id: pet.id,
      version: pet.release.version,
      sha256: pet.release.sha256,
    })),
  };
}

async function main() {
  const baseUrlIndex = process.argv.indexOf("--base-url");
  const baseUrl = baseUrlIndex >= 0
    ? process.argv[baseUrlIndex + 1]
    : process.env.CODEX_PET_CLUB_API || defaultBaseUrl;
  if (!baseUrl) fail("--base-url requires a value");
  const catalog = JSON.parse(
    await readFile(path.join(projectRoot, "registry", "catalog.json"), "utf8"),
  );
  const result = await runSmoke({ baseUrl, catalog });
  process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`error: ${error.message}\n`);
    process.exitCode = 1;
  });
}
