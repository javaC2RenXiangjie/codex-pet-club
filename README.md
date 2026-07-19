# Codex Pet Club

Codex Pet Club（桌宠开源俱乐部）是面向 Codex 桌面用户的桌宠目录、投稿与审核系统。网站展示已审核桌宠并提供唯一桌宠 ID；官方 Skill 负责上传、下载、校验和本地安装，网页不提供桌宠包直链。

## 当前能力

- 公开桌宠库：列表展示待机动画，详情展示 Codex v2 的 9 组标准动作
- Skill-only 安装：用户复制唯一 ID 后交给 Codex 安装
- 邮箱创作者账户：验证码注册或登录，不使用密码
- Skill Key：每个账户最多保留 3 个有效 Key；同一个 Key 可由用户自行决定是否在多台电脑使用
- 稳定作品归属：投稿绑定永久用户 ID，不绑定邮箱或某一个 Key
- 在线投稿与审核：ZIP 校验、限流、动作预览、通过、拒绝和下架
- 版本化发布：稳定桌宠 ID 下保留不可变历史版本，可下架、恢复或切回旧版
- Cloudflare 存储：D1 保存业务数据，R2 保存私有 ZIP 和数据库备份

官方 Skill 仓库：[javaC2RenXiangjie/codex-pet-club-skill](https://github.com/javaC2RenXiangjie/codex-pet-club-skill)

## 技术栈

- React 19 + Next.js 16 + vinext
- Cloudflare Workers + D1 + R2
- Drizzle ORM / Drizzle Kit
- SendGrid 邮箱验证码
- Node.js 22+

## 本地运行

```bash
npm install
npm run dev
```

开发站点默认运行在 `http://localhost:3001`。本地回环地址不会发送真实邮件，验证码会仅在本地注册页面返回，便于完整测试账户流程。

常用命令：

```bash
npm run lint
npm test
npm run build
npm run db:generate
npm run backup:drill -- path/to/backup.json
npm run deploy
npm run smoke
```

`npm test` 会依次校验桌宠目录、执行生产构建并运行页面、API、迁移和备份恢复测试。

## 生产配置

创作者账户需要以下 Worker 绑定：

| 名称 | 用途 |
| --- | --- |
| `AUTH_SECRET` | 登录限流指纹和验证码 HMAC，应使用随机高强度 Secret |
| `SENDGRID_API_KEY` | SendGrid 发信凭证，只保存为 Cloudflare Secret |
| `EMAIL_FROM` | 已在 SendGrid 验证的发件邮箱 |
| `ADMIN_TOKEN` | 管理后台人工输入的管理员凭证 |

运行 `npm run build` 后，可用生成的 `dist/server/wrangler.json` 写入 Secret。不要把任何凭证提交到 Git：

```bash
npx wrangler secret put AUTH_SECRET --config dist/server/wrangler.json
npx wrangler secret put SENDGRID_API_KEY --config dist/server/wrangler.json
npx wrangler secret put EMAIL_FROM --config dist/server/wrangler.json
```

账户迁移文件为 `drizzle/0002_user_accounts.sql`。应用迁移前应先创建并验证一次最新 R2 备份。

## 页面与接口

| 路径 | 用途 |
| --- | --- |
| `/` | 已发布桌宠目录与动作详情 |
| `/skill` | Skill 安装和桌宠库配置说明 |
| `/account` | 邮箱注册、登录与 Skill Key 管理 |
| `/admin` | 需要管理员凭证的在线审核工作台 |
| `GET /api/pets` | 获取已发布桌宠 |
| `POST /api/pets` | Skill 投稿；携带 Key 时绑定创作者账户，旧版匿名投稿暂时兼容 |
| `GET /api/pets/:id/preview` | 获取已发布桌宠图集 |
| `GET /api/pets/:id/package` | 官方 Skill 获取桌宠包 |
| `POST /api/auth/request-code` | 发送邮箱验证码 |
| `POST /api/auth/verify-code` | 验证邮箱并建立浏览器会话 |
| `GET/POST /api/account/keys` | 查询或生成 Skill Key |
| `DELETE /api/account/keys/:id` | 撤销当前账户的 Key |
| `GET /api/me` | 使用浏览器会话或 Skill Key 查询当前身份 |

## 身份与 Key 设计

- 用户以邮箱验证码注册和登录，服务器创建不可变的用户 ID。
- 作品只保存 `owner_user_id`，更换邮箱或撤销 Key 不改变作品归属。
- Key 原文只展示一次；服务器只保存 SHA-256 哈希和 8 位前缀。
- 每个账户最多 3 个有效 Key，撤销后立即释放额度并使使用该 Key 的所有电脑失效。
- 一个 Key 可以在多台电脑使用，也可以为不同设备分别创建 Key，由用户自行选择。
- 匿名用户仍可浏览桌宠并通过 Skill 安装；账户只在投稿和管理作品时需要。

## 发布数据与备份

- `registry/catalog.json`：稳定 ID、当前版本、历史版本和状态记录
- `public/registry/previews/`：公开 WebP 动作图集
- R2 `codex-pet-club-packages`：私有 ZIP、待审核包和 D1 JSON 备份
- D1：投稿、审核事件、用户、浏览器会话和 Key 哈希

新版本的 R2 对象使用不可变路径：

```text
packages/{catalog-id}/{version}/{sha256}.zip
```

备份 schema v2 同时包含投稿、审核记录、用户和 Key 哈希；恢复工具继续兼容不含账户数据的 schema v1 旧备份。下架只改变目录状态，不删除历史包。

## 桌宠包要求

- ZIP 最大 32 MiB
- 解压后最大 96 MiB、最多 128 个文件
- 包含 `pet.json` 与 `spritesheet.webp`
- `spriteVersionNumber` 必须为 `2`
- 图集尺寸必须为 `1536 × 2288`
- 文件路径不得包含绝对路径或目录穿越

## 当前边界

- 默认使用 Cloudflare 提供的 `*.workers.dev` 地址，无需自定义域名
- 网页不提供桌宠 ZIP 下载入口，桌宠获取必须经过官方 Skill
- v0.4.0 先建立账户、Key 和作品归属；Skill 的交互式绑定命令在 v0.4.1 接入
- 投稿状态查询、创作者主页、改邮箱和账户恢复仍在后续版本
- 仓库尚未附带开源许可证，公开可见不等于已授予复制、修改或分发许可

详细迭代顺序见 [ROADMAP.md](./ROADMAP.md)。
