#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(projectRoot, "registry", "catalog.json");
const previewRoot = path.join(projectRoot, "public", "registry", "previews");
const releaseWorkRoot = path.join(projectRoot, "work", "releases");
const maxPackageBytes = 32 * 1024 * 1024;
const expectedAtlas = [1536, 2288];
const publicIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/;
const petKeyPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const shaPattern = /^[a-f0-9]{64}$/;
const allowedPackageFiles = new Set([
  "pet.json",
  "spritesheet.webp",
  "README.md",
  "LICENSE",
  "LICENSE.md",
  "LICENSE.txt",
  "preview.png",
  "preview.webp",
  "preview.gif",
]);

function fail(message) {
  throw new Error(message);
}

export function parseArguments(argv) {
  const [command, ...tokens] = argv;
  const options = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) fail(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const next = tokens[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return { command, options };
}

function required(options, key) {
  const value = options[key];
  if (typeof value !== "string" || !value.trim()) fail(`Missing required --${key}`);
  return value.trim();
}

function assertSafeRelative(value, prefix, label) {
  if (!value.startsWith(prefix) || value.includes("..") || value.includes("\\")) {
    fail(`${label} must stay under ${prefix}`);
  }
}

export function validateCatalog(catalog) {
  if (!catalog || catalog.schemaVersion !== 1 || !Array.isArray(catalog.pets)) {
    fail("registry/catalog.json must use schemaVersion 1 with a pets array");
  }
  const ids = new Set();
  const petKeys = new Set();
  for (const pet of catalog.pets) {
    if (!publicIdPattern.test(pet.id)) fail(`Invalid catalog id: ${pet.id}`);
    if (!petKeyPattern.test(pet.petKey)) fail(`Invalid petKey: ${pet.petKey}`);
    if (ids.has(pet.id)) fail(`Duplicate catalog id: ${pet.id}`);
    if (petKeys.has(pet.petKey)) fail(`Duplicate petKey: ${pet.petKey}`);
    ids.add(pet.id);
    petKeys.add(pet.petKey);
    if (!pet.displayName || typeof pet.displayName !== "string") fail(`Missing displayName for ${pet.id}`);
    if (!new Set(["published", "unpublished"]).has(pet.status)) {
      fail(`Invalid status for ${pet.id}: ${pet.status}`);
    }
    if (!Array.isArray(pet.releases) || pet.releases.length === 0) {
      fail(`Pet ${pet.id} must retain at least one release`);
    }
    const versions = new Set();
    for (const release of pet.releases) {
      if (!versionPattern.test(release.version)) fail(`Invalid version ${release.version} for ${pet.id}`);
      if (versions.has(release.version)) fail(`Duplicate version ${release.version} for ${pet.id}`);
      versions.add(release.version);
      if (!shaPattern.test(release.sha256)) fail(`Invalid sha256 for ${pet.id}@${release.version}`);
      if (!Number.isInteger(release.sizeBytes) || release.sizeBytes <= 0 || release.sizeBytes > maxPackageBytes) {
        fail(`Invalid package size for ${pet.id}@${release.version}`);
      }
      if (Number.isNaN(Date.parse(release.publishedAt))) {
        fail(`Invalid publishedAt for ${pet.id}@${release.version}`);
      }
      assertSafeRelative(release.packageKey, "packages/", "packageKey");
      assertSafeRelative(release.previewPath, "/registry/previews/", "previewPath");
    }
    if (!versions.has(pet.activeVersion)) {
      fail(`activeVersion ${pet.activeVersion} is missing for ${pet.id}`);
    }
    if (!Array.isArray(pet.statusHistory) || pet.statusHistory.length === 0) {
      fail(`Pet ${pet.id} must retain statusHistory`);
    }
    for (const event of pet.statusHistory) {
      if (!new Set(["published", "unpublished"]).has(event.status)) {
        fail(`Invalid status history entry for ${pet.id}`);
      }
      if (Number.isNaN(Date.parse(event.at)) || typeof event.reason !== "string" || !event.reason.trim()) {
        fail(`Invalid status history metadata for ${pet.id}`);
      }
    }
  }
  return catalog;
}

export function webpDimensions(bytes) {
  if (bytes.length < 30 || bytes.subarray(0, 4).toString("ascii") !== "RIFF" || bytes.subarray(8, 12).toString("ascii") !== "WEBP") {
    fail("spritesheet.webp is not a WebP file");
  }
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunk = bytes.subarray(offset, offset + 4).toString("ascii");
    const size = bytes.readUInt32LE(offset + 4);
    const payload = offset + 8;
    if (payload + size > bytes.length) fail("spritesheet.webp has a truncated chunk");
    if (chunk === "VP8X" && size >= 10) {
      return [1 + bytes.readUIntLE(payload + 4, 3), 1 + bytes.readUIntLE(payload + 7, 3)];
    }
    if (chunk === "VP8L" && size >= 5 && bytes[payload] === 0x2f) {
      const bits = bytes.readUInt32LE(payload + 1);
      return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
    }
    if (chunk === "VP8 " && size >= 10 && bytes.subarray(payload + 3, payload + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
      return [bytes.readUInt16LE(payload + 6) & 0x3fff, bytes.readUInt16LE(payload + 8) & 0x3fff];
    }
    offset = payload + size + (size % 2);
  }
  fail("Could not read WebP dimensions");
}

export async function buildPetPackage(petDirectory) {
  const petPath = path.resolve(petDirectory);
  const petStats = await stat(petPath).catch(() => null);
  if (!petStats?.isDirectory()) fail(`Pet folder not found: ${petPath}`);
  const entries = await readdir(petPath, { withFileTypes: true });
  const files = {};
  for (const entry of entries) {
    if (!entry.isFile() || !allowedPackageFiles.has(entry.name)) continue;
    files[entry.name] = await readFile(path.join(petPath, entry.name));
  }
  if (!files["pet.json"] || !files["spritesheet.webp"]) {
    fail("Pet folder must contain pet.json and spritesheet.webp");
  }
  let manifest;
  try {
    manifest = JSON.parse(files["pet.json"].toString("utf8"));
  } catch (error) {
    fail(`pet.json is invalid JSON: ${error.message}`);
  }
  if (manifest.spriteVersionNumber !== 2) fail("pet.json must contain spriteVersionNumber: 2");
  if (manifest.spritesheetPath !== "spritesheet.webp") {
    fail('pet.json must contain spritesheetPath: "spritesheet.webp"');
  }
  if (!petKeyPattern.test(manifest.id ?? "")) fail("pet.json id must be a lowercase URL-safe pet key");
  if (typeof manifest.displayName !== "string" || !manifest.displayName.trim()) {
    fail("pet.json must contain displayName");
  }
  const dimensions = webpDimensions(files["spritesheet.webp"]);
  if (dimensions[0] !== expectedAtlas[0] || dimensions[1] !== expectedAtlas[1]) {
    fail(`Expected atlas ${expectedAtlas.join("x")}, got ${dimensions.join("x")}`);
  }
  const packageBytes = Buffer.from(zipSync(files, { level: 9 }));
  if (packageBytes.length > maxPackageBytes) fail("Packed pet exceeds 32 MiB");
  return {
    petPath,
    manifest,
    previewBytes: files["spritesheet.webp"],
    packageBytes,
    sha256: createHash("sha256").update(packageBytes).digest("hex"),
    sizeBytes: packageBytes.length,
  };
}

export function createPublishPlan(catalogInput, packageInfo, options, at = new Date().toISOString()) {
  const catalog = structuredClone(validateCatalog(catalogInput));
  const id = required(options, "id");
  const version = required(options, "version");
  if (!publicIdPattern.test(id)) fail("--id must be an 8-64 character public catalog ID");
  if (!versionPattern.test(version)) fail("--version must use semantic versioning such as 1.1.0");
  const petKey = packageInfo.manifest.id;
  let pet = catalog.pets.find((candidate) => candidate.id === id);
  const sameKey = catalog.pets.find((candidate) => candidate.petKey === petKey);
  if (!pet && sameKey) fail(`petKey ${petKey} already belongs to catalog id ${sameKey.id}`);
  if (pet && pet.petKey !== petKey) fail(`Catalog id ${id} belongs to petKey ${pet.petKey}, not ${petKey}`);
  if (pet?.releases.some((release) => release.version === version)) {
    fail(`Version ${version} already exists for ${id}`);
  }
  const release = {
    version,
    sha256: packageInfo.sha256,
    sizeBytes: packageInfo.sizeBytes,
    publishedAt: at,
    packageKey: `packages/${id}/${version}/${packageInfo.sha256}.zip`,
    previewPath: `/registry/previews/${id}/${version}.webp`,
  };
  const description = typeof options.description === "string"
    ? options.description
    : packageInfo.manifest.description ?? pet?.description ?? "";
  const author = typeof options.author === "string"
    ? options.author
    : packageInfo.manifest.author ?? pet?.author ?? "Community";
  const license = typeof options.license === "string"
    ? options.license
    : packageInfo.manifest.license ?? pet?.license ?? "unspecified";
  if (!pet) {
    pet = {
      id,
      petKey,
      displayName: packageInfo.manifest.displayName.trim(),
      description,
      author,
      license,
      status: "published",
      activeVersion: version,
      releases: [release],
      statusHistory: [],
    };
    catalog.pets.push(pet);
  } else {
    pet.displayName = packageInfo.manifest.displayName.trim();
    pet.description = description;
    pet.author = author;
    pet.license = license;
    pet.status = "published";
    pet.activeVersion = version;
    pet.releases.push(release);
  }
  pet.statusHistory.push({
    status: "published",
    at,
    reason: typeof options.reason === "string" ? options.reason : `Published version ${version}`,
  });
  validateCatalog(catalog);
  return { catalog, pet, release };
}

export function createStatusPlan(catalogInput, command, options, at = new Date().toISOString()) {
  const catalog = structuredClone(validateCatalog(catalogInput));
  const id = required(options, "id");
  const reason = required(options, "reason");
  const pet = catalog.pets.find((candidate) => candidate.id === id);
  if (!pet) fail(`Catalog pet not found: ${id}`);
  if (command === "unpublish") {
    if (pet.status === "unpublished") fail(`${id} is already unpublished`);
    pet.status = "unpublished";
  } else if (command === "restore") {
    const version = typeof options.version === "string" ? options.version : pet.activeVersion;
    if (!pet.releases.some((release) => release.version === version)) {
      fail(`Version ${version} does not exist for ${id}`);
    }
    pet.status = "published";
    pet.activeVersion = version;
  } else {
    fail(`Unsupported status command: ${command}`);
  }
  pet.statusHistory.push({ status: pet.status, at, reason });
  validateCatalog(catalog);
  return { catalog, pet };
}

async function readCatalog() {
  return validateCatalog(JSON.parse(await readFile(catalogPath, "utf8")));
}

async function validatePreviewAssets(catalog) {
  let releases = 0;
  for (const pet of catalog.pets) {
    for (const release of pet.releases) {
      const previewPath = resolvedPreviewPath(release.previewPath);
      const bytes = await readFile(previewPath).catch(() => null);
      if (!bytes) fail(`Preview asset is missing for ${pet.id}@${release.version}: ${previewPath}`);
      const dimensions = webpDimensions(bytes);
      if (dimensions[0] !== expectedAtlas[0] || dimensions[1] !== expectedAtlas[1]) {
        fail(`Preview atlas is invalid for ${pet.id}@${release.version}`);
      }
      releases += 1;
    }
  }
  return releases;
}

async function atomicWriteJson(filePath, value) {
  const temporary = `${filePath}.tmp-${randomUUID()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, filePath);
}

function executable(name) {
  return process.platform === "win32" && new Set(["npm", "npx"]).has(name) ? `${name}.cmd` : name;
}

function run(name, args, { capture = false } = {}) {
  const result = spawnSync(executable(name), args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
    windowsHide: true,
  });
  if (result.error) fail(`${name} failed to start: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = capture ? `: ${(result.stderr || result.stdout || "").trim()}` : "";
    fail(`${name} ${args.join(" ")} failed${detail}`);
  }
  return capture ? result.stdout : "";
}

function requireCleanWorktree() {
  const output = run("git", ["status", "--porcelain"], { capture: true }).trim();
  if (output) fail("Release operations require a clean Git worktree");
}

async function writeCatalogMutation(nextCatalog) {
  const original = await readFile(catalogPath);
  await atomicWriteJson(catalogPath, nextCatalog);
  return async () => writeFile(catalogPath, original);
}

function resolvedPreviewPath(previewPath) {
  const relative = previewPath.replace(/^\/registry\/previews\//, "");
  const resolved = path.resolve(previewRoot, relative);
  if (!resolved.startsWith(`${previewRoot}${path.sep}`)) fail("Preview path escaped the preview root");
  return resolved;
}

async function writePublishArtifacts(plan, packageInfo) {
  const packagePath = path.join(
    releaseWorkRoot,
    plan.pet.id,
    plan.release.version,
    `${plan.release.sha256}.zip`,
  );
  const previewPath = resolvedPreviewPath(plan.release.previewPath);
  const previewExisted = await stat(previewPath).then(() => true).catch(() => false);
  if (previewExisted) fail(`Preview already exists: ${previewPath}`);
  await mkdir(path.dirname(packagePath), { recursive: true });
  await mkdir(path.dirname(previewPath), { recursive: true });
  await writeFile(packagePath, packageInfo.packageBytes);
  await copyFile(path.join(packageInfo.petPath, "spritesheet.webp"), previewPath);
  const restoreCatalog = await writeCatalogMutation(plan.catalog);
  return {
    packagePath,
    previewPath,
    restore: async () => {
      await restoreCatalog();
      await rm(previewPath, { force: true });
    },
  };
}

function printPlan(command, result, extra = {}) {
  process.stdout.write(`${JSON.stringify({ command, pet: result.pet, ...extra }, null, 2)}\n`);
}

async function deployCatalog({ upload, restore }) {
  let deployed = false;
  try {
    run("npm", ["test"]);
    if (upload) {
      const bucket = process.env.CODEX_PET_R2_BUCKET || "codex-pet-club-packages";
      run("npx", [
        "wrangler",
        "r2",
        "object",
        "put",
        `${bucket}/${upload.key}`,
        "--file",
        upload.file,
        "--content-type",
        "application/zip",
        "--force",
        "--remote",
      ]);
    }
    run("npm", ["run", "deploy:raw"]);
    deployed = true;
    run("npm", ["run", "smoke"]);
  } catch (error) {
    if (!deployed) await restore();
    if (deployed) {
      error.message += "\nDeployment completed but smoke testing failed; catalog changes were kept for an explicit rollback.";
    }
    throw error;
  }
}

async function commandPublish(options) {
  const catalog = await readCatalog();
  const packageInfo = await buildPetPackage(required(options, "pet"));
  const plan = createPublishPlan(catalog, packageInfo, options);
  if (options["dry-run"] === true) {
    printPlan("publish", plan, { dryRun: true });
    return;
  }
  if (options.deploy !== true) fail("Production publishing requires explicit --deploy; use --dry-run to preview");
  requireCleanWorktree();
  const artifacts = await writePublishArtifacts(plan, packageInfo);
  await deployCatalog({
    upload: { key: plan.release.packageKey, file: artifacts.packagePath },
    restore: artifacts.restore,
  });
  printPlan("publish", plan, { deployed: true, packagePath: artifacts.packagePath });
}

async function commandStatus(command, options) {
  const catalog = await readCatalog();
  const plan = createStatusPlan(catalog, command, options);
  if (options["dry-run"] === true) {
    printPlan(command, plan, { dryRun: true });
    return;
  }
  if (options.deploy !== true) fail(`Production ${command} requires explicit --deploy; use --dry-run to preview`);
  requireCleanWorktree();
  const restore = await writeCatalogMutation(plan.catalog);
  await deployCatalog({ restore });
  printPlan(command, plan, { deployed: true });
}

function usage() {
  return `Usage:
  node scripts/pet-release.mjs validate
  node scripts/pet-release.mjs publish --pet <folder> --id <catalog-id> --version <semver> --dry-run
  node scripts/pet-release.mjs publish --pet <folder> --id <catalog-id> --version <semver> --deploy
  node scripts/pet-release.mjs unpublish --id <catalog-id> --reason <text> --deploy
  node scripts/pet-release.mjs restore --id <catalog-id> [--version <semver>] --reason <text> --deploy
`;
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (command === "validate") {
    const catalog = await readCatalog();
    const releases = await validatePreviewAssets(catalog);
    process.stdout.write(`${JSON.stringify({ valid: true, pets: catalog.pets.length, releases }, null, 2)}\n`);
    return;
  }
  if (command === "publish") return commandPublish(options);
  if (command === "unpublish" || command === "restore") return commandStatus(command, options);
  process.stdout.write(usage());
  if (command) fail(`Unknown command: ${command}`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`error: ${error.message}\n`);
    process.exitCode = 1;
  });
}
