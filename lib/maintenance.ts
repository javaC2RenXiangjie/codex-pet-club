import type { D1Database } from "@cloudflare/workers-types";
import { createRegistryBackup, verifyRegistryBackup } from "./registry-backup";
import { getPetRegistryBindings } from "./runtime-bindings";
import { ensureUserAuthSchema } from "./user-auth";
import { ensureRegistrySchema } from "./pet-registry";

const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_CODE_RETENTION_MS = DAY_MS;
const EXPIRED_SESSION_RETENTION_MS = 7 * DAY_MS;
const REVOKED_SESSION_RETENTION_MS = 30 * DAY_MS;
const RATE_LIMIT_RETENTION_MS = DAY_MS;

type MaintenanceRow = {
  id: string;
  status: "running" | "succeeded" | "failed";
  started_at: string;
  finished_at: string | null;
  backup_key: string | null;
  deleted_records: number;
  error: string;
};

export type MaintenanceStatus = {
  id: string;
  status: MaintenanceRow["status"];
  startedAt: string;
  finishedAt: string | null;
  backupKey: string | null;
  deletedRecords: number;
  error: string;
};

function database() {
  const db = getPetRegistryBindings()?.DB;
  if (!db) throw new Error("Maintenance database is unavailable");
  return db;
}

export async function ensureMaintenanceSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS maintenance_runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
      started_at TEXT NOT NULL,
      finished_at TEXT,
      backup_key TEXT,
      deleted_records INTEGER NOT NULL DEFAULT 0,
      error TEXT NOT NULL DEFAULT ''
    )`),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS maintenance_runs_started_idx ON maintenance_runs(started_at DESC)",
    ),
  ]);
}

function toStatus(row: MaintenanceRow): MaintenanceStatus {
  return {
    id: row.id,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    backupKey: row.backup_key,
    deletedRecords: row.deleted_records,
    error: row.error,
  };
}

export async function getLatestMaintenanceStatus() {
  const db = database();
  await ensureMaintenanceSchema(db);
  const row = await db.prepare(
    `SELECT id, status, started_at, finished_at, backup_key, deleted_records, error
     FROM maintenance_runs ORDER BY started_at DESC LIMIT 1`,
  ).first<MaintenanceRow>();
  return row ? toStatus(row) : null;
}

export async function cleanupExpiredOperationalData(at = Date.now()) {
  const db = database();
  await ensureUserAuthSchema(db);
  await ensureRegistrySchema(db);
  const revokedCutoff = new Date(at - REVOKED_SESSION_RETENTION_MS).toISOString();
  const results = await db.batch([
    db.prepare("DELETE FROM email_login_codes WHERE expires_at < ?")
      .bind(at - EMAIL_CODE_RETENTION_MS),
    db.prepare(
      "DELETE FROM user_sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)",
    ).bind(at - EXPIRED_SESSION_RETENTION_MS, revokedCutoff),
    db.prepare("DELETE FROM auth_rate_limits WHERE window_start < ?")
      .bind(at - RATE_LIMIT_RETENTION_MS),
    db.prepare("DELETE FROM submission_rate_limits WHERE window_start < ?")
      .bind(at - RATE_LIMIT_RETENTION_MS),
  ]);
  const counts = {
    emailCodes: Number(results[0]?.meta.changes ?? 0),
    sessions: Number(results[1]?.meta.changes ?? 0),
    authRateLimits: Number(results[2]?.meta.changes ?? 0),
    submissionRateLimits: Number(results[3]?.meta.changes ?? 0),
  };
  return {
    ...counts,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
  };
}

function safeMaintenanceError(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 160);
  return "daily_maintenance_failed";
}

export async function runDailyMaintenance(at = Date.now()) {
  const db = database();
  await ensureMaintenanceSchema(db);
  const id = crypto.randomUUID();
  const startedAt = new Date(at).toISOString();
  const runningCutoff = new Date(at - 30 * 60 * 1000).toISOString();
  const claim = await db.prepare(
    `INSERT INTO maintenance_runs (
      id, status, started_at, finished_at, backup_key, deleted_records, error
    ) SELECT ?, 'running', ?, NULL, NULL, 0, ''
      WHERE NOT EXISTS (
        SELECT 1 FROM maintenance_runs
        WHERE status = 'running' AND started_at > ?
      )`,
  ).bind(id, startedAt, runningCutoff).run();
  if (!claim.meta.changes) throw new Error("daily_maintenance_already_running");
  try {
    const backup = await createRegistryBackup(at);
    const verification = await verifyRegistryBackup(backup.key);
    if (!verification.restorable) {
      throw new Error("backup_restore_preflight_failed");
    }
    const cleanup = await cleanupExpiredOperationalData(at);
    const finishedAt = new Date().toISOString();
    await db.prepare(
      `UPDATE maintenance_runs
       SET status = 'succeeded', finished_at = ?, backup_key = ?, deleted_records = ?, error = ''
       WHERE id = ?`,
    ).bind(finishedAt, backup.key, cleanup.total, id).run();
    return {
      status: "succeeded" as const,
      backup,
      verification,
      cleanup,
    };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    await db.prepare(
      `UPDATE maintenance_runs
       SET status = 'failed', finished_at = ?, error = ? WHERE id = ?`,
    ).bind(finishedAt, safeMaintenanceError(error), id).run();
    throw error;
  }
}
