#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCatalog } from "./pet-release.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultBaseUrl = "https://codex-pet-club.cpc-community.workers.dev";
const userAgent = "Codex-Pet-Club-Release-Smoke/1.0";
const retryDelays = [0, 5_000, 10_000, 20_000, 30_000];
const retryableStatuses = new Set([404, 408, 425, 429, 500, 502, 503, 504]);

const powershellRequestScript = String.raw`
$ErrorActionPreference = 'Stop'
$requestHeaders = @{}
$headerJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:CODEX_PET_SMOKE_HEADERS))
$headerObject = ConvertFrom-Json $headerJson
$requestUserAgent = $null
foreach ($property in $headerObject.PSObject.Properties) {
  if ($property.Name -ieq 'user-agent') {
    $requestUserAgent = [string]$property.Value
  } else {
    $requestHeaders[$property.Name] = [string]$property.Value
  }
}
$requestParameters = @{
  UseBasicParsing = $true
  Uri = $env:CODEX_PET_SMOKE_URL
  Method = $env:CODEX_PET_SMOKE_METHOD
  Headers = $requestHeaders
  TimeoutSec = 60
  ErrorAction = 'Stop'
}
if ($requestUserAgent) { $requestParameters.UserAgent = $requestUserAgent }
if ($env:CODEX_PET_SMOKE_HAS_BODY -eq '1') {
  $requestParameters.Body = [Convert]::FromBase64String($env:CODEX_PET_SMOKE_BODY)
}
$responseHeaders = @{}
try {
  $response = Invoke-WebRequest @requestParameters
  $statusCode = [int]$response.StatusCode
  foreach ($key in $response.Headers.Keys) { $responseHeaders[$key] = [string]$response.Headers[$key] }
  if ($response.RawContentStream) {
    if ($response.RawContentStream.CanSeek) { $response.RawContentStream.Position = 0 }
    $memory = New-Object IO.MemoryStream
    $response.RawContentStream.CopyTo($memory)
    $bodyBytes = $memory.ToArray()
  } elseif ($response.Content -is [byte[]]) {
    $bodyBytes = $response.Content
  } else {
    $bodyBytes = [Text.Encoding]::UTF8.GetBytes([string]$response.Content)
  }
} catch {
  $response = $_.Exception.Response
  if (-not $response) { throw }
  $statusCode = [int]$response.StatusCode
  foreach ($key in $response.Headers.Keys) { $responseHeaders[$key] = [string]$response.Headers[$key] }
  $stream = $response.GetResponseStream()
  $memory = New-Object IO.MemoryStream
  if ($stream) { $stream.CopyTo($memory) }
  $bodyBytes = $memory.ToArray()
}
@{
  status = $statusCode
  headers = $responseHeaders
  bodyBase64 = [Convert]::ToBase64String($bodyBytes)
} | ConvertTo-Json -Compress -Depth 5
`;

function fail(message) {
  throw new Error(message);
}

function sleep(delay) {
  return new Promise((resolve) => setTimeout(resolve, delay));
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
  const target = new URL(pathname, `${baseUrl}/`);
  const { timeout = 60_000, ...requestOptions } = options;
  if (process.platform === "win32" && !new Set(["localhost", "127.0.0.1", "::1"]).has(target.hostname)) {
    let requestBody = null;
    if (typeof requestOptions.body === "string") {
      requestBody = Buffer.from(requestOptions.body, "utf8");
    } else if (Buffer.isBuffer(requestOptions.body) || requestOptions.body instanceof Uint8Array) {
      requestBody = Buffer.from(requestOptions.body);
    } else if (requestOptions.body != null) {
      fail(`${pathname} uses an unsupported PowerShell smoke request body`);
    }
    const requestHeaders = Object.fromEntries(
      new Headers({ "user-agent": userAgent, ...(requestOptions.headers ?? {}) }).entries(),
    );
    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", powershellRequestScript],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          CODEX_PET_SMOKE_URL: target.href,
          CODEX_PET_SMOKE_METHOD: requestOptions.method ?? "GET",
          CODEX_PET_SMOKE_HEADERS: Buffer.from(JSON.stringify(requestHeaders)).toString("base64"),
          CODEX_PET_SMOKE_HAS_BODY: requestBody ? "1" : "0",
          CODEX_PET_SMOKE_BODY: requestBody?.toString("base64") ?? "",
        },
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
      },
    );
    if (result.error || result.status !== 0) {
      fail(`${pathname} PowerShell request failed: ${result.error?.message ?? result.stderr.trim()}`);
    }
    const payload = JSON.parse(result.stdout.trim());
    const body = Buffer.from(payload.bodyBase64, "base64");
    return {
      status: payload.status,
      headers: new Headers(payload.headers ?? {}),
      json: async () => JSON.parse(body.toString("utf8")),
      text: async () => body.toString("utf8"),
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
      body: { cancel: async () => {} },
    };
  }
  try {
    return await fetch(target, {
      ...requestOptions,
      headers: {
        "user-agent": userAgent,
        ...(requestOptions.headers ?? {}),
      },
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    const cause = error.cause?.code ? ` (${error.cause.code})` : "";
    fail(`${pathname} request failed${cause}: ${error.cause?.message ?? error.message}`);
  }
}

async function expectStatus(baseUrl, pathname, status, options) {
  let lastError;
  for (const [attempt, delay] of retryDelays.entries()) {
    if (delay > 0) await sleep(delay);
    let response;
    try {
      response = await request(baseUrl, pathname, options);
    } catch (error) {
      lastError = error;
      if (attempt === retryDelays.length - 1) break;
      continue;
    }
    if (response.status === status) return response;
    const detail = await response.text().catch(() => "");
    lastError = new Error(
      `${pathname} returned ${response.status}, expected ${status}: ${detail.slice(0, 300)}`,
    );
    if (!retryableStatuses.has(response.status)) throw lastError;
  }
  throw lastError;
}

export async function runSmoke({ baseUrl, catalog, skillRelease }) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const expectedPets = publishedPets(validateCatalog(catalog));
  await expectStatus(normalizedBaseUrl, "/", 200);
  await expectStatus(normalizedBaseUrl, "/skill", 200);
  await expectStatus(normalizedBaseUrl, "/privacy", 200);
  await expectStatus(normalizedBaseUrl, "/terms", 200);
  let verifiedSkillVersion = null;
  if (skillRelease) {
    const manifestResponse = await expectStatus(normalizedBaseUrl, "/api/skill/version", 200, {
      headers: { accept: "application/json" },
    });
    if (!/\bno-store\b/i.test(manifestResponse.headers.get("cache-control") ?? "")) {
      fail("/api/skill/version must not cache a mutable release manifest");
    }
    const liveRelease = await manifestResponse.json();
    for (const field of ["schemaVersion", "version", "archiveUrl", "sha256", "sizeBytes", "publishedAt"]) {
      if (liveRelease[field] !== skillRelease[field]) {
        fail(`/api/skill/version returned stale ${field}`);
      }
    }
    const releaseResponse = await expectStatus(normalizedBaseUrl, liveRelease.archiveUrl, 200, {
      headers: { accept: "application/zip, application/octet-stream" },
    });
    const releaseBytes = Buffer.from(await releaseResponse.arrayBuffer());
    if (releaseBytes.length !== liveRelease.sizeBytes) {
      fail("Skill release size does not match /api/skill/version");
    }
    const releaseSha256 = createHash("sha256").update(releaseBytes).digest("hex");
    if (releaseSha256 !== liveRelease.sha256) {
      fail("Skill release checksum does not match /api/skill/version");
    }
    verifiedSkillVersion = liveRelease.version;
  }
  await expectStatus(normalizedBaseUrl, "/admin", 200);
  await expectStatus(normalizedBaseUrl, "/api/admin/pets", 401);
  await expectStatus(
    normalizedBaseUrl,
    "/api/admin/pets/00000000-0000-4000-8000-000000000000/metadata",
    401,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ metadata: {} }),
    },
  );
  await expectStatus(normalizedBaseUrl, "/api/admin/backups", 401);
  await expectStatus(normalizedBaseUrl, "/api/admin/events", 401);
  await expectStatus(normalizedBaseUrl, "/api/admin/health", 401);
  await expectStatus(normalizedBaseUrl, "/api/admin/notifications", 401);
  await expectStatus(normalizedBaseUrl, "/api/admin/maintenance", 401, { method: "POST" });
  await expectStatus(normalizedBaseUrl, "/api/me/submissions", 401);
  await expectStatus(
    normalizedBaseUrl,
    "/api/submissions/00000000-0000-4000-8000-000000000000",
    401,
  );
  await expectStatus(
    normalizedBaseUrl,
    "/api/submissions/00000000-0000-4000-8000-000000000000",
    401,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ metadata: {} }),
    },
  );
  await expectStatus(normalizedBaseUrl, "/api/pets", 415, { method: "POST" });
  await expectStatus(normalizedBaseUrl, "/api/pets", 401, {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=smoke" },
    body: "--smoke--\r\n",
  });

  const listResponse = await expectStatus(normalizedBaseUrl, "/api/pets?pageSize=48&sort=newest", 200, {
    headers: { accept: "application/json" },
  });
  const list = await listResponse.json();
  if (!Array.isArray(list.pets) || list.pets.length < expectedPets.length) {
    fail(`/api/pets returned ${list.pets?.length ?? "invalid"} pets, expected at least ${expectedPets.length}`);
  }
  const listedIds = new Set(list.pets.map((pet) => pet.id));
  if (listedIds.size !== list.pets.length) {
    fail("/api/pets returned duplicate pet IDs");
  }
  if (
    !Number.isInteger(list.total)
    || !Number.isInteger(list.totalPages)
    || !Array.isArray(list.categories)
    || !Array.isArray(list.tags)
  ) {
    fail("/api/pets omitted catalog pagination or discovery metadata");
  }

  const creatorPet = list.pets.find((pet) => typeof pet.creatorId === "string" && pet.creatorId);
  if (creatorPet) {
    const creatorResponse = await expectStatus(
      normalizedBaseUrl,
      `/api/creators/${creatorPet.creatorId}`,
      200,
      { headers: { accept: "application/json" } },
    );
    const creatorPayload = await creatorResponse.json();
    const serializedCreator = JSON.stringify(creatorPayload);
    if (/email|api.?key|credential/i.test(serializedCreator)) {
      fail(`/api/creators/${creatorPet.creatorId} exposed private account fields`);
    }
    if (
      creatorPayload.creator?.id !== creatorPet.creatorId
      || !Array.isArray(creatorPayload.creator?.pets)
      || !creatorPayload.creator.pets.some((pet) => pet.id === creatorPet.id)
    ) {
      fail(`/api/creators/${creatorPet.creatorId} returned inconsistent published work`);
    }
    const creatorPage = await expectStatus(normalizedBaseUrl, `/creators/${creatorPet.creatorId}`, 200);
    if (!(await creatorPage.text()).includes(creatorPayload.creator.displayName)) {
      fail(`/creators/${creatorPet.creatorId} did not render the creator profile`);
    }
  }

  for (const pet of expectedPets) {
    const listed = list.pets.find((candidate) => candidate.id === pet.id);
    if (!listed) fail(`/api/pets omitted ${pet.id}`);
    if (listed.version !== pet.release.version || listed.sha256 !== pet.release.sha256) {
      fail(`/api/pets returned stale release metadata for ${pet.id}`);
    }
    if (typeof listed.category !== "string" || !Array.isArray(listed.tags)) {
      fail(`/api/pets returned invalid taxonomy metadata for ${pet.id}`);
    }
    const detailResponse = await expectStatus(normalizedBaseUrl, `/api/pets/${pet.id}`, 200, {
      headers: { accept: "application/json" },
    });
    const detail = await detailResponse.json();
    if (detail.pet?.version !== pet.release.version || detail.pet?.sha256 !== pet.release.sha256) {
      fail(`/api/pets/${pet.id} returned stale release metadata`);
    }
    const publicPage = await expectStatus(normalizedBaseUrl, `/pets/${pet.id}`, 200);
    if (!(await publicPage.text()).includes(pet.displayName)) {
      fail(`/pets/${pet.id} did not render the pet detail`);
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
    skillVersion: verifiedSkillVersion,
    livePets: list.pets.length,
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
  const [catalog, skillRelease] = await Promise.all([
    readFile(path.join(projectRoot, "registry", "catalog.json"), "utf8").then(JSON.parse),
    readFile(path.join(projectRoot, "registry", "skill-release.json"), "utf8").then(JSON.parse),
  ]);
  const result = await runSmoke({ baseUrl, catalog, skillRelease });
  process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`error: ${error.message}\n`);
    process.exitCode = 1;
  });
}
