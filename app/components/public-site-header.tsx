"use client";

import Link from "next/link";
import { useState } from "react";

export function PublicSiteHeader({ subtitle = "桌宠作品社区" }: { subtitle?: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="site-header public-site-header">
      <Link className="brand" href="/" aria-label="Codex Pet Club 首页" onClick={close}>
        <span className="brand-mark">C:</span>
        <span>
          <strong>Codex Pet Club</strong>
          <small>{subtitle}</small>
        </span>
      </Link>
      <nav aria-label="主导航" className="public-nav">
        <div className="public-nav-links">
          <Link href="/">首页</Link>
          <Link href="/pets">桌宠库</Link>
          <Link href="/skill">安装 Skill</Link>
          <Link href="/account">创作者账户</Link>
          <Link className="nav-submit" href="/skill#publish">分享桌宠 ↗</Link>
        </div>
        <button
          aria-controls="public-mobile-menu"
          aria-expanded={open}
          aria-label={open ? "关闭导航" : "打开导航"}
          className="public-nav-toggle"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <span />
          <span />
        </button>
        <div className={open ? "public-mobile-menu open" : "public-mobile-menu"} id="public-mobile-menu">
          <Link href="/" onClick={close}>首页</Link>
          <Link href="/pets" onClick={close}>桌宠库</Link>
          <Link href="/skill" onClick={close}>安装 Skill</Link>
          <Link href="/account" onClick={close}>创作者账户</Link>
          <Link href="/skill#publish" onClick={close}>分享我的桌宠 ↗</Link>
        </div>
      </nav>
    </header>
  );
}
