import type { D1Database } from "@cloudflare/workers-types";
import { getPetRegistryBindings } from "./runtime-bindings";

const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_CODE_ATTEMPTS = 5;
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT = 5;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE_API_KEYS = 3;
const SESSION_COOKIE = "cpc_session";

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  email_verified_at: string;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
};

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  emailVerifiedAt: string;
  status: "active" | "disabled";
};

export type UserApiKey = {
  id: string;
  name: string;
  prefix: string;
  preview: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export class UserAuthError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export function userAuthErrorResponse(error: unknown) {
  if (error instanceof UserAuthError) {
    return Response.json(
      { error: error.message },
      {
        status: error.status,
        headers: {
          "cache-control": "private, no-store",
          ...error.headers,
        },
      },
    );
  }
  if (error instanceof SyntaxError) {
    return Response.json({ error: "请求内容必须是有效的 JSON" }, { status: 400 });
  }
  console.error(error);
  return Response.json({ error: "账户服务暂时不可用" }, { status: 500 });
}

function isLoopback(request: Request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function bindings(request: Request) {
  const runtime = getPetRegistryBindings();
  if (!runtime?.DB) {
    throw new UserAuthError("Account database is unavailable", 503);
  }
  const configuredSecret = runtime.AUTH_SECRET?.trim() ?? "";
  if (!configuredSecret && !isLoopback(request)) {
    throw new UserAuthError("Account authentication is not configured", 503);
  }
  return {
    db: runtime.DB,
    authSecret: configuredSecret || "local-codex-pet-club-auth-secret",
    mailServiceUrl: runtime.MAIL_SERVICE_URL?.trim() ?? "",
    mailServiceToken: runtime.MAIL_SERVICE_TOKEN?.trim() ?? "",
  };
}

export async function ensureUserAuthSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      email_verified_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS email_login_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      consumed_at TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS email_login_codes_lookup_idx ON email_login_codes(email, created_at DESC)",
    ),
    db.prepare(`CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT NOT NULL,
      revoked_at TEXT
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions(user_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS user_api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      prefix TEXT NOT NULL UNIQUE,
      key_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS user_api_keys_user_idx ON user_api_keys(user_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS auth_rate_limits (
      fingerprint TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    )`),
  ]);
}

function normalizeEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)
  ) {
    throw new UserAuthError("请输入有效的邮箱地址");
  }
  return email;
}

function normalizeDisplayName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length < 1 || name.length > 40) {
    throw new UserAuthError("创作者名称必须为 1-40 个字符");
  }
  return name;
}

function normalizeKeyName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length < 1 || name.length > 40) {
    throw new UserAuthError("Key 名称必须为 1-40 个字符");
  }
  return name;
}

function randomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length));
}

function randomBase64Url(length: number) {
  const bytes = randomBytes(length);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function randomHex(length: number) {
  return [...randomBytes(length)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function randomEmailCode() {
  const number = crypto.getRandomValues(new Uint32Array(1))[0] % 900_000;
  return String(number + 100_000);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function constantEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function toUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    emailVerifiedAt: row.email_verified_at,
    status: row.status,
  };
}

function toApiKey(row: ApiKeyRow): UserApiKey {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    preview: `cpc_sk_${row.prefix}_••••••••`,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, Math.min(6, local.length - visible.length)))}@${domain}`;
}

async function enforceRateLimit(
  db: D1Database,
  fingerprint: string,
  limit: number,
  now: number,
) {
  const cutoff = now - AUTH_RATE_WINDOW_MS;
  const updatedAt = new Date(now).toISOString();
  await db.prepare(
    `INSERT INTO auth_rate_limits (fingerprint, window_start, attempts, updated_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(fingerprint) DO UPDATE SET
       attempts = CASE WHEN auth_rate_limits.window_start <= ? THEN 1 ELSE auth_rate_limits.attempts + 1 END,
       window_start = CASE WHEN auth_rate_limits.window_start <= ? THEN excluded.window_start ELSE auth_rate_limits.window_start END,
       updated_at = excluded.updated_at`,
  ).bind(fingerprint, now, updatedAt, cutoff, cutoff).run();
  const row = await db.prepare(
    "SELECT window_start, attempts FROM auth_rate_limits WHERE fingerprint = ? LIMIT 1",
  ).bind(fingerprint).first<{ window_start: number; attempts: number }>();
  if (row && row.attempts > limit) {
    const retryAfter = Math.max(1, Math.ceil((row.window_start + AUTH_RATE_WINDOW_MS - now) / 1000));
    throw new UserAuthError("操作过于频繁，请稍后再试", 429, { "retry-after": String(retryAfter) });
  }
}

async function sendEmailCode(
  request: Request,
  email: string,
  code: string,
  mailServiceUrl: string,
  mailServiceToken: string,
) {
  if (isLoopback(request)) return { development: true };
  if (!mailServiceUrl || !mailServiceToken) {
    throw new UserAuthError("邮件服务尚未配置", 503);
  }
  let endpoint: URL;
  try {
    endpoint = new URL(`${mailServiceUrl.replace(/\/+$/u, "")}/v1/verification-code`);
  } catch {
    throw new UserAuthError("邮件服务尚未配置", 503);
  }
  if (endpoint.protocol !== "https:") {
    throw new UserAuthError("邮件服务尚未配置", 503);
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${mailServiceToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      code,
      expiresInMinutes: EMAIL_CODE_TTL_MS / 60_000,
    }),
  });
  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after") ?? "60";
    throw new UserAuthError("操作过于频繁，请稍后再试", 429, { "retry-after": retryAfter });
  }
  if (response.status !== 202) {
    console.error("Mail service rejected verification email", response.status);
    throw new UserAuthError("验证码邮件发送失败，请稍后重试", 502);
  }
  return { development: false };
}

export async function requestEmailCode(request: Request, rawEmail: unknown) {
  const email = normalizeEmail(rawEmail);
  const { db, authSecret, mailServiceUrl, mailServiceToken } = bindings(request);
  await ensureUserAuthSchema(db);
  const now = Date.now();
  const ip = request.headers.get("cf-connecting-ip")?.trim() || "local";
  const [ipFingerprint, emailFingerprint] = await Promise.all([
    hmacHex(authSecret, `auth-ip:${ip}`),
    hmacHex(authSecret, `auth-email:${email}`),
  ]);
  await enforceRateLimit(db, ipFingerprint, AUTH_RATE_LIMIT, now);
  await enforceRateLimit(db, emailFingerprint, AUTH_RATE_LIMIT, now);
  const recent = await db.prepare(
    `SELECT created_at FROM email_login_codes
     WHERE email = ? AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
  ).bind(email).first<{ created_at: string }>();
  if (recent && now - Date.parse(recent.created_at) < 60_000) {
    throw new UserAuthError("验证码刚刚已经发送，请一分钟后再试", 429, { "retry-after": "60" });
  }
  const code = randomEmailCode();
  const id = crypto.randomUUID();
  const createdAt = new Date(now).toISOString();
  const codeHash = await hmacHex(authSecret, `${email}:${code}`);
  await db.prepare(
    `INSERT INTO email_login_codes (id, email, code_hash, expires_at, attempts, consumed_at, created_at)
     VALUES (?, ?, ?, ?, 0, NULL, ?)`,
  ).bind(id, email, codeHash, now + EMAIL_CODE_TTL_MS, createdAt).run();
  try {
    const delivery = await sendEmailCode(request, email, code, mailServiceUrl, mailServiceToken);
    return {
      ok: true,
      expiresInSeconds: EMAIL_CODE_TTL_MS / 1000,
      ...(delivery.development ? { developmentCode: code } : {}),
    };
  } catch (error) {
    await db.prepare("DELETE FROM email_login_codes WHERE id = ?").bind(id).run();
    throw error;
  }
}

export async function verifyEmailCode(
  request: Request,
  input: { email?: unknown; code?: unknown; displayName?: unknown },
) {
  const email = normalizeEmail(input.email);
  const code = typeof input.code === "string" ? input.code.trim() : "";
  if (!/^\d{6}$/u.test(code)) throw new UserAuthError("验证码必须是 6 位数字");
  const { db, authSecret } = bindings(request);
  await ensureUserAuthSchema(db);
  const now = Date.now();
  const record = await db.prepare(
    `SELECT id, code_hash, expires_at, attempts FROM email_login_codes
     WHERE email = ? AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
  ).bind(email).first<{ id: string; code_hash: string; expires_at: number; attempts: number }>();
  if (!record || record.expires_at <= now || record.attempts >= EMAIL_CODE_ATTEMPTS) {
    throw new UserAuthError("验证码无效或已经过期", 400);
  }
  const suppliedHash = await hmacHex(authSecret, `${email}:${code}`);
  if (!(await constantEqual(suppliedHash, record.code_hash))) {
    await db.prepare("UPDATE email_login_codes SET attempts = attempts + 1 WHERE id = ?")
      .bind(record.id).run();
    throw new UserAuthError("验证码无效或已经过期", 400);
  }
  const existing = await db.prepare(
    `SELECT id, email, display_name, email_verified_at, status, created_at, updated_at
     FROM users WHERE email = ? LIMIT 1`,
  ).bind(email).first<UserRow>();
  if (existing?.status === "disabled") throw new UserAuthError("该账号已被停用", 403);
  const verifiedAt = new Date(now).toISOString();
  let user = existing;
  if (!user) {
    const displayName = normalizeDisplayName(input.displayName);
    const id = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO users (id, email, display_name, email_verified_at, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    ).bind(id, email, displayName, verifiedAt, verifiedAt, verifiedAt).run();
    user = {
      id,
      email,
      display_name: displayName,
      email_verified_at: verifiedAt,
      status: "active",
      created_at: verifiedAt,
      updated_at: verifiedAt,
    };
  }
  await db.prepare("UPDATE email_login_codes SET consumed_at = ? WHERE id = ?")
    .bind(verifiedAt, record.id).run();
  const sessionToken = `cpc_session_${randomBase64Url(32)}`;
  const sessionHash = await sha256Hex(sessionToken);
  await db.prepare(
    `INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at, last_used_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  ).bind(crypto.randomUUID(), user.id, sessionHash, now + SESSION_TTL_MS, verifiedAt, verifiedAt).run();
  return {
    user: toUser(user),
    cookie: sessionCookie(sessionToken, request, Math.floor(SESSION_TTL_MS / 1000)),
  };
}

function sessionCookie(token: string, request: Request, maxAge: number) {
  const secure = isLoopback(request) ? "" : "; Secure";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const item of cookies.split(";")) {
    const [key, ...parts] = item.trim().split("=");
    if (key === name) return parts.join("=");
  }
  return "";
}

async function userById(db: D1Database, id: string) {
  const row = await db.prepare(
    `SELECT id, email, display_name, email_verified_at, status, created_at, updated_at
     FROM users WHERE id = ? LIMIT 1`,
  ).bind(id).first<UserRow>();
  if (!row || row.status !== "active") throw new UserAuthError("账号不可用", 403);
  return toUser(row);
}

export async function sessionUser(request: Request) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const { db } = bindings(request);
  await ensureUserAuthSchema(db);
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const session = await db.prepare(
    `SELECT id, user_id FROM user_sessions
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ? LIMIT 1`,
  ).bind(tokenHash, now).first<{ id: string; user_id: string }>();
  if (!session) return null;
  await db.prepare("UPDATE user_sessions SET last_used_at = ? WHERE id = ?")
    .bind(new Date(now).toISOString(), session.id).run();
  return userById(db, session.user_id);
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.match(/^Bearer\s+(.+)$/iu)?.[1]?.trim() ?? "";
}

export async function apiKeyUser(request: Request) {
  const token = bearerToken(request);
  const match = token.match(/^cpc_sk_([a-f0-9]{8})_([A-Za-z0-9_-]{32,})$/u);
  if (!match) throw new UserAuthError("有效的桌宠库 Key 是必需的", 401);
  const { db } = bindings(request);
  await ensureUserAuthSchema(db);
  const row = await db.prepare(
    `SELECT id, user_id, key_hash FROM user_api_keys
     WHERE prefix = ? AND revoked_at IS NULL LIMIT 1`,
  ).bind(match[1]).first<{ id: string; user_id: string; key_hash: string }>();
  const suppliedHash = await sha256Hex(token);
  if (!row || !(await constantEqual(suppliedHash, row.key_hash))) {
    throw new UserAuthError("桌宠库 Key 无效或已经撤销", 401);
  }
  await db.prepare("UPDATE user_api_keys SET last_used_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), row.id).run();
  return userById(db, row.user_id);
}

export async function optionalApiKeyUser(request: Request) {
  if (!request.headers.get("authorization")) return null;
  return apiKeyUser(request);
}

export async function requireSessionUser(request: Request) {
  const user = await sessionUser(request);
  if (!user) throw new UserAuthError("请先登录创作者账户", 401);
  return user;
}

export async function currentUser(request: Request) {
  return (await sessionUser(request)) ?? apiKeyUser(request);
}

export async function logoutSession(request: Request) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token) {
    const { db } = bindings(request);
    await ensureUserAuthSchema(db);
    await db.prepare(
      "UPDATE user_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
    ).bind(new Date().toISOString(), await sha256Hex(token)).run();
  }
  return sessionCookie("", request, 0);
}

export async function listUserApiKeys(request: Request, userId: string) {
  const { db } = bindings(request);
  await ensureUserAuthSchema(db);
  const result = await db.prepare(
    `SELECT id, name, prefix, created_at, last_used_at, revoked_at
     FROM user_api_keys WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 50`,
  ).bind(userId).all<ApiKeyRow>();
  return (result.results ?? []).map(toApiKey);
}

export async function createUserApiKey(request: Request, userId: string, rawName: unknown) {
  const name = normalizeKeyName(rawName);
  const { db } = bindings(request);
  await ensureUserAuthSchema(db);
  const prefix = randomHex(4);
  const token = `cpc_sk_${prefix}_${randomBase64Url(32)}`;
  const now = new Date().toISOString();
  const result = await db.prepare(
    `INSERT INTO user_api_keys (id, user_id, name, prefix, key_hash, created_at, last_used_at, revoked_at)
     SELECT ?, ?, ?, ?, ?, ?, NULL, NULL
     WHERE (SELECT COUNT(*) FROM user_api_keys WHERE user_id = ? AND revoked_at IS NULL) < ?`,
  ).bind(
    crypto.randomUUID(), userId, name, prefix, await sha256Hex(token), now,
    userId, MAX_ACTIVE_API_KEYS,
  ).run();
  if (!result.meta.changes) {
    throw new UserAuthError(`每个账号最多只能保留 ${MAX_ACTIVE_API_KEYS} 个有效 Key`, 409);
  }
  return { token, prefix, name, createdAt: now };
}

export async function revokeUserApiKey(request: Request, userId: string, keyId: string) {
  if (!/^[a-f0-9-]{36}$/iu.test(keyId)) throw new UserAuthError("Key ID 无效");
  const { db } = bindings(request);
  await ensureUserAuthSchema(db);
  const result = await db.prepare(
    `UPDATE user_api_keys SET revoked_at = ?
     WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
  ).bind(new Date().toISOString(), keyId, userId).run();
  if (!result.meta.changes) throw new UserAuthError("Key 不存在或已经撤销", 404);
}
