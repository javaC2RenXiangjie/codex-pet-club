import { ensureRegistrySchema, RegistryError } from "./pet-registry";
import { getPetRegistryBindings } from "./runtime-bindings";
import { ensureUserAuthSchema } from "./user-auth";
import { ensureReviewNotificationSchema } from "./review-notifications";

export type RegistryBackup = {
  key: string;
  createdAt: string;
  sizeBytes: number;
  sha256: string;
  submissions: number;
  events: number;
  users: number;
  apiKeys: number;
  notifications: number;
  metadataChanges: number;
};

export type RegistryBackupVerification = {
  key: string;
  verifiedAt: string;
  restorable: boolean;
  sha256: string;
  submissions: number;
  events: number;
  users: number;
  apiKeys: number;
  notifications: number;
  metadataChanges: number;
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
  await ensureUserAuthSchema(db);
  await ensureReviewNotificationSchema(db);
  const [submissionsResult, eventsResult, usersResult, apiKeysResult, notificationsResult, metadataChangesResult] = await Promise.all([
    db.prepare("SELECT * FROM pet_submissions ORDER BY created_at ASC").all(),
    db.prepare("SELECT * FROM moderation_events ORDER BY created_at ASC").all(),
    db.prepare("SELECT * FROM users ORDER BY created_at ASC").all(),
    db.prepare("SELECT * FROM user_api_keys ORDER BY created_at ASC").all(),
    db.prepare("SELECT * FROM review_notifications ORDER BY created_at ASC").all(),
    db.prepare("SELECT * FROM submission_metadata_events ORDER BY created_at ASC").all(),
  ]);
  const submissions = submissionsResult.results ?? [];
  const events = eventsResult.results ?? [];
  const users = usersResult.results ?? [];
  const apiKeys = apiKeysResult.results ?? [];
  const notifications = notificationsResult.results ?? [];
  const metadataChanges = metadataChangesResult.results ?? [];
  const createdAt = new Date(at).toISOString();
  const payload = JSON.stringify(
    {
      schemaVersion: 6,
      createdAt,
      source: "codex-pet-club-db",
      submissions,
      moderationEvents: events,
      users,
      userApiKeys: apiKeys,
      reviewNotifications: notifications,
      submissionMetadataEvents: metadataChanges,
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
      users: String(users.length),
      apiKeys: String(apiKeys.length),
      notifications: String(notifications.length),
      metadataChanges: String(metadataChanges.length),
    },
  });
  return {
    key,
    createdAt,
    sizeBytes: new TextEncoder().encode(payload).byteLength,
    sha256,
    submissions: submissions.length,
    events: events.length,
    users: users.length,
    apiKeys: apiKeys.length,
    notifications: notifications.length,
    metadataChanges: metadataChanges.length,
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
      users: Number(object.customMetadata?.users ?? "0"),
      apiKeys: Number(object.customMetadata?.apiKeys ?? "0"),
      notifications: Number(object.customMetadata?.notifications ?? "0"),
      metadataChanges: Number(object.customMetadata?.metadataChanges ?? "0"),
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
  const users = Array.isArray(payload?.users) ? payload.users : [];
  const apiKeys = Array.isArray(payload?.userApiKeys) ? payload.userApiKeys : [];
  const notifications = Array.isArray(payload?.reviewNotifications) ? payload.reviewNotifications : [];
  const metadataChanges = Array.isArray(payload?.submissionMetadataEvents)
    ? payload.submissionMetadataEvents
    : [];
  const schemaVersion = Number(payload?.schemaVersion ?? 0);
  const schema = Boolean(
    payload
      && [1, 2, 3, 4, 5, 6].includes(schemaVersion)
      && payload.source === "codex-pet-club-db"
      && typeof payload.createdAt === "string"
      && Array.isArray(payload.submissions)
      && Array.isArray(payload.moderationEvents)
      && (schemaVersion === 1 || (Array.isArray(payload.users) && Array.isArray(payload.userApiKeys)))
      && (schemaVersion < 3 || Array.isArray(payload.reviewNotifications))
      && (schemaVersion < 5 || Array.isArray(payload.submissionMetadataEvents)),
  );
  const records = schema
    && hasUniqueStringIds(submissions)
    && hasUniqueStringIds(events)
    && submissions.every(
      (row) => isRecord(row)
        && typeof row.status === "string"
        && typeof row.slug === "string"
        && (schemaVersion < 4 || (
          typeof row.category === "string"
          && typeof row.tags === "string"
        ))
        && (schemaVersion < 6 || (
          typeof row.is_official === "number"
          && typeof row.homepage_featured === "number"
          && typeof row.homepage_priority === "number"
        )),
    )
    && events.every(
      (row) => isRecord(row) && typeof row.action === "string" && typeof row.submission_id === "string",
    )
    && (schemaVersion === 1 || (
      hasUniqueStringIds(users)
      && hasUniqueStringIds(apiKeys)
      && users.every((row) => isRecord(row) && typeof row.email === "string")
      && apiKeys.every((row) => isRecord(row) && typeof row.user_id === "string" && typeof row.key_hash === "string")
    ))
    && (schemaVersion < 3 || (
      hasUniqueStringIds(notifications)
      && notifications.every((row) => (
        isRecord(row)
        && typeof row.submission_id === "string"
        && typeof row.user_id === "string"
        && typeof row.status === "string"
      ))
    ))
    && (schemaVersion < 5 || (
      hasUniqueStringIds(metadataChanges)
      && metadataChanges.every((row) => (
        isRecord(row)
        && typeof row.submission_id === "string"
        && (row.actor_type === "admin" || row.actor_type === "creator")
        && typeof row.before_json === "string"
        && typeof row.after_json === "string"
      ))
    ));
  const expectedSubmissions = Number(object.customMetadata?.submissions ?? "-1");
  const expectedEvents = Number(object.customMetadata?.events ?? "-1");
  const expectedUsers = Number(object.customMetadata?.users ?? (schemaVersion === 1 ? "0" : "-1"));
  const expectedApiKeys = Number(object.customMetadata?.apiKeys ?? (schemaVersion === 1 ? "0" : "-1"));
  const expectedNotifications = Number(object.customMetadata?.notifications ?? (schemaVersion < 3 ? "0" : "-1"));
  const expectedMetadataChanges = Number(object.customMetadata?.metadataChanges ?? (schemaVersion < 5 ? "0" : "-1"));
  const counts = expectedSubmissions === submissions.length
    && expectedEvents === events.length
    && expectedUsers === users.length
    && expectedApiKeys === apiKeys.length
    && expectedNotifications === notifications.length
    && expectedMetadataChanges === metadataChanges.length;
  let databaseReady = false;
  try {
    await ensureRegistrySchema(db);
    await ensureUserAuthSchema(db);
    await ensureReviewNotificationSchema(db);
    const tables = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('pet_submissions', 'moderation_events', 'users', 'user_api_keys', 'review_notifications', 'submission_metadata_events')",
      )
      .first<{ count: number }>();
    databaseReady = Number(tables?.count ?? 0) === 6;
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
    users: users.length,
    apiKeys: apiKeys.length,
    notifications: notifications.length,
    metadataChanges: metadataChanges.length,
    checks,
  };
}
