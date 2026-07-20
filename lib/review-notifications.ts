import type {
  D1Database,
  D1PreparedStatement,
} from "@cloudflare/workers-types";
import { getPetRegistryBindings } from "./runtime-bindings";

const MAX_AUTOMATIC_ATTEMPTS = 5;
const REVIEW_ACCOUNT_URL = "https://codex-pet-club.renxiangjie.workers.dev/account";
const retryDelaysMs = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 6 * 60 * 60_000];

export type ReviewNotificationAction = "published" | "rejected" | "unpublished";
export type ReviewNotificationStatus = "pending" | "sending" | "sent" | "failed";

type ReviewNotificationRow = {
  id: string;
  submission_id: string;
  user_id: string;
  action: ReviewNotificationAction;
  status: ReviewNotificationStatus;
  attempts: number;
  last_error: string;
  request_id: string | null;
  next_attempt_at: number;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  email: string;
  display_name: string;
  review_note: string;
};

export type ReviewNotification = {
  id: string;
  submissionId: string;
  displayName: string;
  recipient: string;
  action: ReviewNotificationAction;
  status: ReviewNotificationStatus;
  attempts: number;
  lastError: string;
  requestId: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
};

export type ReviewNotificationPage = {
  notifications: ReviewNotification[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  status: ReviewNotificationStatus | null;
};

function bindings() {
  const runtime = getPetRegistryBindings();
  if (!runtime?.DB) throw new Error("Review notification database is unavailable");
  return {
    db: runtime.DB,
    mailServiceUrl: runtime.MAIL_SERVICE_URL?.trim() ?? "",
    mailServiceToken: runtime.MAIL_SERVICE_TOKEN?.trim() ?? "",
  };
}

export async function ensureReviewNotificationSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS review_notifications (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('published', 'rejected', 'unpublished')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NOT NULL DEFAULT '',
      request_id TEXT,
      next_attempt_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sent_at TEXT
    )`),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS review_notifications_retry_idx ON review_notifications(status, next_attempt_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS review_notifications_submission_idx ON review_notifications(submission_id, created_at DESC)",
    ),
  ]);
}

export function reviewNotificationStatement(
  db: D1Database,
  input: {
    submissionId: string;
    userId: string | null;
    action: ReviewNotificationAction;
    createdAt: string;
  },
): D1PreparedStatement | null {
  if (!input.userId) return null;
  const createdAtMs = Date.parse(input.createdAt);
  return db.prepare(
    `INSERT INTO review_notifications (
       id, submission_id, user_id, action, status, attempts, last_error,
       request_id, next_attempt_at, created_at, updated_at, sent_at
     ) VALUES (?, ?, ?, ?, 'pending', 0, '', NULL, ?, ?, ?, NULL)`,
  ).bind(
    crypto.randomUUID(),
    input.submissionId,
    input.userId,
    input.action,
    Number.isFinite(createdAtMs) ? createdAtMs : Date.now(),
    input.createdAt,
    input.createdAt,
  );
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, Math.min(6, local.length - visible.length)))}@${domain}`;
}

function toNotification(row: ReviewNotificationRow): ReviewNotification {
  return {
    id: row.id,
    submissionId: row.submission_id,
    displayName: row.display_name,
    recipient: maskEmail(row.email),
    action: row.action,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    requestId: row.request_id,
    nextAttemptAt: row.status === "sent" ? null : new Date(row.next_attempt_at).toISOString(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at,
  };
}

const deliveryColumns = `
  n.id, n.submission_id, n.user_id, n.action, n.status, n.attempts,
  n.last_error, n.request_id, n.next_attempt_at, n.created_at, n.updated_at,
  n.sent_at, u.email, p.name AS display_name, p.review_note`;

async function notificationRow(db: D1Database, id: string) {
  return db.prepare(
    `SELECT ${deliveryColumns}
     FROM review_notifications n
     JOIN users u ON u.id = n.user_id
     JOIN pet_submissions p ON p.id = n.submission_id
     WHERE n.id = ? LIMIT 1`,
  ).bind(id).first<ReviewNotificationRow>();
}

function safeFailure(error: unknown) {
  if (error instanceof DOMException && error.name === "TimeoutError") return "mail_service_timeout";
  if (error instanceof TypeError) return "mail_service_unavailable";
  return "mail_delivery_failed";
}

function nextRetryAt(attempts: number, retryAfterSeconds?: number) {
  if (retryAfterSeconds && Number.isFinite(retryAfterSeconds)) {
    return Date.now() + Math.max(1, retryAfterSeconds) * 1000;
  }
  const delay = retryDelaysMs[Math.min(Math.max(0, attempts - 1), retryDelaysMs.length - 1)];
  return Date.now() + delay;
}

async function markFailed(
  db: D1Database,
  id: string,
  attempts: number,
  error: string,
  retryAfterSeconds?: number,
) {
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE review_notifications
     SET status = 'failed', last_error = ?, next_attempt_at = ?, updated_at = ?
     WHERE id = ? AND status = 'sending'`,
  ).bind(error.slice(0, 120), nextRetryAt(attempts, retryAfterSeconds), now, id).run();
}

export async function deliverReviewNotification(
  id: string,
  { manual = false }: { manual?: boolean } = {},
): Promise<ReviewNotification | null> {
  const { db, mailServiceUrl, mailServiceToken } = bindings();
  await ensureReviewNotificationSchema(db);
  const before = await notificationRow(db, id);
  if (!before) return null;
  if (before.status === "sent") return toNotification(before);
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const condition = manual
    ? "status IN ('pending', 'failed')"
    : "status IN ('pending', 'failed', 'sending') AND attempts < ? AND next_attempt_at <= ?";
  const statement = db.prepare(
    `UPDATE review_notifications
     SET status = 'sending', attempts = attempts + 1, last_error = '',
         next_attempt_at = ?, updated_at = ?
     WHERE id = ? AND ${condition}`,
  );
  const claim = manual
    ? await statement.bind(nowMs + 10 * 60_000, now, id).run()
    : await statement.bind(
        nowMs + 10 * 60_000,
        now,
        id,
        MAX_AUTOMATIC_ATTEMPTS,
        nowMs,
      ).run();
  if (!claim.meta.changes) return toNotification(before);
  const claimed = await notificationRow(db, id);
  if (!claimed) return null;
  if (!mailServiceUrl || !mailServiceToken) {
    await markFailed(db, id, claimed.attempts, "mail_service_not_configured");
    return toNotification((await notificationRow(db, id)) ?? claimed);
  }
  let endpoint: URL;
  try {
    endpoint = new URL(`${mailServiceUrl.replace(/\/+$/u, "")}/v1/review-result`);
    if (endpoint.protocol !== "https:") throw new Error("invalid protocol");
  } catch {
    await markFailed(db, id, claimed.attempts, "mail_service_not_configured");
    return toNotification((await notificationRow(db, id)) ?? claimed);
  }
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${mailServiceToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: claimed.email,
        petName: claimed.display_name,
        status: claimed.action,
        reviewNote: claimed.review_note,
        accountUrl: REVIEW_ACCOUNT_URL,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const responseBody = await response.json().catch(() => ({})) as { requestId?: string };
    if (response.status !== 202) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "");
      await markFailed(
        db,
        id,
        claimed.attempts,
        response.status === 429 ? "mail_service_rate_limited" : `mail_service_http_${response.status}`,
        Number.isFinite(retryAfter) ? retryAfter : undefined,
      );
    } else {
      const sentAt = new Date().toISOString();
      await db.prepare(
        `UPDATE review_notifications
         SET status = 'sent', last_error = '', request_id = ?, sent_at = ?, updated_at = ?
         WHERE id = ? AND status = 'sending'`,
      ).bind(responseBody.requestId?.slice(0, 80) ?? null, sentAt, sentAt, id).run();
    }
  } catch (error) {
    await markFailed(db, id, claimed.attempts, safeFailure(error));
  }
  return toNotification((await notificationRow(db, id)) ?? claimed);
}

export async function deliverLatestReviewNotification(
  submissionId: string,
  action: ReviewNotificationAction,
) {
  const { db } = bindings();
  await ensureReviewNotificationSchema(db);
  const latest = await db.prepare(
    `SELECT id FROM review_notifications
     WHERE submission_id = ? AND action = ?
     ORDER BY created_at DESC, id DESC LIMIT 1`,
  ).bind(submissionId, action).first<{ id: string }>();
  return latest ? deliverReviewNotification(latest.id) : null;
}

export async function listReviewNotifications({
  status,
  page = 1,
  pageSize = 20,
}: {
  status?: ReviewNotificationStatus;
  page?: number;
  pageSize?: number;
} = {}): Promise<ReviewNotificationPage> {
  const { db } = bindings();
  await ensureReviewNotificationSchema(db);
  const safePage = Math.max(1, Math.floor(Number.isFinite(page) ? page : 1));
  const safePageSize = Math.min(50, Math.max(1, Math.floor(Number.isFinite(pageSize) ? pageSize : 20)));
  const where = status ? "WHERE n.status = ?" : "";
  const values = status ? [status] : [];
  const count = await db.prepare(
    `SELECT COUNT(*) AS count FROM review_notifications n ${where}`,
  ).bind(...values).first<{ count: number }>();
  const total = Number(count?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(safePage, totalPages);
  const result = await db.prepare(
    `SELECT ${deliveryColumns}
     FROM review_notifications n
     JOIN users u ON u.id = n.user_id
     JOIN pet_submissions p ON p.id = n.submission_id
     ${where}
     ORDER BY n.created_at DESC, n.id DESC
     LIMIT ? OFFSET ?`,
  ).bind(...values, safePageSize, (currentPage - 1) * safePageSize).all<ReviewNotificationRow>();
  return {
    notifications: (result.results ?? []).map(toNotification),
    page: currentPage,
    pageSize: safePageSize,
    total,
    totalPages,
    status: status ?? null,
  };
}

export async function retryReviewNotifications(limit = 10) {
  const { db } = bindings();
  await ensureReviewNotificationSchema(db);
  const result = await db.prepare(
    `SELECT id FROM review_notifications
     WHERE status IN ('pending', 'failed', 'sending')
       AND attempts < ? AND next_attempt_at <= ?
     ORDER BY next_attempt_at ASC, created_at ASC
     LIMIT ?`,
  ).bind(MAX_AUTOMATIC_ATTEMPTS, Date.now(), Math.min(25, Math.max(1, limit))).all<{ id: string }>();
  const notifications: ReviewNotification[] = [];
  for (const row of result.results ?? []) {
    const notification = await deliverReviewNotification(row.id);
    if (notification) notifications.push(notification);
  }
  return {
    processed: notifications.length,
    sent: notifications.filter((item) => item.status === "sent").length,
    failed: notifications.filter((item) => item.status === "failed").length,
  };
}
