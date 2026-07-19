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

function bindings() {
  const runtime = getPetRegistryBindings();
  if (!runtime?.DB || !runtime.PET_FILES) {
    throw new RegistryError("Registry backup storage is unavailable", 503);
  }
  return { db: runtime.DB, files: runtime.PET_FILES };
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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
  const { files } = bindings();
  const listed = await files.list({
    prefix: "backups/d1/",
    limit: 100,
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
