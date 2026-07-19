"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PET_ACTIONS,
  PetSpritePlayer,
  type PetActionRow,
} from "../components/pet-sprite-player";

type ReviewStatus = "pending" | "published" | "unpublished" | "rejected";

type Submission = {
  id: string;
  petKey: string;
  displayName: string;
  description: string;
  author: string;
  license: string;
  sha256: string;
  sizeBytes: number;
  updatedAt: string;
  status: ReviewStatus;
  createdAt: string;
  publishedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string;
};

type ReviewAction = {
  submission: Submission;
  status: "published" | "unpublished" | "rejected";
};

type ModerationEvent = {
  id: string;
  submissionId: string;
  petKey: string;
  displayName: string;
  action: "submitted" | "published" | "unpublished" | "rejected";
  note: string;
  createdAt: string;
};

type RegistryBackup = {
  key: string;
  createdAt: string;
  sizeBytes: number;
  sha256: string;
  submissions: number;
  events: number;
};

type BackupVerification = {
  key: string;
  verifiedAt: string;
  restorable: boolean;
  submissions: number;
  events: number;
};

type AuditPage = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type RegistryHealth = {
  checkedAt: string;
  overall: "healthy" | "degraded";
  database: { ok: boolean; latencyMs: number; submissions: number | null };
  storage: { ok: boolean; latencyMs: number; recentBackups: number | null };
  backup: {
    ok: boolean;
    latestAt: string | null;
    ageHours: number | null;
    scheduleUtc: string;
  };
};

type AdminOverview = {
  submissions: Submission[];
  events: ModerationEvent[];
  eventPage: AuditPage;
  backups: RegistryBackup[];
};

const filters: Array<{ value: "all" | ReviewStatus; label: string }> = [
  { value: "pending", label: "待审核" },
  { value: "published", label: "已通过" },
  { value: "unpublished", label: "已下架" },
  { value: "rejected", label: "已拒绝" },
  { value: "all", label: "全部" },
];

const statusLabel: Record<ReviewStatus, string> = {
  pending: "待审核",
  published: "已公开",
  unpublished: "已下架",
  rejected: "已拒绝",
};

const eventLabel: Record<ModerationEvent["action"], string> = {
  submitted: "提交投稿",
  published: "审核通过",
  unpublished: "下架桌宠",
  rejected: "拒绝投稿",
};

const eventFilters: Array<{
  value: "" | ModerationEvent["action"];
  label: string;
}> = [
  { value: "", label: "全部操作" },
  { value: "submitted", label: "提交投稿" },
  { value: "published", label: "审核通过" },
  { value: "unpublished", label: "下架桌宠" },
  { value: "rejected", label: "拒绝投稿" },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 / 1024).toFixed(2)} MiB`;
}

function adminHeaders(token: string, json = false) {
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (json) headers["content-type"] = "application/json";
  return headers;
}

async function apiError(
  response: Response,
  fallback: string,
  knownData?: { error?: string },
) {
  const data = knownData
    ?? ((await response.json().catch(() => ({}))) as { error?: string });
  if (response.status === 401) return "管理员凭证不正确，请重新输入";
  if (response.status === 429) return "操作过于频繁，请稍后再试";
  if (response.status === 503) return "存储服务暂时不可用，请稍后重试";
  return data.error || fallback;
}

function SpritePreview({ submission, token }: { submission: Submission; token: string }) {
  const [row, setRow] = useState<PetActionRow>(0);
  const [spriteUrl, setSpriteUrl] = useState("");
  const action = PET_ACTIONS[row];

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    fetch(`/api/admin/pets/${submission.id}/spritesheet`, {
      headers: adminHeaders(token),
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Sprite returned ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSpriteUrl(objectUrl);
      })
      .catch(() => {
        if (active) setSpriteUrl("");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [submission.id, token]);

  return (
    <div className="admin-sprite-stage" aria-label={`${submission.displayName} 动画图集预览`}>
      {spriteUrl ? (
        <PetSpritePlayer
          name={submission.displayName}
          row={row}
          size="admin"
          src={spriteUrl}
        />
      ) : (
        <div className="admin-sprite-loading">正在读取动画图集…</div>
      )}
      <span className="admin-sprite-meta">正在播放：{action.label}</span>
      <div className="admin-motion-controls" aria-label="选择预览动作">
        {PET_ACTIONS.map((item) => (
          <button
            aria-pressed={row === item.row}
            className={row === item.row ? "active" : ""}
            data-testid={`motion-${submission.id}-${item.id}`}
            key={item.id}
            onClick={() => setRow(item.row)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

async function fetchOverview(token: string): Promise<AdminOverview> {
  const response = await fetch("/api/admin/pets", {
    headers: adminHeaders(token),
    cache: "no-store",
  });
  const data = (await response.json()) as {
    submissions?: Submission[];
    events?: ModerationEvent[];
    eventPage?: AuditPage;
    backups?: RegistryBackup[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(await apiError(response, "审核队列加载失败", data));
  }
  return {
    submissions: Array.isArray(data.submissions) ? data.submissions : [],
    events: Array.isArray(data.events) ? data.events : [],
    eventPage: data.eventPage ?? { page: 1, pageSize: 6, total: 0, totalPages: 1 },
    backups: Array.isArray(data.backups) ? data.backups : [],
  };
}

async function fetchHealth(token: string): Promise<RegistryHealth> {
  const response = await fetch("/api/admin/health", {
    headers: adminHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await apiError(response, "服务状态检查失败"));
  return (await response.json()) as RegistryHealth;
}

async function fetchEvents(
  token: string,
  page: number,
  action: "" | ModerationEvent["action"],
  query: string,
) {
  const params = new URLSearchParams({ page: String(page), pageSize: "6" });
  if (action) params.set("action", action);
  if (query.trim()) params.set("query", query.trim());
  const response = await fetch(`/api/admin/events?${params}`, {
    headers: adminHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await apiError(response, "操作日志加载失败"));
  return (await response.json()) as AuditPage & { events: ModerationEvent[] };
}

export default function AdminPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [events, setEvents] = useState<ModerationEvent[]>([]);
  const [backups, setBackups] = useState<RegistryBackup[]>([]);
  const [eventPage, setEventPage] = useState<AuditPage>({
    page: 1,
    pageSize: 6,
    total: 0,
    totalPages: 1,
  });
  const [eventAction, setEventAction] = useState<"" | ModerationEvent["action"]>("");
  const [eventQuery, setEventQuery] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);
  const [health, setHealth] = useState<RegistryHealth | null>(null);
  const [filter, setFilter] = useState<"all" | ReviewStatus>("pending");
  const [state, setState] = useState<"auth" | "loading" | "ready" | "error">("auth");
  const [adminToken, setAdminToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [message, setMessage] = useState("");
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [verifyingBackup, setVerifyingBackup] = useState(false);
  const [backupVerification, setBackupVerification] = useState<BackupVerification | null>(null);

  function applyOverview(overview: AdminOverview) {
    setSubmissions(overview.submissions);
    setEvents(overview.events);
    setEventPage(overview.eventPage);
    setBackups(overview.backups);
  }

  async function refreshHealth(token = adminToken) {
    try {
      setHealth(await fetchHealth(token));
    } catch {
      setHealth(null);
    }
  }

  async function loadOverview() {
    setState("loading");
    try {
      applyOverview(await fetchOverview(adminToken));
      await refreshHealth(adminToken);
      setState("ready");
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "审核队列加载失败";
      setMessage(nextMessage);
      if (nextMessage === "管理员凭证不正确，请重新输入") {
        setAdminToken("");
        setState("auth");
      } else {
        setState("error");
      }
    }
  }

  useEffect(() => {
    let active = true;
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
    if (!loopback) {
      return () => {
        active = false;
      };
    }
    Promise.all([fetchOverview(""), fetchHealth("")])
      .then(([overview, nextHealth]) => {
        if (!active) return;
        applyOverview(overview);
        setHealth(nextHealth);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        const nextMessage = error instanceof Error ? error.message : "审核队列加载失败";
        setMessage(nextMessage);
        setState(nextMessage === "管理员凭证不正确，请重新输入" ? "auth" : "error");
      });
    return () => {
      active = false;
    };
  }, []);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextToken = tokenInput.trim();
    if (!nextToken) return;
    setState("loading");
    setMessage("");
    try {
      const [overview, nextHealth] = await Promise.all([
        fetchOverview(nextToken),
        fetchHealth(nextToken),
      ]);
      setAdminToken(nextToken);
      setTokenInput("");
      applyOverview(overview);
      setHealth(nextHealth);
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "管理员凭证验证失败");
      setState("auth");
    }
  }

  function signOut() {
    setAdminToken("");
    setSubmissions([]);
    setEvents([]);
    setEventPage({ page: 1, pageSize: 6, total: 0, totalPages: 1 });
    setBackups([]);
    setHealth(null);
    setBackupVerification(null);
    setState("auth");
    setMessage("");
  }

  const counts = useMemo(
    () => ({
      pending: submissions.filter((item) => item.status === "pending").length,
      published: submissions.filter((item) => item.status === "published").length,
      unpublished: submissions.filter((item) => item.status === "unpublished").length,
      rejected: submissions.filter((item) => item.status === "rejected").length,
    }),
    [submissions],
  );

  const visibleSubmissions = useMemo(
    () =>
      filter === "all"
        ? submissions
        : submissions.filter((item) => item.status === filter),
    [filter, submissions],
  );

  function openReview(submission: Submission, status: ReviewAction["status"]) {
    setReviewNote("");
    setAction({ submission, status });
  }

  async function loadEvents(
    page = 1,
    actionFilter = eventAction,
    query = eventQuery,
  ) {
    setEventsLoading(true);
    setMessage("");
    try {
      const result = await fetchEvents(adminToken, page, actionFilter, query);
      setEvents(result.events);
      setEventPage({
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作日志加载失败");
    } finally {
      setEventsLoading(false);
    }
  }

  async function createBackup() {
    setBackingUp(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/backups", {
        method: "POST",
        headers: adminHeaders(adminToken),
      });
      const data = (await response.json()) as {
        backup?: RegistryBackup;
        error?: string;
      };
      if (!response.ok || !data.backup) {
        throw new Error(await apiError(response, "备份创建失败", data));
      }
      setBackups((items) => [data.backup as RegistryBackup, ...items].slice(0, 20));
      setBackupVerification(null);
      await refreshHealth();
      setMessage("D1 元数据备份已写入 R2");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "备份创建失败");
    } finally {
      setBackingUp(false);
    }
  }

  async function verifyBackup() {
    if (!backups[0]) return;
    setVerifyingBackup(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/backups", {
        method: "PATCH",
        headers: adminHeaders(adminToken, true),
        body: JSON.stringify({ key: backups[0].key }),
      });
      const data = (await response.json()) as {
        verification?: BackupVerification;
        error?: string;
      };
      if (!response.ok || !data.verification) {
        throw new Error(await apiError(response, "恢复预检失败", data));
      }
      setBackupVerification(data.verification);
      setMessage(
        data.verification.restorable
          ? "恢复预检通过：备份完整且目标数据表可用"
          : "恢复预检未通过，请暂勿执行数据恢复",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "恢复预检失败");
    } finally {
      setVerifyingBackup(false);
    }
  }

  async function submitReview() {
    if (!action) return;
    setProcessing(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/pets/${action.submission.id}`, {
        method: "PATCH",
        headers: adminHeaders(adminToken, true),
        body: JSON.stringify({ status: action.status, reviewNote }),
      });
      const data = (await response.json()) as {
        submission?: Submission;
        error?: string;
      };
      if (!response.ok || !data.submission) {
        throw new Error(await apiError(response, "审核操作失败", data));
      }
      setSubmissions((items) =>
        items.map((item) => (item.id === data.submission?.id ? data.submission : item)),
      );
      setMessage(
        action.status === "published"
          ? `${action.submission.displayName} 已通过并进入公开桌宠库`
          : action.status === "unpublished"
            ? `${action.submission.displayName} 已从公开桌宠库下架`
            : `${action.submission.displayName} 已拒绝`,
      );
      setEvents((items) => [
        {
          id: `optimistic-${Date.now()}`,
          submissionId: action.submission.id,
          petKey: action.submission.petKey,
          displayName: action.submission.displayName,
          action: action.status,
          note: reviewNote,
          createdAt: new Date().toISOString(),
        },
        ...items,
      ].slice(0, eventPage.pageSize));
      setEventPage((current) => {
        const total = current.total + 1;
        return {
          ...current,
          page: 1,
          total,
          totalPages: Math.max(1, Math.ceil(total / current.pageSize)),
        };
      });
      setAction(null);
      setReviewNote("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审核操作失败");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/" aria-label="返回 Codex Pet Club 首页">
          <span>C:</span>
          <div>
            <strong>Pet Club</strong>
            <small>MODERATION</small>
          </div>
        </Link>

        <nav aria-label="管理导航">
          <a className="active" href="#queue"><span>◉</span>审核队列</a>
          <a href="#operations"><span>↺</span>操作与备份</a>
          <Link href="/"><span>↗</span>返回网站</Link>
        </nav>

        <div className="admin-sidebar-note">
          <strong>安全审核模式</strong>
          <p>管理数据与操作均需要管理员凭证；刷新页面后必须重新输入。</p>
        </div>
      </aside>

      <section className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">CODEX PET CLUB / ADMIN</p>
            <h1>桌宠审核台</h1>
          </div>
          <div className="admin-identity">
            <span>{state === "auth" ? "LOCKED" : "ADMIN"}</span>
            <div>管</div>
          </div>
        </header>

        <div className="admin-security-banner" role="note">
          <strong>✓ 管理接口已保护</strong>
          <span>线上审核台使用单一管理员凭证；首版暂不引入账号和角色系统。</span>
        </div>

        {state === "auth" ? (
          <section className="admin-login" aria-labelledby="admin-login-title">
            <span>PRIVATE WORKSPACE</span>
            <h2 id="admin-login-title">进入桌宠审核台</h2>
            <p>输入部署时配置的管理员凭证。凭证只保存在页面内存，刷新后需要重新输入。</p>
            <form onSubmit={(event) => void signIn(event)}>
              <label htmlFor="admin-token">管理员凭证</label>
              <input
                autoComplete="current-password"
                id="admin-token"
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder="输入管理员凭证"
                type="password"
                value={tokenInput}
              />
              <button disabled={!tokenInput.trim()} type="submit">验证并进入 ↗</button>
            </form>
            {message && <div className="admin-message" role="alert">{message}</div>}
          </section>
        ) : (
          <>

        <section className="admin-stats" aria-label="审核统计">
          <article>
            <span>待审核</span>
            <strong>{counts.pending.toString().padStart(2, "0")}</strong>
            <small>需要处理</small>
          </article>
          <article>
            <span>已公开</span>
            <strong>{counts.published.toString().padStart(2, "0")}</strong>
            <small>网站可见</small>
          </article>
          <article>
            <span>已下架</span>
            <strong>{counts.unpublished.toString().padStart(2, "0")}</strong>
            <small>停止安装</small>
          </article>
          <article>
            <span>已拒绝</span>
            <strong>{counts.rejected.toString().padStart(2, "0")}</strong>
            <small>保留记录</small>
          </article>
        </section>

        <section className="admin-health" aria-label="服务运行状态">
          <div className="admin-health-heading">
            <div>
              <span>SERVICE STATUS</span>
              <h2>服务运行状态</h2>
            </div>
            <button onClick={() => void refreshHealth()} type="button">↻ 重新检查</button>
          </div>
          <div className="admin-health-grid">
            <article className={health?.database.ok ? "healthy" : "degraded"}>
              <span>D1 DATABASE</span>
              <strong>{health?.database.ok ? "正常" : "待检查"}</strong>
              <small>{health?.database.ok ? `${health.database.latencyMs} ms · ${health.database.submissions ?? 0} 条投稿` : "无法确认数据库状态"}</small>
            </article>
            <article className={health?.storage.ok ? "healthy" : "degraded"}>
              <span>R2 STORAGE</span>
              <strong>{health?.storage.ok ? "正常" : "待检查"}</strong>
              <small>{health?.storage.ok ? `${health.storage.latencyMs} ms · ${health.storage.recentBackups ?? 0} 个近期备份` : "无法确认对象存储状态"}</small>
            </article>
            <article className={health?.backup.ok ? "healthy" : "degraded"}>
              <span>DAILY BACKUP</span>
              <strong>{health?.backup.ok ? "按时" : "需关注"}</strong>
              <small>{health?.backup.latestAt ? `最近 ${formatDate(health.backup.latestAt)} · 每日 11:00` : "尚未找到可用备份"}</small>
            </article>
          </div>
        </section>

        <section className="admin-operations" id="operations">
          <article>
            <div className="admin-operations-heading">
              <div><span>BACKUP</span><h2>数据备份</h2></div>
              <div className="admin-operation-buttons">
                <button disabled={!backups[0] || verifyingBackup} onClick={() => void verifyBackup()}>
                  {verifyingBackup ? "预检中…" : "恢复预检"}
                </button>
                <button disabled={backingUp} onClick={() => void createBackup()}>
                  {backingUp ? "备份中…" : "立即备份"}
                </button>
              </div>
            </div>
            {backups[0] ? (
              <dl>
                <div><dt>最近备份</dt><dd>{formatDate(backups[0].createdAt)}</dd></div>
                <div><dt>投稿记录</dt><dd>{backups[0].submissions}</dd></div>
                <div><dt>操作记录</dt><dd>{backups[0].events}</dd></div>
                <div><dt>文件大小</dt><dd>{formatBytes(backups[0].sizeBytes)}</dd></div>
              </dl>
            ) : (
              <p>尚无备份。系统每天 03:00 UTC 自动执行，也可以现在手动创建。</p>
            )}
            {backupVerification && (
              <p className={backupVerification.restorable ? "admin-verify-ok" : "admin-verify-failed"}>
                {backupVerification.restorable ? "✓ 恢复预检通过" : "! 恢复预检未通过"}
                <small>{formatDate(backupVerification.verifiedAt)} · {backupVerification.submissions} 条投稿 · {backupVerification.events} 条操作</small>
              </p>
            )}
          </article>

          <article>
            <div className="admin-operations-heading">
              <div><span>AUDIT LOG</span><h2>最近操作</h2></div>
            </div>
            <form
              className="admin-audit-tools"
              onSubmit={(event) => {
                event.preventDefault();
                void loadEvents(1);
              }}
            >
              <input
                aria-label="搜索操作日志"
                onChange={(event) => setEventQuery(event.target.value)}
                placeholder="名称、标识或备注"
                value={eventQuery}
              />
              <select
                aria-label="筛选操作类型"
                onChange={(event) => {
                  const nextAction = event.target.value as "" | ModerationEvent["action"];
                  setEventAction(nextAction);
                  void loadEvents(1, nextAction, eventQuery);
                }}
                value={eventAction}
              >
                {eventFilters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <button disabled={eventsLoading} type="submit">{eventsLoading ? "查询中" : "查询"}</button>
            </form>
            {eventsLoading ? (
              <p>正在读取操作日志…</p>
            ) : events.length ? (
              <ol className="admin-event-list">
                {events.map((event) => (
                  <li key={event.id}>
                    <span className={`admin-event-dot admin-event-dot--${event.action}`} />
                    <div><strong>{eventLabel[event.action]} · {event.displayName}</strong><small>{event.note || event.petKey}</small></div>
                    <time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <p>当前筛选条件下没有操作记录。</p>
            )}
            <div className="admin-audit-pagination">
              <span>共 {eventPage.total} 条 · 第 {eventPage.page}/{eventPage.totalPages} 页</span>
              <div>
                <button disabled={eventsLoading || eventPage.page <= 1} onClick={() => void loadEvents(eventPage.page - 1)} type="button">上一页</button>
                <button disabled={eventsLoading || eventPage.page >= eventPage.totalPages} onClick={() => void loadEvents(eventPage.page + 1)} type="button">下一页</button>
              </div>
            </div>
          </article>
        </section>

        <section className="admin-queue" id="queue">
          <div className="admin-queue-heading">
            <div>
              <span>REVIEW QUEUE</span>
              <h2>桌宠投稿</h2>
            </div>
            <div className="admin-queue-tools">
              <button className="admin-refresh" onClick={() => void loadOverview()}>
                ↻ 刷新队列
              </button>
              {adminToken && (
                <button className="admin-refresh" onClick={signOut}>退出审核台</button>
              )}
            </div>
          </div>

          <div className="admin-filters" role="group" aria-label="审核状态筛选">
            {filters.map((item) => (
              <button
                className={filter === item.value ? "active" : ""}
                key={item.value}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                {item.value !== "all" && <span>{counts[item.value]}</span>}
              </button>
            ))}
          </div>

          {message && <div className="admin-message" role="status">{message}</div>}

          {state === "loading" && (
            <div className="admin-empty"><span>···</span><p>正在读取审核队列</p></div>
          )}
          {state === "error" && (
            <div className="admin-empty"><span>!</span><p>加载失败，请刷新重试</p></div>
          )}
          {state === "ready" && visibleSubmissions.length === 0 && (
            <div className="admin-empty"><span>✓</span><p>这个分类目前没有桌宠</p></div>
          )}

          <div className="admin-review-list">
            {visibleSubmissions.map((submission) => (
              <article
                className="admin-review-card"
                data-testid={`review-card-${submission.id}`}
                key={submission.id}
              >
                <SpritePreview submission={submission} token={adminToken} />

                <div className="admin-review-content">
                  <div className="admin-review-title">
                    <div>
                      <span className={`admin-status admin-status--${submission.status}`}>
                        {statusLabel[submission.status]}
                      </span>
                      <h3>{submission.displayName}</h3>
                    </div>
                    <time dateTime={submission.createdAt}>{formatDate(submission.createdAt)}</time>
                  </div>

                  <p className="admin-description">
                    {submission.description || "投稿者暂未填写桌宠说明。"}
                  </p>

                  <dl className="admin-metadata">
                    <div><dt>桌宠标识</dt><dd>{submission.petKey}</dd></div>
                    <div><dt>提交 ID</dt><dd>{submission.id}</dd></div>
                    <div><dt>作者</dt><dd>{submission.author || "未填写"}</dd></div>
                    <div><dt>许可证</dt><dd>{submission.license}</dd></div>
                    <div><dt>包大小</dt><dd>{formatBytes(submission.sizeBytes)}</dd></div>
                    <div><dt>SHA-256</dt><dd title={submission.sha256}>{submission.sha256.slice(0, 16)}…</dd></div>
                  </dl>

                  {submission.reviewNote && (
                    <p className="admin-review-note"><strong>审核备注：</strong>{submission.reviewNote}</p>
                  )}

                  {submission.status === "pending" && (
                    <div className="admin-review-actions">
                      <button
                        className="admin-reject"
                        data-testid={`reject-${submission.id}`}
                        onClick={() => openReview(submission, "rejected")}
                      >
                        拒绝投稿
                      </button>
                      <button
                        className="admin-approve"
                        data-testid={`approve-${submission.id}`}
                        onClick={() => openReview(submission, "published")}
                      >
                        通过并公开 ↗
                      </button>
                    </div>
                  )}
                  {submission.status === "published" && (
                    <div className="admin-review-actions">
                      <button
                        className="admin-reject"
                        data-testid={`unpublish-${submission.id}`}
                        onClick={() => openReview(submission, "unpublished")}
                      >
                        下架桌宠
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
          </>
        )}
      </section>

      {action && (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
            <button className="admin-modal-close" aria-label="关闭审核窗口" onClick={() => setAction(null)}>×</button>
            <span className={action.status === "published" ? "approve" : "reject"}>
              {action.status === "published" ? "✓" : action.status === "unpublished" ? "↓" : "×"}
            </span>
            <p>FINAL CHECK</p>
            <h2 id="review-title">
              {action.status === "published" ? "确认通过" : action.status === "unpublished" ? "确认下架" : "确认拒绝"}“{action.submission.displayName}”
            </h2>
            <p>
              {action.status === "published"
                ? "通过后，它会立即出现在公开目录中，用户可凭提交 ID 通过 Skill 安装。"
                : action.status === "unpublished"
                  ? "下架后，它会立即从公开目录消失并停止新的 Skill 安装；包和操作记录仍会保留。"
                  : "拒绝后，它不会进入公开目录，但会保留提交记录和审核备注。"}
            </p>
            <label htmlFor="review-note">审核备注（可选）</label>
            <textarea
              id="review-note"
              maxLength={500}
              placeholder={action.status === "published" ? "例如：图集、授权与内容检查通过" : action.status === "unpublished" ? "填写下架原因，方便后续追踪" : "填写拒绝原因，方便后续追踪"}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
            />
            <div className="admin-modal-actions">
              <button onClick={() => setAction(null)}>取消</button>
              <button
                className={action.status === "published" ? "admin-approve" : "admin-reject-confirm"}
                data-testid="confirm-review"
                disabled={processing}
                onClick={() => void submitReview()}
              >
                {processing ? "处理中…" : action.status === "published" ? "确认通过并公开" : action.status === "unpublished" ? "确认下架" : "确认拒绝"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
