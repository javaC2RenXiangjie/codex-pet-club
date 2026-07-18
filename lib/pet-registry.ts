import { unzipSync } from "fflate";
import { getPetRegistryBindings } from "./runtime-bindings";

const MAX_PACKAGE_BYTES = 32 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 96 * 1024 * 1024;
const EXPECTED_WIDTH = 1536;
const EXPECTED_HEIGHT = 2288;

type PetRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  author: string;
  license: string;
  status: "pending" | "published" | "rejected";
  file_key: string;
  sha256: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type PublicPet = {
  slug: string;
  name: string;
  description: string;
  author: string;
  license: string;
  sha256: string;
  sizeBytes: number;
  updatedAt: string;
};

export class RegistryError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function bindings() {
  const runtime = getPetRegistryBindings();
  if (!runtime.DB || !runtime.PET_FILES) {
    throw new RegistryError(
      "Pet registry storage is unavailable. Configure DB and PET_FILES bindings.",
      503,
    );
  }
  return { db: runtime.DB, files: runtime.PET_FILES };
}

async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS pet_submissions (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      license TEXT NOT NULL DEFAULT 'unspecified',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
      file_key TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT
    )`),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS pet_published_slug_unique ON pet_submissions(slug) WHERE status = 'published'",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS pet_status_updated_idx ON pet_submissions(status, updated_at DESC)",
    ),
  ]);
}

function toPublicPet(row: PetRow): PublicPet {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    author: row.author,
    license: row.license,
    sha256: row.sha256,
    sizeBytes: row.size_bytes,
    updatedAt: row.published_at ?? row.updated_at,
  };
}

export async function listPublishedPets(): Promise<PublicPet[]> {
  const { db } = bindings();
  await ensureSchema(db);
  const result = await db
    .prepare(
      `SELECT id, slug, name, description, author, license, status, file_key,
        sha256, size_bytes, created_at, updated_at, published_at
       FROM pet_submissions
       WHERE status = 'published'
       ORDER BY published_at DESC, updated_at DESC
       LIMIT 100`,
    )
    .all<PetRow>();
  return (result.results ?? []).map(toPublicPet);
}

async function publishedRow(slug: string): Promise<PetRow> {
  const { db } = bindings();
  await ensureSchema(db);
  const row = await db
    .prepare(
      `SELECT id, slug, name, description, author, license, status, file_key,
        sha256, size_bytes, created_at, updated_at, published_at
       FROM pet_submissions
       WHERE slug = ? AND status = 'published'
       LIMIT 1`,
    )
    .bind(slug)
    .first<PetRow>();
  if (!row) {
    throw new RegistryError("Published pet not found", 404);
  }
  return row;
}

export async function getPublishedPet(slug: string) {
  return toPublicPet(await publishedRow(slug));
}

export async function getPublishedPackage(slug: string) {
  const row = await publishedRow(slug);
  const { files } = bindings();
  const object = await files.get(row.file_key);
  if (!object) {
    throw new RegistryError("Published pet package is unavailable", 404);
  }
  return { row, object };
}

function safeSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug || slug.length > 64) {
    throw new RegistryError("Pet slug must contain 1-64 Latin letters, digits, or hyphens");
  }
  return slug;
}

function safeZipName(value: string) {
  const normalized = value.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  if (
    normalized.startsWith("/") ||
    /^[a-zA-Z]:/.test(normalized) ||
    parts.includes("..") ||
    parts.includes(".")
  ) {
    throw new RegistryError(`Unsafe ZIP path: ${value}`);
  }
  return normalized;
}

function readUint24(data: Uint8Array, offset: number) {
  return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
}

function webpDimensions(data: Uint8Array): [number, number] {
  const text = (start: number, end: number) =>
    String.fromCharCode(...data.subarray(start, end));
  if (data.length < 30 || text(0, 4) !== "RIFF" || text(8, 12) !== "WEBP") {
    throw new RegistryError("spritesheet.webp is not a WebP image");
  }
  let offset = 12;
  while (offset + 8 <= data.length) {
    const type = text(offset, offset + 4);
    const size =
      data[offset + 4] |
      (data[offset + 5] << 8) |
      (data[offset + 6] << 16) |
      (data[offset + 7] << 24);
    const payload = offset + 8;
    if (size < 0 || payload + size > data.length) {
      throw new RegistryError("spritesheet.webp contains a truncated chunk");
    }
    if (type === "VP8X" && size >= 10) {
      return [readUint24(data, payload + 4) + 1, readUint24(data, payload + 7) + 1];
    }
    if (type === "VP8L" && size >= 5 && data[payload] === 0x2f) {
      const bits =
        data[payload + 1] |
        (data[payload + 2] << 8) |
        (data[payload + 3] << 16) |
        (data[payload + 4] << 24);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    if (
      type === "VP8 " &&
      size >= 10 &&
      data[payload + 3] === 0x9d &&
      data[payload + 4] === 0x01 &&
      data[payload + 5] === 0x2a
    ) {
      const width = (data[payload + 6] | (data[payload + 7] << 8)) & 0x3fff;
      const height = (data[payload + 8] | (data[payload + 9] << 8)) & 0x3fff;
      return [width, height];
    }
    offset = payload + size + (size % 2);
  }
  throw new RegistryError("Could not read spritesheet.webp dimensions");
}

function decodeManifest(files: Record<string, Uint8Array>) {
  const normalizedFiles: Record<string, Uint8Array> = {};
  for (const [rawName, contents] of Object.entries(files)) {
    const name = safeZipName(rawName);
    if (name.endsWith("/")) continue;
    if (normalizedFiles[name]) {
      throw new RegistryError(`ZIP contains duplicate path: ${name}`);
    }
    normalizedFiles[name] = contents;
  }
  const names = Object.keys(normalizedFiles);
  if (!names.length || names.length > 128) {
    throw new RegistryError("ZIP must contain 1-128 files");
  }
  const total = names.reduce((sum, name) => sum + normalizedFiles[name].byteLength, 0);
  if (total > MAX_UNCOMPRESSED_BYTES) {
    throw new RegistryError("ZIP expands beyond 96 MiB");
  }
  const lower = names.map((name) => name.toLowerCase());
  if (new Set(lower).size !== lower.length) {
    throw new RegistryError("ZIP contains duplicate paths");
  }
  const direct = names.includes("pet.json") && names.includes("spritesheet.webp");
  const top = new Set(names.map((name) => name.split("/")[0]));
  if (!direct && top.size !== 1) {
    throw new RegistryError("ZIP must be flat or contain one top-level pet folder");
  }
  const prefix = direct ? "" : `${[...top][0]}/`;
  const manifestBytes = normalizedFiles[`${prefix}pet.json`];
  const sheet = normalizedFiles[`${prefix}spritesheet.webp`];
  if (!manifestBytes || !sheet) {
    throw new RegistryError("ZIP must contain pet.json and spritesheet.webp");
  }
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch {
    throw new RegistryError("pet.json is not valid JSON");
  }
  if (manifest.spriteVersionNumber !== 2) {
    throw new RegistryError("pet.json must contain spriteVersionNumber: 2");
  }
  const name = typeof manifest.name === "string" ? manifest.name.trim() : "";
  if (!name) {
    throw new RegistryError("pet.json must contain a name");
  }
  const [width, height] = webpDimensions(sheet);
  if (width !== EXPECTED_WIDTH || height !== EXPECTED_HEIGHT) {
    throw new RegistryError(
      `Expected a ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT} atlas, got ${width}x${height}`,
    );
  }
  const slugSource =
    typeof manifest.slug === "string" ? manifest.slug : prefix.replace(/\/$/, "");
  return { manifest, name, slug: safeSlug(slugSource) };
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSubmission(file: File, metadata: Record<string, unknown>) {
  if (file.size <= 0 || file.size > MAX_PACKAGE_BYTES) {
    throw new RegistryError("Package must be a ZIP no larger than 32 MiB");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let extracted: Record<string, Uint8Array>;
  try {
    extracted = unzipSync(bytes);
  } catch {
    throw new RegistryError("Package is not a valid ZIP archive");
  }
  const decoded = decodeManifest(extracted);
  const metadataSlug = typeof metadata.slug === "string" ? safeSlug(metadata.slug) : decoded.slug;
  if (metadataSlug !== decoded.slug) {
    throw new RegistryError("Metadata slug does not match pet.json");
  }
  const sha256 = await sha256Hex(bytes);
  if (typeof metadata.sha256 === "string" && metadata.sha256.toLowerCase() !== sha256) {
    throw new RegistryError("Client checksum does not match uploaded package");
  }
  const id = crypto.randomUUID();
  const fileKey = `pending/${id}.zip`;
  const now = new Date().toISOString();
  const description =
    typeof metadata.description === "string"
      ? metadata.description.trim().slice(0, 500)
      : "";
  const author =
    typeof metadata.author === "string" ? metadata.author.trim().slice(0, 120) : "";
  const license =
    typeof metadata.license === "string"
      ? metadata.license.trim().slice(0, 80) || "unspecified"
      : "unspecified";
  const { db, files } = bindings();
  await ensureSchema(db);
  await files.put(fileKey, bytes, {
    httpMetadata: { contentType: "application/zip" },
    customMetadata: { sha256, slug: decoded.slug, status: "pending" },
  });
  try {
    await db
      .prepare(
        `INSERT INTO pet_submissions (
          id, slug, name, description, author, license, status, file_key,
          sha256, size_bytes, created_at, updated_at, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, NULL)`,
      )
      .bind(
        id,
        decoded.slug,
        decoded.name,
        description,
        author,
        license,
        fileKey,
        sha256,
        bytes.byteLength,
        now,
        now,
      )
      .run();
  } catch (error) {
    await files.delete(fileKey);
    throw error;
  }
  return { id, slug: decoded.slug, status: "pending" as const, sha256 };
}
