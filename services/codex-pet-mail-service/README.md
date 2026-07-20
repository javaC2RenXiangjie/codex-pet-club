# Codex Pet Club 邮件服务

这是 Codex Pet Club 账户验证码和审核结果通知的最小邮件服务。它可以读取服务器现有的
`application-{profile}.yml` 中 `spring.mail` 配置，也可以读取只包含
`host`、`port`、`username`、`password` 的独立 JSON 配置。SMTP 密码不会进入仓库、
Cloudflare 或日志。

## 安全边界

- 只开放 `POST /v1/verification-code` 和 `POST /v1/review-result`，服务端固定邮件标题和正文，不接受任意邮件内容。
- 请求必须携带至少 32 字符的 Bearer Token。
- 按收件人和全局维度进行第二层限流，限流库只保存 HMAC，不保存邮箱原文。
- 每次请求会自动清理超过两倍限流窗口的旧记录，避免限流库无限增长。
- 业务日志只记录脱敏邮箱、请求 ID 和安全的错误类型，不记录验证码、Token 或 SMTP 密码。
- 默认只监听 `127.0.0.1:8789`；公网调用必须经过既有 HTTPS 反向代理。

## 接口

```http
GET /healthz

POST /v1/verification-code
Authorization: Bearer <MAIL_SERVICE_TOKEN>
Content-Type: application/json

{
  "email": "creator@example.com",
  "code": "123456",
  "expiresInMinutes": 10
}

POST /v1/review-result
Authorization: Bearer <MAIL_SERVICE_TOKEN>
Content-Type: application/json

{
  "email": "creator@example.com",
  "petName": "Orange Kitty",
  "status": "published",
  "reviewNote": "图集检查通过",
  "accountUrl": "https://codex-pet-club.renxiangjie.workers.dev/account"
}
```

审核结果只接受 `published`、`rejected`、`unpublished` 三种状态和固定账户页链接；接口不接受自定义标题、正文或外部链接。

成功发送返回 `202`。认证失败返回 `401`，第二层限流返回 `429`，SMTP 发送失败返回
不包含内部配置的 `502`。

## 本地测试

```bash
python -m unittest discover -s services/codex-pet-mail-service/tests -v
```

## 服务器配置

1. 将 `app.py` 和 `mail_transport.py` 安装到 `/opt/codex-pet-mail-service`。
2. 创建不可登录的 `codexpetmail` 系统用户和 `/var/lib/codex-pet-mail-service`。
3. 按 `.env.example` 创建权限为 `600` 的 `/etc/codex-pet-mail-service.env`。若服务器
   原配置没有 `spring.mail`，设置 `MAIL_SMTP_CONFIG` 指向权限为 `640`、仅
   `root:codexpetmail` 可读的最小 JSON 配置；不要复制完整业务配置。
4. 安装 `deploy/codex-pet-mail-service.service`，执行 daemon-reload 后启动服务。
5. 测试环境使用 `MAIL_CONFIG_PROFILE=dev`；生产环境按实际 SMTP 配置选择 profile。
6. 将 `deploy/nginx-location.conf` 加入已有 HTTPS `server` 配置，检查通过后 reload。
   当前 MVP 使用既有域名下的 `/codex-pet-mail` 路径，后续可无缝换成独立域名。

生产切换时，Cloudflare Worker 仅保存 `MAIL_SERVICE_URL` 和 `MAIL_SERVICE_TOKEN` 两个
Secret；SMTP 凭证始终留在邮件服务器。
