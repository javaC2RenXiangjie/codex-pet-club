"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const skillRepositoryUrl = "https://github.com/javaC2RenXiangjie/codex-pet-club-skill";

function subscribeToOrigin() {
  return () => {};
}

function getBrowserOrigin() {
  return window.location.origin;
}

function getServerOrigin() {
  return "http://localhost:3001";
}

export default function SkillPage() {
  const [toast, setToast] = useState("");
  const registryOrigin = useSyncExternalStore(subscribeToOrigin, getBrowserOrigin, getServerOrigin);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash(successMessage);
    } catch {
      flash("复制失败，请手动复制页面中的指令");
    }
  }

  function copyInstallPrompt() {
    return copyText(
      `使用 $skill-installer，从这个 GitHub 仓库安装 Skill：\n${skillRepositoryUrl}`,
      "Skill 安装指令已复制",
    );
  }

  function copyRegistryPrompt() {
    return copyText(
      `使用 $codex-pet-club，把桌宠库配置为 ${window.location.origin}`,
      "桌宠库配置指令已复制",
    );
  }

  return (
    <main className="skill-page-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="返回 Codex Pet Club 桌宠库">
          <span className="brand-mark">C:</span>
          <span>
            <strong>Codex Pet Club</strong>
            <small>官方 Skill</small>
          </span>
        </Link>
        <nav aria-label="Skill 页面导航">
          <Link href="/">桌宠库</Link>
          <a href={skillRepositoryUrl} target="_blank" rel="noreferrer">GitHub</a>
          <Link className="nav-submit" href="/">返回桌宠库</Link>
        </nav>
      </header>

      <section className="skill-page-hero">
        <div>
          <span className="section-kicker">OFFICIAL CODEX SKILL</span>
          <h1>安装一次，<br />以后只要说一句话。</h1>
          <p>
            Codex Pet Club Skill 负责按唯一 ID 下载桌宠、验证 v2 图集和校验和、
            备份旧文件，并将桌宠安装到 Codex 的本地列表。
          </p>
          <div className="skill-page-actions">
            <a className="button button--primary" href={skillRepositoryUrl} target="_blank" rel="noreferrer">
              GitHub 获取 Skill <span aria-hidden="true">↗</span>
            </a>
            <button className="text-link" onClick={copyInstallPrompt}>复制安装指令</button>
            <a
              className="text-link"
              download
              href="/downloads/codex-pet-club-skill.zip"
              onClick={() => flash("官方 Skill 开始下载")}
            >
              下载 ZIP
            </a>
          </div>
        </div>

        <div className="skill-terminal" aria-label="Skill 安装指令示例">
          <div className="skill-terminal-bar"><i /><i /><i /><span>CODEX / SKILL INSTALL</span></div>
          <div className="skill-terminal-line"><span>YOU</span><p>从这个 GitHub 仓库安装 Skill</p></div>
          <code>{skillRepositoryUrl}</code>
          <div className="skill-terminal-result">
            <span>✓</span>
            <div><strong>codex-pet-club</strong><small>已安装，可以连接桌宠库</small></div>
          </div>
        </div>
      </section>

      <section className="install-section install-section--standalone">
        <div className="install-heading">
          <div>
            <span className="section-kicker">THREE STEPS</span>
            <h2>从安装到领养，只需三步。</h2>
          </div>
          <p>桌宠文件不会从网页直接下载。Skill 是桌宠获取、校验和安装的唯一通道。</p>
        </div>

        <ol className="install-steps">
          <li><span>01</span><div><strong>安装 Skill</strong><p>让 Codex 使用 Skill Installer 从 GitHub 仓库完成安装。</p></div></li>
          <li><span>02</span><div><strong>连接桌宠库</strong><p>将 Skill 的桌宠库地址配置为当前网站的根地址。</p></div></li>
          <li><span>03</span><div><strong>提供桌宠 ID</strong><p>从桌宠详情复制唯一 ID，告诉 Codex 下载到本地。</p></div></li>
        </ol>
      </section>

      <section className="skill-command-section">
        <div className="skill-command-copy">
          <span className="section-kicker">READY TO USE</span>
          <h2>连接当前桌宠库</h2>
          <p>安装完成后，把下面这句话交给 Codex。之后网站中的所有桌宠都可以通过唯一 ID 安装。</p>
          <button className="button button--dark" onClick={copyRegistryPrompt}>复制配置指令</button>
        </div>
        <div className="skill-command-card">
          <span>YOU → CODEX</span>
          <code>使用 $codex-pet-club，把桌宠库配置为 {registryOrigin}</code>
          <div><strong>接下来：</strong>返回桌宠库，打开桌宠详情并复制唯一 ID。</div>
        </div>
      </section>

      <section className="skill-safety-note">
        <strong>为什么必须通过 Skill？</strong>
        <p>Skill 会验证桌宠清单、图集尺寸和校验和，并在覆盖已有桌宠前自动备份。网站只负责展示，不暴露桌宠包直链。</p>
      </section>

      <footer>
        <Link className="brand brand--footer" href="/">
          <span className="brand-mark">C:</span>
          <span><strong>Codex Pet Club</strong><small>官方 Skill</small></span>
        </Link>
        <p>安装自动化，浏览留给桌宠库。</p>
        <div><Link href="/">返回桌宠库</Link><a href={skillRepositoryUrl} target="_blank" rel="noreferrer">GitHub 源码</a></div>
      </footer>

      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </main>
  );
}
