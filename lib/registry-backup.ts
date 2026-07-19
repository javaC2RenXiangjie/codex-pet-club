import { ensureRegistrySchema, RegistryError } from "./pet-registry";
import { getPetRegistryBindings } from "./runtime-bindings";

export type RegistryBackup = {
  key: string;
  createdAt: string;
  sizeBytes: number;
  sha256: string;
  submissions: number;
  events: number;
};

export type RegistryBackupVerification = {
  key: string;
  verifiedAt: string;
  restorable: boolean;
  sha256: string;
  submissions: number;
  events: number;
  checks: {
    checksum: boolean;
    schema: boolean;
    records: boolean;
    counts: boolean;
    databaseReady: boolean;
  };
};

function bindings() {
  const runtime = getPetRegistryBindings();
  if (!runtime?.DB || !runtime.PET_FILES) {
    throw new RegistryError("Registry backup storage is unavailable", 503);
  }
  return { db: runtime.DB, files: runtime.PET_FILES };
}

function fileBinding() {
  const files = getPetRegistryBindings()?.PET_FILES;
  if (!files) {
    throw new RegistryError("Registry backup storage is unavailable", 503);
  }
  return files;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasUniqueStringIds(rows: unknown[]) {
  const ids = rows.map((row) => (isRecord(row) ? row.id : null));
  return ids.every((id): id is string => typeof id === "string" && id.length > 0)
    && new Set(ids).size === ids.length;
}

export async function createRegistryBackup(at = Date.now()): Promise<RegistryBackup> {
  const { db, files } = bindings();
  await ensureRegistrySchema(db);
  const [submissionsResult, eventsResult] = await Promise.all([
    db.prepare("SELECT * FROM pet_submissions ORDER BY created_at ASC").all(),
    db.prepare("SELECT * FROM moderation_events ORDER BY created_at ASC").all(),
  ]);
  const submissions = submissionsResult.results ?? [];
  const events = eventsResult.results ?? [];
  const createdAt = new Date(at).toISOString();
  const payload = JSON.stringify(
    {
      schemaVersion: 1,
      createdAt,
      source: "codex-pet-club-db",
      submissions,
      moderationEvents: events,
    },
    null,
    2,
  );
  const sha256 = await sha256Hex(payload);
  const day = createdAt.slice(0, 10);
  const timestamp = createdAt.replaceAll(":", "-");
  const key = `backups/d1/${day}/${timestamp}.json`;
  await files.put(key, payload, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: {
      sha256,
      createdAt,
      submissions: String(submissions.length),
      events: String(events.length),
    },
  });
  return {
    key,
    createdAt,
    sizeBytes: new TextEncoder().encode(payload).byteLength,
    sha256,
    submissions: submissions.length,
    events: events.length,
  };
}

export async function listRegistryBackups(): Promise<RegistryBackup[]> {
  const files = fileBinding();
  const listed = await files.list({
    prefix: "backups/d1/",
    limit: 1000,
    include: ["customMetadata"],
  });
  return listed.objects
    .map((object) => ({
      key: object.key,
      createdAt:
        object.customMetadata?.createdAt ?? object.uploaded.toISOString(),
      sizeBytes: object.size,
      sha256: object.customMetadata?.sha256 ?? "",
      submissions: Number(object.customMetadata?.submissions ?? "0"),
      events: Number(object.customMetadata?.events ?? "0"),
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 20);
}

export async function verifyRegistryBackup(
  requestedKey?: string,
): Promise<RegistryBackupVerification> {
  const { db, files } = bindings();
  const recent = await listRegistryBackups();
  const key = requestedKey?.trim() || recent[0]?.key;
  if (!key) {
    throw new RegistryError("还没有可以验证的备份", 404);
  }
  if (!/^backups\/d1\/\d{4}-\d{2}-\d{2}\/[\w.:-]+\.json$/.test(key)) {
    throw new RegistryError("备份标识无效", 400);
  }
  const object = await files.get(key);
  if (!object) {
    throw new RegistryError("备份文件不存在", 404);
  }
  const body = await object.text();
  const sha256 = await sha256Hex(body);
  const expectedSha256 = object.customMetadata?.sha256 ?? "";
  let payload: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(body) as unknown;
    payload = isRecord(parsed) ? parsed : null;
  } catch {
    payload = null;
  }
  const submissions = Array.isArray(payload?.submissions) ? payload.submissions : [];
  const events = Array.isArray(payload?.moderationEvents)
    ? payload.moderationEvents
    : [];
  const schema = Boolean(
    payload
      && payload.schemaVersion === 1
      && payload.source === "codex-pet-club-db"
      && typeof payload.createdAt === "string"
      && Array.isArray(payload.submissions)
      && Array.isArray(payload.moderationEvents),
  );
  const records = schema
    && hasUniqueStringIds(submissions)
    && hasUniqueStringIds(events)
    && submissions.every(
      (row) => isRecord(row) && typeof row.status === "string" && typeof row.slug === "string",
    )
    && events.every(
      (row) => isRecord(row) && typeof row.action === "string" && typeof row.submission_id === "string",
    );
  const expectedSubmissions = Number(object.customMetadata?.submissions ?? "-1");
  const expectedEvents = Number(object.customMetadata?.events ?? "-1");
  const counts = expectedSubmissions === submissions.length && expectedEvents === events.length;
  let databaseReady = false;
  try {
    await ensureRegistrySchema(db);
    const tables = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('pet_submissions', 'moderation_events')",
      )
      .first<{ count: number }>();
    databaseReady = Number(tables?.count ?? 0) === 2;
  } catch {
    databaseReady = false;
  }
  const checks = {
    checksum: Boolean(expectedSha256) && sha256 === expectedSha256,
    schema,
    records,
    counts,
    databaseReady,
  };
  return {
    key,
    verifiedAt: new Date().toISOString(),
    restorable: Object.values(checks).every(Boolean),
    sha256,
    submissions: submissions.length,
    events: events.length,
    checks,
  };
}
