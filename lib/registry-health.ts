import { ensureRegistrySchema } from "./pet-registry";
import { listRegistryBackups } from "./registry-backup";
import { getPetRegistryBindings } from "./runtime-bindings";

export type RegistryHealth = {
  checkedAt: string;
  overall: "healthy" | "degraded";
  database: {
    ok: boolean;
    latencyMs: number;
    submissions: number | null;
  };
  storage: {
    ok: boolean;
    latencyMs: number;
    recentBackups: number | null;
  };
  backup: {
    ok: boolean;
    latestAt: string | null;
    ageHours: number | null;
    scheduleUtc: string;
  };
};

export async function getRegistryHealth(): Promise<RegistryHealth> {
  const checkedAt = new Date().toISOString();
  const runtime = getPetRegistryBindings();
  let database = { ok: false, latencyMs: 0, submissions: null as number | null };
  let storage = { ok: false, latencyMs: 0, recentBackups: null as number | null };
  let latestAt: string | null = null;

  const databaseStarted = Date.now();
  try {
    if (!runtime?.DB) throw new Error("D1 binding is unavailable");
    await ensureRegistrySchema(runtime.DB);
    const result = await runtime.DB
      .prepare("SELECT COUNT(*) AS count FROM pet_submissions")
      .first<{ count: number }>();
    database = {
      ok: true,
      latencyMs: Date.now() - databaseStarted,
      submissions: Number(result?.count ?? 0),
    };
  } catch {
    database.latencyMs = Date.now() - databaseStarted;
  }

  const storageStarted = Date.now();
  try {
    if (!runtime?.PET_FILES) throw new Error("R2 binding is unavailable");
    const backups = await listRegistryBackups();
    latestAt = backups[0]?.createdAt ?? null;
    storage = {
      ok: true,
      latencyMs: Date.now() - storageStarted,
      recentBackups: backups.length,
    };
  } catch {
    storage.latencyMs = Date.now() - storageStarted;
  }

  const ageHours = latestAt
    ? Math.max(0, (Date.now() - new Date(latestAt).getTime()) / 3_600_000)
    : null;
  const backupOk = storage.ok && ageHours !== null && ageHours <= 36;
  return {
    checkedAt,
    overall: database.ok && storage.ok && backupOk ? "healthy" : "degraded",
    database,
    storage,
    backup: {
      ok: backupOk,
      latestAt,
      ageHours,
      scheduleUtc: "0 3 * * *",
    },
  };
}
