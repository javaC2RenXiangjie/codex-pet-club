from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import re
import smtplib
import sqlite3
import time
import uuid
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, Iterable, Optional, Tuple

from mail_transport import SmtpVerificationSender, load_mail_config


VERSION = "0.2.1"
MAX_BODY_BYTES = 4096
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
CODE_PATTERN = re.compile(r"^\d{6}$")
REVIEW_STATUSES = {"published", "rejected", "unpublished"}
ACCOUNT_URL = "https://codex-pet-club.renxiangjie.workers.dev/account"
LOGGER = logging.getLogger("codex-pet-mail-service")


@dataclass(frozen=True)
class Settings:
    token: str
    config_root: Path
    config_profile: str
    rate_db: Path
    smtp_config: Optional[Path] = None
    bind_host: str = "127.0.0.1"
    bind_port: int = 8789
    recipient_limit: int = 5
    recipient_window_seconds: int = 15 * 60
    global_limit: int = 200
    global_window_seconds: int = 60 * 60

    @classmethod
    def from_environment(cls) -> "Settings":
        token = os.environ.get("MAIL_SERVICE_TOKEN", "").strip()
        if len(token) < 32:
            raise ValueError("MAIL_SERVICE_TOKEN must contain at least 32 characters")
        config_root = Path(os.environ.get("MAIL_CONFIG_ROOT", "").strip())
        if not str(config_root) or str(config_root) == ".":
            raise ValueError("MAIL_CONFIG_ROOT is required")
        return cls(
            token=token,
            config_root=config_root,
            config_profile=os.environ.get("MAIL_CONFIG_PROFILE", "dev").strip() or "dev",
            rate_db=Path(
                os.environ.get(
                    "MAIL_RATE_DB",
                    "/var/lib/codex-pet-mail-service/rate-limit.sqlite3",
                )
            ),
            smtp_config=Path(os.environ["MAIL_SMTP_CONFIG"])
            if os.environ.get("MAIL_SMTP_CONFIG", "").strip()
            else None,
            bind_host=os.environ.get("MAIL_BIND_HOST", "127.0.0.1").strip() or "127.0.0.1",
            bind_port=int(os.environ.get("MAIL_BIND_PORT", "8789")),
            recipient_limit=int(os.environ.get("MAIL_RECIPIENT_LIMIT", "5")),
            global_limit=int(os.environ.get("MAIL_GLOBAL_LIMIT", "200")),
        )


class RateLimiter:
    def __init__(self, database_path: Path, token: str) -> None:
        self._database_path = database_path
        self._token = token.encode("utf-8")
        database_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute(
                """CREATE TABLE IF NOT EXISTS rate_limits (
                    key_hash TEXT PRIMARY KEY,
                    window_start INTEGER NOT NULL,
                    attempts INTEGER NOT NULL
                )"""
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(str(self._database_path), timeout=5)
        connection.execute("PRAGMA busy_timeout = 5000")
        return connection

    def _key(self, value: str) -> str:
        return hmac.new(self._token, value.encode("utf-8"), hashlib.sha256).hexdigest()

    def enforce(self, limits: Iterable[Tuple[str, int, int]], now: Optional[int] = None) -> int:
        timestamp = int(now if now is not None else time.time())
        prepared = [(self._key(value), limit, window) for value, limit, window in limits]
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            longest_window = max((window for _, _, window in prepared), default=3600)
            connection.execute(
                "DELETE FROM rate_limits WHERE window_start < ?",
                (timestamp - longest_window * 2,),
            )
            retry_after = 0
            for key_hash, limit, window in prepared:
                row = connection.execute(
                    "SELECT window_start, attempts FROM rate_limits WHERE key_hash = ?",
                    (key_hash,),
                ).fetchone()
                if row is None or row[0] + window <= timestamp:
                    connection.execute(
                        "INSERT OR REPLACE INTO rate_limits (key_hash, window_start, attempts) VALUES (?, ?, 1)",
                        (key_hash, timestamp),
                    )
                    continue
                attempts = int(row[1]) + 1
                connection.execute(
                    "UPDATE rate_limits SET attempts = ? WHERE key_hash = ?",
                    (attempts, key_hash),
                )
                if attempts > limit:
                    retry_after = max(retry_after, row[0] + window - timestamp)
            connection.commit()
            return retry_after
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()


class MailApplication:
    def __init__(self, settings: Settings, sender: object) -> None:
        self.settings = settings
        self.sender = sender
        self.rate_limiter = RateLimiter(settings.rate_db, settings.token)

    def authorize(self, authorization: str) -> bool:
        prefix = "Bearer "
        if not authorization.startswith(prefix):
            return False
        return hmac.compare_digest(authorization[len(prefix):].strip(), self.settings.token)

    def deliver_verification(self, payload: object) -> Tuple[int, Dict[str, object], Dict[str, str]]:
        if not isinstance(payload, dict):
            return 400, {"error": "invalid_request"}, {}
        allowed = {"email", "code", "expiresInMinutes"}
        if set(payload.keys()) - allowed:
            return 400, {"error": "invalid_request"}, {}

        email = str(payload.get("email", "")).strip().lower()
        code = str(payload.get("code", "")).strip()
        expires_in_minutes = payload.get("expiresInMinutes", 10)
        if len(email) > 254 or not EMAIL_PATTERN.fullmatch(email):
            return 400, {"error": "invalid_email"}, {}
        if not CODE_PATTERN.fullmatch(code):
            return 400, {"error": "invalid_code"}, {}
        if not isinstance(expires_in_minutes, int) or not 1 <= expires_in_minutes <= 30:
            return 400, {"error": "invalid_expiry"}, {}

        retry_after = self.rate_limiter.enforce([
            (
                "verification-recipient:" + email,
                self.settings.recipient_limit,
                self.settings.recipient_window_seconds,
            ),
            ("verification-global", self.settings.global_limit, self.settings.global_window_seconds),
        ])
        if retry_after > 0:
            return 429, {"error": "rate_limited"}, {"Retry-After": str(retry_after)}

        request_id = str(uuid.uuid4())
        try:
            self.sender.send(email, code, expires_in_minutes)
        except Exception as error:
            fields = {
                "event": "mail_delivery_failed",
                "request_id": request_id,
                "recipient": mask_email(email),
                "error_type": type(error).__name__,
            }
            if isinstance(error, smtplib.SMTPAuthenticationError):
                fields["smtp_code"] = int(error.smtp_code)
            LOGGER.error(json.dumps(fields, ensure_ascii=False))
            return 502, {"error": "delivery_failed", "requestId": request_id}, {}

        LOGGER.info(json.dumps({
            "event": "mail_accepted",
            "request_id": request_id,
            "recipient": mask_email(email),
        }, ensure_ascii=False))
        return 202, {"ok": True, "requestId": request_id}, {}

    def deliver_review_result(self, payload: object) -> Tuple[int, Dict[str, object], Dict[str, str]]:
        if not isinstance(payload, dict):
            return 400, {"error": "invalid_request"}, {}
        allowed = {"email", "petName", "status", "reviewNote", "accountUrl"}
        if set(payload.keys()) != allowed:
            return 400, {"error": "invalid_request"}, {}

        email = str(payload.get("email", "")).strip().lower()
        pet_name = str(payload.get("petName", "")).strip()
        status = str(payload.get("status", "")).strip()
        review_note = str(payload.get("reviewNote", "")).strip()
        account_url = str(payload.get("accountUrl", "")).strip()
        if len(email) > 254 or not EMAIL_PATTERN.fullmatch(email):
            return 400, {"error": "invalid_email"}, {}
        if not pet_name or len(pet_name) > 100:
            return 400, {"error": "invalid_pet_name"}, {}
        if status not in REVIEW_STATUSES:
            return 400, {"error": "invalid_status"}, {}
        if len(review_note) > 500:
            return 400, {"error": "invalid_review_note"}, {}
        if account_url != ACCOUNT_URL:
            return 400, {"error": "invalid_account_url"}, {}

        retry_after = self.rate_limiter.enforce([
            (
                "review-recipient:" + email,
                self.settings.recipient_limit,
                self.settings.recipient_window_seconds,
            ),
            ("review-global", self.settings.global_limit, self.settings.global_window_seconds),
        ])
        if retry_after > 0:
            return 429, {"error": "rate_limited"}, {"Retry-After": str(retry_after)}

        request_id = str(uuid.uuid4())
        try:
            self.sender.send_review_result(email, pet_name, status, review_note, account_url)
        except Exception as error:
            fields = {
                "event": "review_mail_delivery_failed",
                "request_id": request_id,
                "recipient": mask_email(email),
                "error_type": type(error).__name__,
            }
            if isinstance(error, smtplib.SMTPAuthenticationError):
                fields["smtp_code"] = int(error.smtp_code)
            LOGGER.error(json.dumps(fields, ensure_ascii=False))
            return 502, {"error": "delivery_failed", "requestId": request_id}, {}

        LOGGER.info(json.dumps({
            "event": "review_mail_accepted",
            "request_id": request_id,
            "recipient": mask_email(email),
            "status": status,
        }, ensure_ascii=False))
        return 202, {"ok": True, "requestId": request_id}, {}


def mask_email(email: str) -> str:
    local, domain = email.split("@", 1)
    visible = local[: min(2, len(local))]
    return visible + "***@" + domain


def build_handler(application: MailApplication):
    class RequestHandler(BaseHTTPRequestHandler):
        server_version = "CodexPetMail/" + VERSION

        def log_message(self, format_string: str, *args: object) -> None:
            return

        def _send(self, status: int, payload: Dict[str, object], headers: Optional[Dict[str, str]] = None) -> None:
            body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            for name, value in (headers or {}).items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:
            if self.path != "/healthz":
                self._send(404, {"error": "not_found"})
                return
            self._send(200, {"ok": True, "service": "codex-pet-mail", "version": VERSION})

        def do_POST(self) -> None:
            if self.path not in ("/v1/verification-code", "/v1/review-result"):
                self._send(404, {"error": "not_found"})
                return
            if not application.authorize(self.headers.get("Authorization", "")):
                self._send(401, {"error": "unauthorized"})
                return
            if self.headers.get_content_type() != "application/json":
                self._send(415, {"error": "unsupported_media_type"})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                self._send(400, {"error": "invalid_content_length"})
                return
            if length <= 0 or length > MAX_BODY_BYTES:
                self._send(413 if length > MAX_BODY_BYTES else 400, {"error": "invalid_body"})
                return
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                self._send(400, {"error": "invalid_json"})
                return
            if self.path == "/v1/review-result":
                status, response, headers = application.deliver_review_result(payload)
            else:
                status, response, headers = application.deliver_verification(payload)
            self._send(status, response, headers)

    return RequestHandler


def create_server(settings: Settings, sender: object) -> ThreadingHTTPServer:
    application = MailApplication(settings, sender)
    return ThreadingHTTPServer((settings.bind_host, settings.bind_port), build_handler(application))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    settings = Settings.from_environment()
    config = load_mail_config(settings.config_root, settings.config_profile, settings.smtp_config)
    sender = SmtpVerificationSender(config)
    server = create_server(settings, sender)
    LOGGER.info(json.dumps({
        "event": "service_started",
        "host": settings.bind_host,
        "port": settings.bind_port,
        "version": VERSION,
    }))
    server.serve_forever()


if __name__ == "__main__":
    main()
