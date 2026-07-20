import Link from "next/link";
import { SiteFooter } from "../components/site-footer";

export const metadata = {
  title: "隐私说明 · Codex Pet Club",
  description: "Codex Pet Club 收集、使用和保留创作者数据的说明。",
};

export default function PrivacyPage() {
  return (
    <main className="policy-shell">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark">C:</span>
          <span><strong>Codex Pet Club</strong><small>隐私说明</small></span>
        </Link>
        <nav aria-label="隐私页面导航"><Link href="/">桌宠库</Link><Link href="/terms">使用与投稿规则</Link></nav>
      </header>
      <article className="policy-document">
        <header><span>PRIVACY / 2026-07-20</span><h1>隐私说明</h1><p>我们只收集运行创作者账户、投稿审核和桌宠安装服务所必需的数据。</p></header>
        <section><h2>我们保存什么</h2><ul><li>注册邮箱、创作者名称和系统生成的用户 ID。</li><li>Skill Key 的哈希、前缀、创建时间、撤销时间和最近使用时间；服务器不保存可再次展示的 Key 原文。</li><li>投稿文件、作品信息、审核状态、审核备注和通知投递记录。</li><li>浏览器会话、验证码记录及用于防滥用的来源指纹；来源地址只用于生成不可逆的限流指纹。</li><li>服务运行所需的安全日志、备份和恢复验证结果。</li></ul></section>
        <section><h2>这些数据用来做什么</h2><p>用于登录、确认作品归属、执行投稿与审核、发送审核结果、阻止滥用、排查故障和恢复服务。邮箱不会展示在公开桌宠页面，也不会出售给第三方。</p></section>
        <section><h2>保留与清理</h2><p>过期验证码在失效后最多保留 24 小时；过期会话最多额外保留 7 天；已撤销会话最多保留 30 天；限流记录最多保留约 24 小时。作品、审核记录、Key 哈希、通知记录和备份会在账户及服务运营期间保留，用于归属、审计和恢复。</p></section>
        <section><h2>你的选择</h2><p>你可以撤销 Skill Key、停止投稿，或通过项目反馈入口申请更正账户资料、导出数据或处理账号问题。涉及作品删除、版权或隐私问题时，请提供投稿 ID 和能够证明归属的信息，不要在公开 Issue 中粘贴 Key、验证码或其他密钥。</p></section>
        <section><h2>服务提供方</h2><p>结构化数据存放于 Cloudflare D1，桌宠包和备份存放于私有 R2，邮件由自托管邮件服务发送。各服务只接收完成对应功能所需的数据。</p></section>
        <aside><strong>需要反馈？</strong><p>请使用 <a href="https://github.com/javaC2RenXiangjie/codex-pet-club/issues/new" rel="noreferrer" target="_blank">GitHub Issues</a> 联系项目维护者；敏感信息请只说明问题类型，等待维护者提供非公开处理方式。</p></aside>
      </article>
      <SiteFooter note="少收集、说清楚、能撤销。" />
    </main>
  );
}
