import Link from "next/link";

const reportUrl = "https://github.com/javaC2RenXiangjie/codex-pet-club/issues/new";

export function SiteFooter({ note = "给认真工作的人，一点可爱的陪伴。" }) {
  return (
    <footer>
      <Link className="brand brand--footer" href="/">
        <span className="brand-mark">C:</span>
        <span><strong>Codex Pet Club</strong><small>桌宠开源俱乐部</small></span>
      </Link>
      <p>{note}</p>
      <div>
        <Link href="/privacy">隐私说明</Link>
        <Link href="/terms">使用与投稿规则</Link>
        <a href={reportUrl} rel="noreferrer" target="_blank">举报与版权反馈</a>
      </div>
    </footer>
  );
}
