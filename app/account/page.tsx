"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type AccountUser = {
  id: string;
  email: string;
  displayName: string;
  emailVerifiedAt: string;
};

type ApiKeyItem = {
  id: string;
  name: string;
  prefix: string;
  preview: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type NewKey = {
  token: string;
  prefix: string;
  name: string;
  createdAt: string;
};

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "请求失败，请稍后再试");
  return data;
}

function formatDate(value: string | null) {
  if (!value) return "尚未使用";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [developmentCode, setDevelopmentCode] = useState("");
  const [keyName, setKeyName] = useState("日常使用");
  const [newKey, setNewKey] = useState<NewKey | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const activeKeys = useMemo(
    () => keys.filter((item) => !item.revokedAt),
    [keys],
  );

  async function loadKeys() {
    const data = await jsonRequest<{ keys: ApiKeyItem[] }>("/api/account/keys");
    setKeys(data.keys);
  }

  useEffect(() => {
    let active = true;
    jsonRequest<{ user: AccountUser }>("/api/auth/session")
      .then(async (data) => {
        if (!active) return;
        setUser(data.user);
        await loadKeys();
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const data = await jsonRequest<{ developmentCode?: string }>("/api/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setDevelopmentCode(data.developmentCode ?? "");
      setCodeSent(true);
      setMessage("验证码已发送，请检查邮箱。新用户将在验证后创建账户。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "验证码发送失败");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const data = await jsonRequest<{ user: AccountUser }>("/api/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({ email, code, displayName }),
      });
      setUser(data.user);
      setCode("");
      setDevelopmentCode("");
      setCodeSent(false);
      await loadKeys();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "验证码验证失败");
    } finally {
      setBusy(false);
    }
  }

  async function createKey(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const data = await jsonRequest<{ key: NewKey }>("/api/account/keys", {
        method: "POST",
        body: JSON.stringify({ name: keyName }),
      });
      setNewKey(data.key);
      await loadKeys();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Key 创建失败");
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(item: ApiKeyItem) {
    if (!window.confirm(`确认撤销“${item.name}”？所有使用这个 Key 的电脑都会立即失效。`)) return;
    setBusy(true);
    setMessage("");
    try {
      await jsonRequest<{ ok: true }>(`/api/account/keys/${item.id}`, { method: "DELETE" });
      await loadKeys();
      setMessage(`${item.name} 已撤销`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Key 撤销失败");
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey.token);
      setMessage("Key 已复制。绑定成功后建议关闭这个页面。");
    } catch {
      setMessage("复制失败，请手动复制完整 Key");
    }
  }

  async function copyBindPrompt() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(
        `使用 $codex-pet-club，把我的桌宠库 Key 配置为：${newKey.token}`,
      );
      setMessage("绑定指令已复制，直接发送给 Codex 即可。");
    } catch {
      setMessage("复制失败，请手动复制 Key 并交给 Codex");
    }
  }

  async function logout() {
    await jsonRequest<{ ok: true }>("/api/auth/session", { method: "DELETE" });
    setUser(null);
    setKeys([]);
    setNewKey(null);
    setMessage("");
  }

  return (
    <main className="account-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="返回 Codex Pet Club 桌宠库">
          <span className="brand-mark">C:</span>
          <span><strong>Codex Pet Club</strong><small>创作者账户</small></span>
        </Link>
        <nav aria-label="账户页面导航">
          <Link href="/">桌宠库</Link>
          <Link href="/skill">安装 Skill</Link>
          <Link className="nav-submit" href="/">返回桌宠库</Link>
        </nav>
      </header>

      {loading ? (
        <section className="account-loading">正在读取创作者账户…</section>
      ) : !user ? (
        <section className="account-auth-layout">
          <div className="account-auth-intro">
            <span className="section-kicker">CREATOR IDENTITY</span>
            <h1>让每一只桌宠，<br />都找到它的创作者。</h1>
            <p>使用已验证邮箱创建创作者账户，再生成最多 3 个 Skill Key。Key 可以在一台或多台电脑使用，作品始终归属于你的永久用户 ID。</p>
            <ul>
              <li><strong>01</strong> 邮箱验证码注册或登录</li>
              <li><strong>02</strong> 生成一个 Skill Key</li>
              <li><strong>03</strong> 交给 Codex 完成本地绑定</li>
            </ul>
          </div>
          <div className="account-auth-card">
            <span>{codeSent ? "VERIFY EMAIL" : "EMAIL SIGN IN"}</span>
            <h2>{codeSent ? "输入邮箱验证码" : "注册或登录"}</h2>
            {!codeSent ? (
              <form onSubmit={requestCode}>
                <label htmlFor="display-name">创作者名称（新用户必填）</label>
                <input id="display-name" maxLength={40} onChange={(event) => setDisplayName(event.target.value)} placeholder="已有账户可留空" value={displayName} />
                <label htmlFor="email">邮箱</label>
                <input autoComplete="email" id="email" onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required type="email" value={email} />
                <button disabled={busy} type="submit">{busy ? "发送中…" : "发送验证码"}</button>
              </form>
            ) : (
              <form onSubmit={verifyCode}>
                <p className="account-code-sent">验证码已发送到 <strong>{email}</strong></p>
                {developmentCode && <p className="account-dev-code">本地开发验证码：<strong>{developmentCode}</strong></p>}
                <label htmlFor="code">6 位验证码</label>
                <input autoComplete="one-time-code" id="code" inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/gu, ""))} placeholder="000000" required value={code} />
                <button disabled={busy || code.length !== 6} type="submit">{busy ? "验证中…" : "验证并进入账户"}</button>
                <button className="account-link-button" onClick={() => { setCodeSent(false); setMessage(""); }} type="button">更换邮箱</button>
              </form>
            )}
            {message && <p className="account-message">{message}</p>}
            <small>邮箱仅用于登录、审核结果与必要的服务通知，不会公开展示。</small>
          </div>
        </section>
      ) : (
        <section className="account-dashboard">
          <header className="account-dashboard-heading">
            <div>
              <span className="section-kicker">CREATOR CONSOLE</span>
              <h1>你好，{user.displayName}</h1>
              <p>{user.email} · 邮箱已验证</p>
            </div>
            <button onClick={logout} type="button">退出登录</button>
          </header>

          <div className="account-summary-grid">
            <article><span>永久用户 ID</span><strong title={user.id}>{user.id.slice(0, 8)}…</strong><small>作品只绑定用户 ID</small></article>
            <article><span>有效 Key</span><strong>{activeKeys.length} / 3</strong><small>撤销后立即释放额度</small></article>
            <article><span>投稿身份</span><strong>READY</strong><small>新 Skill 可自动携带</small></article>
          </div>

          <div className="account-key-layout">
            <section className="account-panel">
              <div className="account-panel-heading">
                <div><span>ACCESS KEYS</span><h2>Skill Key</h2></div>
                <small>同一个 Key 可以在多台电脑使用</small>
              </div>
              <form className="account-key-form" onSubmit={createKey}>
                <label htmlFor="key-name">Key 名称</label>
                <div><input disabled={activeKeys.length >= 3} id="key-name" maxLength={40} onChange={(event) => setKeyName(event.target.value)} value={keyName} /><button disabled={busy || activeKeys.length >= 3} type="submit">生成新 Key</button></div>
              </form>
              {activeKeys.length >= 3 && <p className="account-limit-note">已达到 3 个有效 Key 上限，请先撤销不再使用的 Key。</p>}
              <div className="account-key-list">
                {keys.length === 0 ? <p className="account-empty">还没有 Key。生成后即可绑定 Codex Pet Club Skill。</p> : keys.map((item) => (
                  <article className={item.revokedAt ? "revoked" : ""} key={item.id}>
                    <div><strong>{item.name}</strong><code>{item.preview}</code></div>
                    <dl><div><dt>创建</dt><dd>{formatDate(item.createdAt)}</dd></div><div><dt>最近使用</dt><dd>{formatDate(item.lastUsedAt)}</dd></div></dl>
                    {item.revokedAt ? <span>已撤销</span> : <button disabled={busy} onClick={() => revokeKey(item)} type="button">撤销</button>}
                  </article>
                ))}
              </div>
            </section>

            <aside className="account-bind-guide">
              <span>KEY → SKILL</span>
              <h2>绑定到本地 Codex</h2>
              <p>生成 Key 后，对 Codex 说：</p>
              <code>使用 $codex-pet-club，把这个 Key 绑定到本地桌宠库：你的 Key</code>
              <ul><li>Key 可以复用到多台电脑。</li><li>不要把 Key 分享给其他人。</li><li>撤销 Key 后，使用它的所有电脑都会失效。</li></ul>
            </aside>
          </div>
          {message && <p className="account-message account-message--dashboard">{message}</p>}
        </section>
      )}

      {newKey && (
        <div className="account-key-modal" role="dialog" aria-modal="true" aria-label="新 Skill Key">
          <div>
            <span>SHOW ONCE</span>
            <h2>立即保存这个 Key</h2>
            <p>Key 只完整展示一次。关闭后无法再次查看完整内容；如果丢失，请撤销并重新生成。</p>
            <code>{newKey.token}</code>
            <div><button onClick={copyBindPrompt} type="button">复制绑定指令</button><button className="account-link-button" onClick={copyKey} type="button">只复制 Key</button><button className="account-link-button" onClick={() => setNewKey(null)} type="button">我已经保存</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
