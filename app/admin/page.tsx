"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PET_ACTIONS,
  PetSpritePlayer,
  type PetActionRow,
} from "../components/pet-sprite-player";

type ReviewStatus = "pending" | "published" | "rejected";

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
  status: "published" | "rejected";
};

const filters: Array<{ value: "all" | ReviewStatus; label: string }> = [
  { value: "pending", label: "待审核" },
  { value: "published", label: "已通过" },
  { value: "rejected", label: "已拒绝" },
  { value: "all", label: "全部" },
];

const statusLabel: Record<ReviewStatus, string> = {
  pending: "待审核",
  published: "已公开",
  rejected: "已拒绝",
};

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

function SpritePreview({ submission }: { submission: Submission }) {
  const [row, setRow] = useState<PetActionRow>(0);
  const action = PET_ACTIONS[row];

  return (
    <div className="admin-sprite-stage" aria-label={`${submission.displayName} 动画图集预览`}>
      <PetSpritePlayer
        name={submission.displayName}
        row={row}
        size="admin"
        src={`/api/admin/pets/${submission.id}/spritesheet`}
      />
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

async function fetchSubmissions() {
  const response = await fetch("/api/admin/pets", {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const data = (await response.json()) as {
    submissions?: Submission[];
    error?: string;
  };
  if (!response.ok) throw new Error(data.error || "审核队列加载失败");
  return Array.isArray(data.submissions) ? data.submissions : [];
}

export default function AdminPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filter, setFilter] = useState<"all" | ReviewStatus>("pending");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [processing, setProcessing] = useState(false);

  async function loadSubmissions() {
    setState("loading");
    try {
      setSubmissions(await fetchSubmissions());
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审核队列加载失败");
      setState("error");
    }
  }

  useEffect(() => {
    let active = true;
    fetchSubmissions()
      .then((items) => {
        if (!active) return;
        setSubmissions(items);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "审核队列加载失败");
        setState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(
    () => ({
      pending: submissions.filter((item) => item.status === "pending").length,
      published: submissions.filter((item) => item.status === "published").length,
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

  async function submitReview() {
    if (!action) return;
    setProcessing(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/pets/${action.submission.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ status: action.status, reviewNote }),
      });
      const data = (await response.json()) as {
        submission?: Submission;
        error?: string;
      };
      if (!response.ok || !data.submission) {
        throw new Error(data.error || "审核操作失败");
      }
      setSubmissions((items) =>
        items.map((item) => (item.id === data.submission?.id ? data.submission : item)),
      );
      setMessage(
        action.status === "published"
          ? `${action.submission.displayName} 已通过并进入公开桌宠库`
          : `${action.submission.displayName} 已拒绝`,
      );
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
          <Link href="/"><span>↗</span>返回网站</Link>
        </nav>

        <div className="admin-sidebar-note">
          <strong>本地管理模式</strong>
          <p>首个公网版本关闭管理路由；审核台仅在本机开发地址可用。</p>
        </div>
      </aside>

      <section className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">CODEX PET CLUB / ADMIN</p>
            <h1>桌宠审核台</h1>
          </div>
          <div className="admin-identity">
            <span>LOCAL</span>
            <div>管</div>
          </div>
        </header>

        <div className="admin-security-banner" role="note">
          <strong>✓ 公网管理入口已关闭</strong>
          <span>当前审核台仅供本机使用；后续接入管理员认证后再对线上开放。</span>
        </div>

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
            <span>已拒绝</span>
            <strong>{counts.rejected.toString().padStart(2, "0")}</strong>
            <small>保留记录</small>
          </article>
        </section>

        <section className="admin-queue" id="queue">
          <div className="admin-queue-heading">
            <div>
              <span>REVIEW QUEUE</span>
              <h2>桌宠投稿</h2>
            </div>
            <button className="admin-refresh" onClick={() => void loadSubmissions()}>
              ↻ 刷新队列
            </button>
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
                <SpritePreview submission={submission} />

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
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      {action && (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
            <button className="admin-modal-close" aria-label="关闭审核窗口" onClick={() => setAction(null)}>×</button>
            <span className={action.status === "published" ? "approve" : "reject"}>
              {action.status === "published" ? "✓" : "×"}
            </span>
            <p>FINAL CHECK</p>
            <h2 id="review-title">
              {action.status === "published" ? "确认通过" : "确认拒绝"}“{action.submission.displayName}”
            </h2>
            <p>
              {action.status === "published"
                ? "通过后，它会立即出现在公开目录中，用户可凭提交 ID 通过 Skill 安装。"
                : "拒绝后，它不会进入公开目录，但会保留提交记录和审核备注。"}
            </p>
            <label htmlFor="review-note">审核备注（可选）</label>
            <textarea
              id="review-note"
              maxLength={500}
              placeholder={action.status === "published" ? "例如：图集、授权与内容检查通过" : "填写拒绝原因，方便后续追踪"}
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
                {processing ? "处理中…" : action.status === "published" ? "确认通过并公开" : "确认拒绝"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
