# Codex Pet Club

Codex Pet Club（桌宠开源俱乐部）是面向 Codex 桌面用户的桌宠目录、投稿与审核系统。网站展示已审核桌宠并提供唯一桌宠 ID；官方 Skill 负责上传、下载、校验和本地安装，网页不提供桌宠包直链。

## 当前能力

- 数据驱动首页：五幕滚动叙事只使用已发布且可安装的真实桌宠，精选失效后自动补位
- 独立作品画廊：`/pets` 提供大图卡片、搜索、分类、标签、排序和分页，卡片直接进入独立详情
- 公开桌宠库：列表展示待机动画，详情展示 Codex v2 的 9 组标准动作
- Skill-only 安装：用户复制唯一 ID 后交给 Codex 安装
- Skill 自动更新：每次调用检查官方版本，校验 GitHub Release 后无感升级
- 邮箱创作者账户：验证码注册或登录，不使用密码
- Skill Key：每个账户最多保留 3 个有效 Key；同一个 Key 可由用户自行决定是否在多台电脑使用
- 稳定作品归属：投稿绑定永久用户 ID，不绑定邮箱或某一个 Key
- 我的投稿：账户页与 Skill 均可按状态查询本人投稿，跨设备以服务器记录为准
- 在线投稿与审核：ZIP 校验、限流、动作预览、通过、拒绝和下架
- 高效审核队列：投稿搜索、状态与重复筛选、历史相似项提示、审核清单和拒绝原因模板
- 审核结果邮件：审核通过、拒绝或下架后自动通知，失败有限重试并支持管理员重发
- 上线维护：每日备份恢复预检、过期数据清理、运行状态记录和定时生产烟测
- 版本化发布：稳定桌宠 ID 下保留不可变历史版本，可下架、恢复或切回旧版
- Cloudflare 存储：D1 保存业务数据，R2 保存私有 ZIP 和数据库备份

官方 Skill 仓库：[javaC2RenXiangjie/codex-pet-club-skill](https://github.com/javaC2RenXiangjie/codex-pet-club-skill)

## 技术栈

- React 19 + Next.js 16 + vinext
- Cloudflare Workers + D1 + R2
- Drizzle ORM / Drizzle Kit
- 自托管 SMTP 验证码服务
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
npm run mail-service:test
npm run smoke:auth
npm run build
npm run db:generate
npm run backup:drill -- path/to/backup.json
npm run deploy
npm run smoke
node scripts/release-production.mjs --confirm
```

`npm test` 会依次校验桌宠目录、执行生产构建并运行页面、API、迁移和备份恢复测试。
GitHub Actions 的 `Production Smoke` 可从境外网络验证公开桌宠、Skill 下载保护和真实验证码邮件链路。

## 生产配置

创作者账户需要以下 Worker 绑定：

| 名称 | 用途 |
| --- | --- |
| `AUTH_SECRET` | 登录限流指纹和验证码 HMAC，应使用随机高强度 Secret |
| `MAIL_SERVICE_URL` | 邮件服务的 HTTPS 基础地址，例如 `https://example.com/codex-pet-mail` |
| `MAIL_SERVICE_TOKEN` | Worker 调用邮件服务的共享 Secret；与 SMTP 密码相互独立 |
| `ADMIN_TOKEN` | 管理后台人工输入的管理员凭证 |

运行 `npm run build` 后，可用生成的 `dist/server/wrangler.json` 写入 Secret。不要把任何凭证提交到 Git：

```bash
npx wrangler secret put AUTH_SECRET --config dist/server/wrangler.json
npx wrangler secret put MAIL_SERVICE_URL --config dist/server/wrangler.json
npx wrangler secret put MAIL_SERVICE_TOKEN --config dist/server/wrangler.json
```

邮件服务实现和服务器安装说明见
[`services/codex-pet-mail-service`](./services/codex-pet-mail-service/README.md)。SMTP 凭证只保留
在邮件服务器，Worker 不接触 SMTP 密码。

Drizzle 结构差异保存在 `drizzle/`，Wrangler 生产迁移保存在 `migrations/`。正式发布统一使用 `npm run release:production -- --confirm`，它会在迁移前导出生产 D1。详细顺序和回滚方式见 [OPERATIONS.md](./OPERATIONS.md)。

## 页面与接口

| 路径 | 用途 |
| --- | --- |
| `/` | 数据驱动的五幕滚动叙事首页 |
| `/pets` | 已发布桌宠作品画廊、搜索与筛选 |
| `/pets/:id` | 桌宠独立详情、九种动作和 Skill 安装指令 |
| `/skill` | Skill 安装和桌宠库配置说明 |
| `/account` | 邮箱注册、登录、Skill Key 与本人投稿管理 |
| `/admin` | 需要管理员凭证的在线审核工作台 |
| `/privacy` | 数据收集、使用、保留和反馈说明 |
| `/terms` | 使用、投稿、审核、下架和版权反馈规则 |
| `GET /api/pets` | 获取已发布桌宠 |
| `GET /api/homepage/pets` | 获取首页最多 5 只真实桌宠，结果最多缓存 5 分钟 |
| `POST /api/pets` | Skill 投稿；必须携带有效 Key，并绑定创作者账户 |
| `GET /api/pets/:id/preview` | 获取已发布桌宠图集 |
| `GET /api/pets/:id/package` | 官方 Skill 获取桌宠包 |
| `GET /api/skill/version` | 官方 Skill 最新版本、Release 地址与 SHA-256 清单 |
| `POST /api/auth/request-code` | 发送邮箱验证码 |
| `POST /api/auth/verify-code` | 验证邮箱并建立浏览器会话 |
| `GET/POST /api/account/keys` | 查询或生成 Skill Key |
| `DELETE /api/account/keys/:id` | 撤销当前账户的 Key |
| `GET /api/me` | 使用浏览器会话或 Skill Key 查询当前身份 |
| `GET /api/me/submissions` | 使用浏览器会话或 Skill Key 分页查询本人投稿 |
| `GET /api/submissions/:id` | 查询属于当前账户的投稿详情与审核结果 |
| `GET /api/admin/notifications` | 管理员查询审核邮件投递状态 |
| `POST /api/admin/notifications/:id` | 管理员人工重发失败的审核邮件 |
| `POST /api/admin/maintenance` | 管理员执行备份验证和过期数据清理 |
| `PATCH /api/admin/pets/:id/homepage` | 管理员设置官方标记、首页精选与 0–100 优先级 |

## 身份与 Key 设计

- 用户以邮箱验证码注册和登录，服务器创建不可变的用户 ID。
- 作品只保存 `owner_user_id`，更换邮箱或撤销 Key 不改变作品归属。
- Key 原文只展示一次；服务器只保存 SHA-256 哈希和 8 位前缀。
- 每个账户最多 3 个有效 Key，撤销后立即释放额度并使使用该 Key 的所有电脑失效。
- 一个 Key 可以在多台电脑使用，也可以为不同设备分别创建 Key，由用户自行选择。
- 匿名用户仍可浏览桌宠并通过 Skill 安装；投稿和作品管理必须使用账户 Key。

## 发布数据与备份

- `registry/catalog.json`：稳定 ID、当前版本、历史版本和状态记录
- `public/registry/previews/`：公开 WebP 动作图集
- R2 `codex-pet-club-packages`：私有 ZIP、待审核包和 D1 JSON 备份
- D1：投稿、审核事件、审核邮件任务、维护记录、用户、浏览器会话和 Key 哈希

新版本的 R2 对象使用不可变路径：

```text
packages/{catalog-id}/{version}/{sha256}.zip
```

备份 schema v6 同时包含投稿分类与标签、首页精选字段、展示信息修改审计、审核记录、审核邮件任务、用户和 Key 哈希；恢复工具继续兼容 schema v1/v2/v3/v4/v5 旧备份。每天创建备份后会立即执行恢复预检，验证通过后才清理过期验证码、会话和限流记录。下架只改变目录状态，不删除历史包。

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
- v0.6.0 包含数据驱动滚动首页、独立作品画廊和首页精选接口
- 桌宠文件版本历史、改邮箱和账户恢复仍在后续版本

## 许可证

网站源代码采用 [MIT License](./LICENSE)，可以使用、修改和分发。MIT 只覆盖本仓库中的系统代码和由项目维护者创作的通用界面资源；用户投稿的桌宠、角色形象、图集、描述和其他作品素材不自动纳入 MIT，分别遵循投稿者声明的许可证与相关权利要求。官方 Skill 和第三方依赖也各自遵循其所在仓库或包中声明的许可证。

详细迭代顺序见 [ROADMAP.md](./ROADMAP.md)。
