# Codex Pet Club

Codex Pet Club（桌宠开源俱乐部）是一个面向 Codex 桌面用户的桌宠目录与审核系统。网站负责展示已审核桌宠、提供唯一桌宠 ID，并通过独立的官方 Skill 完成桌宠上传、下载、校验和本地安装。

> 首个公网版本只开放桌宠浏览和 Skill 安装。线上 `/admin`、管理 API 与投稿接口由 Worker 关闭，本地开发仍可使用完整审核流程。

## 核心能力

- 公开桌宠目录：只展示审核通过的 Codex v2 桌宠
- 真实动作预览：列表展示待机动画，详情展示 9 组标准动作
- Skill-only 安装：网页不暴露桌宠包直链，用户复制唯一 ID 后交给 Codex 安装
- Skill 投稿：上传 ZIP 后校验清单、图集尺寸、文件路径和 SHA-256
- 审核工作台：管理员预览动作并通过或拒绝投稿
- Cloudflare 存储：D1 保存元数据，R2 保存桌宠包

官方 Skill 仓库：[javaC2RenXiangjie/codex-pet-club-skill](https://github.com/javaC2RenXiangjie/codex-pet-club-skill)

## 技术栈

- React 19 + Next.js 16 API 约定
- vinext + Vite
- Cloudflare D1 + R2
- Drizzle ORM（schema 与迁移生成）
- Node.js 22+

## 本地运行

```bash
npm install
npm run dev
```

默认本地地址由开发服务器输出；本项目当前演示地址为 `http://localhost:3001`。

常用命令：

```bash
npm run lint
npm test
npm run build
npm run db:generate
```

`npm test` 会先执行生产构建，再运行页面与关键路由的结构测试。

## 页面与接口

| 路径 | 用途 |
| --- | --- |
| `/` | 已发布桌宠目录与动作详情 |
| `/skill` | Skill 安装和桌宠库配置说明 |
| `/admin` | 本地审核工作台（首个公网版本返回 404） |
| `GET /api/pets` | 获取已发布桌宠 |
| `POST /api/pets` | Skill 提交桌宠包（首个公网版本返回 403） |
| `GET /api/pets/:id/preview` | 获取已发布桌宠图集 |
| `GET /api/pets/:id/package` | 官方 Skill 获取桌宠包 |
| `GET /api/admin/pets` | 获取审核队列 |
| `PATCH /api/admin/pets/:id` | 通过或拒绝投稿 |

## 存储配置

`.openai/hosting.json` 声明两个运行时绑定：

- `DB`：Cloudflare D1 数据库
- `PET_FILES`：Cloudflare R2 桌宠包存储桶

本地开发数据保存在 `.wrangler/`，不会进入 Git。

## 桌宠包要求

- ZIP 最大 32 MiB
- 解压后最大 96 MiB、最多 128 个文件
- 包含 `pet.json` 与 `spritesheet.webp`
- `spriteVersionNumber` 必须为 `2`
- 图集尺寸必须为 `1536 × 2288`
- 文件路径不得包含绝对路径或目录穿越

## 当前限制

- 管理后台和投稿暂未接入身份认证，因此首个公网版本直接关闭相关路由
- “官方 Skill”请求头只是通道约定，不是强身份认证
- 数据库 schema 仍会在请求中自检，尚未完全切换为部署期迁移
- 自动化测试以构建和结构断言为主，缺少 D1/R2 集成与完整 E2E

详细优先级与迭代计划见 [ROADMAP.md](./ROADMAP.md)。

## 仓库边界

本仓库只保存网站、API、审核台和存储层代码；Skill 的可维护源码保存在独立仓库。仓库目前尚未附带开源许可证，公开可见不等于已授予复制、修改或分发许可。
