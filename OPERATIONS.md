# Codex Pet Club 生产运行手册

## 正式发布

生产发布只从与 `origin/main` 完全一致且没有未提交修改的 `main` 执行：

```bash
node scripts/release-production.mjs --confirm
```

脚本按固定顺序执行：代码检查与测试、生产 D1 导出、Wrangler 迁移、Worker 部署、生产烟测。任何一步失败都会停止后续操作。D1 导出保存在忽略提交的 `outputs/`，其中可能包含邮箱和 Key 哈希，不得上传到公开仓库或聊天。

## 数据库迁移

- `db/schema.ts` 是应用结构定义。
- `drizzle/` 保存 Drizzle 生成并经过检查的结构差异。
- `migrations/` 是 Wrangler 生产迁移目录；v0.4.5 的首个迁移是可重复执行的完整基线，后续生产结构变化必须新增顺序迁移，禁止修改已经上线的迁移。
- 每次迁移前必须先完成 D1 导出。运行中失败时 D1 会回滚本次迁移。

## 每日维护

Worker 每天 03:00 UTC 自动执行：

1. 创建 D1 JSON 备份并写入私有 R2。
2. 读取刚创建的备份，验证 SHA-256、结构、记录数量和恢复前提。
3. 仅在验证通过后清理过期验证码、会话和限流记录。
4. 将成功、失败、备份标识和清理数量写入 `maintenance_runs`。

管理员也可以在 `/admin` 的“服务运行状态”区域人工执行相同流程。

## 烟测与告警

- GitHub Actions 每天 01:30 UTC 运行公开生产烟测。失败记录会出现在仓库 Actions 中，并按 GitHub 账户通知设置提醒维护者。
- 真实验证码邮件烟测只在人工触发 `Production Smoke` 时执行，避免每天产生测试邮件。
- 管理后台同时显示 D1、R2、最近备份和最近维护状态。

## Worker 回滚

代码部署异常时先查询最近版本，再回滚 Worker：

```bash
npx wrangler deployments list --config dist/server/wrangler.json
npx wrangler rollback <version-id> --config dist/server/wrangler.json
```

数据库恢复不自动执行。必须先保留当前数据库导出，验证目标备份，再制定受控恢复步骤；禁止直接覆盖生产数据或删除历史备份。
