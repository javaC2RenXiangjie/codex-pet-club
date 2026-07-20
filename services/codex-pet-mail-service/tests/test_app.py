from __future__ import annotations

import http.client
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app import Settings, create_server  # noqa: E402
from mail_transport import load_mail_config  # noqa: E402


class RecordingSender:
    def __init__(self) -> None:
        self.messages = []
        self.review_messages = []

    def send(self, recipient: str, code: str, expires_in_minutes: int) -> None:
        self.messages.append((recipient, code, expires_in_minutes))

    def send_review_result(
        self,
        recipient: str,
        pet_name: str,
        status: str,
        review_note: str,
        account_url: str,
    ) -> None:
        self.review_messages.append(
            (recipient, pet_name, status, review_note, account_url)
        )


class MailServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.sender = RecordingSender()
        self.settings = Settings(
            token="test-token-which-is-longer-than-thirty-two-characters",
            config_root=Path(self.directory.name),
            config_profile="dev",
            rate_db=Path(self.directory.name) / "rate.sqlite3",
            bind_host="127.0.0.1",
            bind_port=0,
            recipient_limit=2,
            global_limit=10,
        )
        self.server = create_server(self.settings, self.sender)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.directory.cleanup()

    def request(self, method: str, path: str, payload=None, token: str = ""):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {}
        if body is not None:
            headers["Content-Type"] = "application/json"
            headers["Content-Length"] = str(len(body))
        if token:
            headers["Authorization"] = "Bearer " + token
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), json.loads(response.read())
        connection.close()
        return result

    def test_health_does_not_require_credentials(self) -> None:
        status, _, body = self.request("GET", "/healthz")
        self.assertEqual(status, 200)
        self.assertEqual(body["service"], "codex-pet-mail")

    def test_rejects_unauthorized_delivery(self) -> None:
        status, _, body = self.request(
            "POST",
            "/v1/verification-code",
            {"email": "creator@example.com", "code": "123456"},
        )
        self.assertEqual(status, 401)
        self.assertEqual(body["error"], "unauthorized")
        self.assertEqual(self.sender.messages, [])

    def test_sends_only_the_fixed_verification_payload(self) -> None:
        status, _, body = self.request(
            "POST",
            "/v1/verification-code",
            {"email": "Creator@Example.com", "code": "123456", "expiresInMinutes": 10},
            self.settings.token,
        )
        self.assertEqual(status, 202)
        self.assertTrue(body["ok"])
        self.assertEqual(self.sender.messages, [("creator@example.com", "123456", 10)])

        status, _, body = self.request(
            "POST",
            "/v1/verification-code",
            {
                "email": "creator@example.com",
                "code": "123456",
                "subject": "arbitrary mail is forbidden",
            },
            self.settings.token,
        )
        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "invalid_request")

    def test_applies_a_second_server_side_rate_limit(self) -> None:
        payload = {"email": "limited@example.com", "code": "123456"}
        for _ in range(2):
            status, _, _ = self.request(
                "POST",
                "/v1/verification-code",
                payload,
                self.settings.token,
            )
            self.assertEqual(status, 202)
        status, headers, body = self.request(
            "POST",
            "/v1/verification-code",
            payload,
            self.settings.token,
        )
        self.assertEqual(status, 429)
        self.assertIn("Retry-After", headers)
        self.assertEqual(body["error"], "rate_limited")

    def test_sends_only_the_fixed_review_result_payload(self) -> None:
        account_url = "https://codex-pet-club.renxiangjie.workers.dev/account"
        payload = {
            "email": "Creator@Example.com",
            "petName": "橘猫",
            "status": "published",
            "reviewNote": "图集检查通过",
            "accountUrl": account_url,
        }
        status, _, body = self.request(
            "POST",
            "/v1/review-result",
            payload,
            self.settings.token,
        )
        self.assertEqual(status, 202)
        self.assertTrue(body["ok"])
        self.assertEqual(
            self.sender.review_messages,
            [("creator@example.com", "橘猫", "published", "图集检查通过", account_url)],
        )

        status, _, body = self.request(
            "POST",
            "/v1/review-result",
            {**payload, "subject": "arbitrary mail is forbidden"},
            self.settings.token,
        )
        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "invalid_request")

    def test_rejects_invalid_review_result_fields(self) -> None:
        valid = {
            "email": "creator@example.com",
            "petName": "Orange Kitty",
            "status": "rejected",
            "reviewNote": "",
            "accountUrl": "https://codex-pet-club.renxiangjie.workers.dev/account",
        }
        cases = [
            ({**valid, "petName": ""}, "invalid_pet_name"),
            ({**valid, "status": "pending"}, "invalid_status"),
            ({**valid, "reviewNote": "x" * 501}, "invalid_review_note"),
            ({**valid, "accountUrl": "https://example.com"}, "invalid_account_url"),
        ]
        for payload, expected in cases:
            with self.subTest(expected=expected):
                status, _, body = self.request(
                    "POST",
                    "/v1/review-result",
                    payload,
                    self.settings.token,
                )
                self.assertEqual(status, 400)
                self.assertEqual(body["error"], expected)

    def test_rejects_invalid_email_code_and_expiry(self) -> None:
        cases = [
            ({"email": "not-an-email", "code": "123456"}, "invalid_email"),
            ({"email": "a@example.com", "code": "12345"}, "invalid_code"),
            ({"email": "a@example.com", "code": "123456", "expiresInMinutes": 31}, "invalid_expiry"),
        ]
        for payload, expected in cases:
            with self.subTest(expected=expected):
                status, _, body = self.request(
                    "POST",
                    "/v1/verification-code",
                    payload,
                    self.settings.token,
                )
                self.assertEqual(status, 400)
                self.assertEqual(body["error"], expected)

    def test_loads_only_the_dedicated_smtp_json_when_configured(self) -> None:
        path = Path(self.directory.name) / "smtp.json"
        path.write_text(json.dumps({
            "host": "smtp.example.com",
            "port": 465,
            "username": "mailer@example.com",
            "password": "secret-from-server-file",
        }), encoding="utf-8")
        config = load_mail_config(Path(self.directory.name) / "missing", "dev", path)
        self.assertEqual(config.host, "smtp.example.com")
        self.assertEqual(config.port, 465)
        self.assertEqual(config.username, "mailer@example.com")
        self.assertEqual(config.password, "secret-from-server-file")


if __name__ == "__main__":
    unittest.main()
