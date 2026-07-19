# Codex Pet Club

Codex Pet Club（桌宠开源俱乐部）是一个面向 Codex 桌面用户的桌宠目录与审核系统。网站负责展示已审核桌宠、提供唯一桌宠 ID，并通过独立的官方 Skill 完成桌宠上传、下载、校验和本地安装。

> 首个公网版本只开放桌宠浏览和 Skill 安装。线上 `/admin`、管理 API 与投稿接口关闭；已审核目录随代码发布，桌宠包保存在 Cloudflare R2。

## 核心能力

- 公开桌宠目录：只展示审核通过的 Codex v2 桌宠
- 真实动作预览：列表展示待机动画，详情展示 9 组标准动作
- Skill-only 安装：网页不暴露桌宠包直链，用户复制唯一 ID 后交给 Codex 安装
- 本地投稿与审核：校验 ZIP、预览动作并通过或拒绝投稿
- Cloudflare 存储：公开预览图走 Workers 静态资源，桌宠 ZIP 保存在私有 R2 存储桶

官方 Skill 仓库：[javaC2RenXiangjie/codex-pet-club-skill](https://github.com/javaC2RenXiangjie/codex-pet-club-skill)

## 技术栈

- React 19 + Next.js 16 + vinext
- Cloudflare Workers + R2
- Node.js 22+

## 本地运行

```bash
npm install
npm run dev
```

公开站点默认运行在 `http://localhost:3001`。

常用命令：

```bash
npm run lint
npm test
npm run build
npm run deploy
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
| `POST /api/pets` | 首个公网版本固定返回 403 |
| `GET /api/pets/:id/preview` | 获取已发布桌宠图集 |
| `GET /api/pets/:id/package` | 官方 Skill 获取桌宠包 |
| `GET /api/admin/pets` | 获取审核队列 |
| `PATCH /api/admin/pets/:id` | 通过或拒绝投稿 |

## 发布数据

- `lib/public-pet-catalog.ts`：已审核桌宠的 ID、元数据、包键和校验和
- `public/registry/previews/`：公开 WebP 动作图集
- Cloudflare R2 `codex-pet-club-packages`：ZIP 包，网页没有直链，仅由 Skill API 读取

新增桌宠时先在本地完成审核，再上传 ZIP 到 R2、更新目录和预览图，并运行完整测试后部署。

## 桌宠包要求

- ZIP 最大 32 MiB
- 解压后最大 96 MiB、最多 128 个文件
- 包含 `pet.json` 与 `spritesheet.webp`
- `spriteVersionNumber` 必须为 `2`
- 图集尺寸必须为 `1536 × 2288`
- 文件路径不得包含绝对路径或目录穿越

## 当前限制

- 默认使用 Cloudflare 提供的稳定 `*.workers.dev` 地址，无需自定义域名
- 中国大陆网络访问 Cloudflare 的速度和可用性需要持续观察
- 管理后台和投稿未接入身份认证，因此首个公网版本关闭相关路由
- “官方 Skill”请求头只是通道约定，不是强身份认证
- 自动化测试覆盖构建和发布契约；R2 下载仍需部署后做哈希烟测

详细优先级与迭代计划见 [ROADMAP.md](./ROADMAP.md)。

## 仓库边界

本仓库只保存网站、API、审核台和存储层代码；Skill 的可维护源码保存在独立仓库。仓库目前尚未附带开源许可证，公开可见不等于已授予复制、修改或分发许可。
