from __future__ import annotations

import os
import re
import smtplib
import json
from dataclasses import dataclass
from email.header import Header
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path


@dataclass(frozen=True)
class MailConfig:
    host: str
    port: int
    username: str
    password: str


def _find_block(text: str, header_pattern: str, next_pattern: str) -> str:
    match = re.search(header_pattern, text, re.MULTILINE)
    if not match:
        return ""
    tail = text[match.end():]
    next_match = re.search(next_pattern, tail, re.MULTILINE)
    return tail[:next_match.start()] if next_match else tail


def _first(pattern: str, text: str, default: str = "") -> str:
    match = re.search(pattern, text, re.MULTILINE)
    return match.group(1).strip() if match else default


def _resolve_secret(expression: str) -> str:
    match = re.fullmatch(r"\$\{([^:}]+):([^}]+)\}", expression)
    if match:
        return os.environ.get(match.group(1), match.group(2))
    return expression


def _mail_config_from_json(config_path: Path) -> MailConfig:
    if not config_path.is_file():
        raise FileNotFoundError("dedicated SMTP configuration file is missing")
    payload = json.loads(config_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("dedicated SMTP configuration must be an object")
    host = str(payload.get("host", "")).strip()
    port = int(payload.get("port", 465))
    username = str(payload.get("username", "")).strip()
    password = _resolve_secret(str(payload.get("password", "")).strip())
    if not host or not username or not password:
        raise ValueError("SMTP host, username or password is missing")
    return MailConfig(host=host, port=port, username=username, password=password)


def load_mail_config(
    config_root: Path,
    profile: str,
    dedicated_config: Path | None = None,
) -> MailConfig:
    if dedicated_config is not None:
        return _mail_config_from_json(dedicated_config)
    config_path = config_root / "src" / "main" / "resources" / f"application-{profile}.yml"
    if not config_path.is_file():
        raise FileNotFoundError("mail configuration file is missing")

    text = config_path.read_text(encoding="utf-8")
    mail_block = _find_block(text, r"^  mail:\s*$", r"^\S")
    if not mail_block:
        raise ValueError("spring.mail configuration is missing")

    host = _first(r"^    host:\s*(.+)$", mail_block)
    port_text = _first(r"^    port:\s*(\d+)$", mail_block, "465")
    username = _first(r"^    username:\s*(.+)$", mail_block)
    password = _resolve_secret(_first(r"^    password:\s*(.+)$", mail_block))
    if not host or not username or not password:
        raise ValueError("SMTP host, username or password is missing")
    return MailConfig(host=host, port=int(port_text), username=username, password=password)


class SmtpVerificationSender:
    def __init__(self, config: MailConfig, timeout_seconds: int = 20) -> None:
        self._config = config
        self._timeout_seconds = timeout_seconds

    def send(self, recipient: str, code: str, expires_in_minutes: int) -> None:
        message = EmailMessage()
        message["Subject"] = str(Header("Codex Pet Club 登录验证码", "utf-8"))
        message["From"] = formataddr((str(Header("Codex Pet Club", "utf-8")), self._config.username))
        message["To"] = recipient
        message.set_content(
            "你的验证码是：{code}\n\n验证码 {minutes} 分钟内有效。"
            "如果不是你本人操作，请忽略这封邮件。".format(
                code=code,
                minutes=expires_in_minutes,
            ),
            subtype="plain",
            charset="utf-8",
            cte="base64",
        )

        with smtplib.SMTP_SSL(
            self._config.host,
            self._config.port,
            timeout=self._timeout_seconds,
        ) as server:
            server.login(self._config.username, self._config.password)
            server.send_message(
                message,
                from_addr=self._config.username,
                to_addrs=[recipient],
            )
