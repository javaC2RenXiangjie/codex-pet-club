import Link from "next/link";
import { SiteFooter } from "../components/site-footer";

export const metadata = {
  title: "使用与投稿规则 · Codex Pet Club",
  description: "Codex Pet Club 的使用、投稿、审核和版权处理规则。",
};

export default function TermsPage() {
  return (
    <main className="policy-shell">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark">C:</span>
          <span><strong>Codex Pet Club</strong><small>使用与投稿规则</small></span>
        </Link>
        <nav aria-label="投稿规则页面导航"><Link href="/">桌宠库</Link><Link href="/privacy">隐私说明</Link></nav>
      </header>
      <article className="policy-document">
        <header><span>TERMS / 2026-07-20</span><h1>使用与投稿规则</h1><p>这里是一座由创作者共同维护的 Codex 桌宠库。投稿意味着你理解并同意以下规则。</p></header>
        <section><h2>投稿者的确认</h2><ul><li>你拥有作品，或已获得足够授权，可以按投稿时填写的许可证公开分享。</li><li>作品不得侵犯他人的著作权、商标权、肖像权、隐私或其他合法权益。</li><li>作品不得包含恶意代码、隐藏下载器、凭证、跟踪组件或与桌宠无关的可执行内容。</li><li>作品信息、作者名称和许可证应真实、清晰，不冒充其他创作者或官方内容。</li></ul></section>
        <section><h2>审核与下架</h2><p>所有新投稿都必须经过人工审核。项目维护者可以因包结构不合格、动作缺失、许可证不清、内容不适合公开展示、安全风险或权利投诉而拒绝或下架作品。审核备注会保留并发送到创作者账户邮箱。</p></section>
        <section><h2>安装与使用</h2><p>桌宠只通过官方 Skill 安装，网页不提供 ZIP 直链。网站系统代码采用 MIT License，但该许可不自动覆盖用户投稿的角色形象、图集、描述和其他作品素材。用户仍应查看每只桌宠标注的许可证；网站代码、Skill 代码与各个投稿作品的许可证彼此独立。</p></section>
        <section><h2>服务边界</h2><p>本项目按当前状态提供，不保证永久可用、适合特定目的或所有第三方桌宠都没有缺陷。系统会执行校验、备份和人工审核，但不能替代用户对许可证和内容来源的判断。</p></section>
        <section id="report"><h2>举报、版权与隐私反馈</h2><p>如果作品侵犯你的权利，或包含不适合公开的内容，请通过项目反馈入口提交桌宠 ID、问题说明和必要证据。不要公开提交身份证件、密钥或其他敏感资料。维护者会先暂停有明确风险的内容，再联系相关创作者核实。</p></section>
        <aside><strong>提交反馈</strong><p><a href="https://github.com/javaC2RenXiangjie/codex-pet-club/issues/new" rel="noreferrer" target="_blank">打开 GitHub Issue</a>。桌宠作品的授权范围由投稿者声明，专业法律判断应由权利人自行确认；本页是项目运营规则，不构成法律意见。</p></aside>
      </article>
      <SiteFooter note="尊重创作者，也保护每一位使用者。" />
    </main>
  );
}
