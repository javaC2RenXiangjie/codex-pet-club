#!/usr/bin/env python3
"""Restore a Codex Pet Club backup into temporary in-memory SQLite tables."""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


SUBMISSION_COLUMNS_V3 = (
    "id",
    "slug",
    "name",
    "description",
    "author",
    "license",
    "status",
    "file_key",
    "sha256",
    "size_bytes",
    "created_at",
    "updated_at",
    "published_at",
    "reviewed_at",
    "review_note",
    "owner_user_id",
)

SUBMISSION_COLUMNS_V4 = (
    "id",
    "slug",
    "name",
    "description",
    "author",
    "license",
    "category",
    "tags",
    "status",
    "file_key",
    "sha256",
    "size_bytes",
    "created_at",
    "updated_at",
    "published_at",
    "reviewed_at",
    "review_note",
    "owner_user_id",
)

SUBMISSION_COLUMNS_V6 = (
    *SUBMISSION_COLUMNS_V4,
    "is_official",
    "homepage_featured",
    "homepage_priority",
)

EVENT_COLUMNS = (
    "id",
    "submission_id",
    "pet_key",
    "display_name",
    "action",
    "note",
    "created_at",
)

USER_COLUMNS = (
    "id",
    "email",
    "display_name",
    "email_verified_at",
    "status",
    "created_at",
    "updated_at",
)

API_KEY_COLUMNS = (
    "id",
    "user_id",
    "name",
    "prefix",
    "key_hash",
    "created_at",
    "last_used_at",
    "revoked_at",
)

NOTIFICATION_COLUMNS = (
    "id",
    "submission_id",
    "user_id",
    "action",
    "status",
    "attempts",
    "last_error",
    "request_id",
    "next_attempt_at",
    "created_at",
    "updated_at",
    "sent_at",
)

METADATA_EVENT_COLUMNS = (
    "id",
    "submission_id",
    "actor_type",
    "actor_user_id",
    "before_json",
    "after_json",
    "created_at",
)


def restore_rows(connection: sqlite3.Connection, table: str, columns: tuple[str, ...], rows: list[dict]) -> None:
    placeholders = ", ".join("?" for _ in columns)
    names = ", ".join(columns)
    connection.executemany(
        f"INSERT INTO {table} ({names}) VALUES ({placeholders})",
        [tuple(row.get(column) for column in columns) for row in rows],
    )


def run_drill(path: Path) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    schema_version = payload.get("schemaVersion")
    if schema_version not in (1, 2, 3, 4, 5, 6) or payload.get("source") != "codex-pet-club-db":
        raise ValueError("Unsupported backup schema")
    submissions = payload.get("submissions")
    events = payload.get("moderationEvents")
    users = payload.get("users", []) if schema_version >= 2 else []
    api_keys = payload.get("userApiKeys", []) if schema_version >= 2 else []
    notifications = payload.get("reviewNotifications", []) if schema_version >= 3 else []
    metadata_events = payload.get("submissionMetadataEvents", []) if schema_version >= 5 else []
    if not all(isinstance(rows, list) for rows in (submissions, events, users, api_keys, notifications, metadata_events)):
        raise ValueError("Backup rows are missing")
    if not all(isinstance(row, dict) for row in [*submissions, *events, *users, *api_keys, *notifications, *metadata_events]):
        raise ValueError("Backup rows must be JSON objects")

    connection = sqlite3.connect(":memory:")
    try:
        connection.executescript(
            """
            CREATE TABLE pet_submissions (
              id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL,
              description TEXT NOT NULL DEFAULT '', author TEXT NOT NULL DEFAULT '',
              license TEXT NOT NULL DEFAULT 'unspecified', status TEXT NOT NULL,
              category TEXT NOT NULL DEFAULT 'other', tags TEXT NOT NULL DEFAULT '[]',
              file_key TEXT NOT NULL, sha256 TEXT NOT NULL, size_bytes INTEGER NOT NULL,
              created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT,
              reviewed_at TEXT, review_note TEXT NOT NULL DEFAULT '', owner_user_id TEXT,
              is_official INTEGER NOT NULL DEFAULT 0,
              homepage_featured INTEGER NOT NULL DEFAULT 0,
              homepage_priority INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE moderation_events (
              id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, pet_key TEXT NOT NULL,
              display_name TEXT NOT NULL, action TEXT NOT NULL,
              note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
            );
            CREATE TABLE users (
              id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
              email_verified_at TEXT NOT NULL, status TEXT NOT NULL,
              created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            );
            CREATE TABLE user_api_keys (
              id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
              prefix TEXT NOT NULL UNIQUE, key_hash TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL, last_used_at TEXT, revoked_at TEXT
            );
            CREATE TABLE review_notifications (
              id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, user_id TEXT NOT NULL,
              action TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL,
              last_error TEXT NOT NULL DEFAULT '', request_id TEXT,
              next_attempt_at INTEGER NOT NULL, created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL, sent_at TEXT
            );
            CREATE TABLE submission_metadata_events (
              id TEXT PRIMARY KEY, submission_id TEXT NOT NULL,
              actor_type TEXT NOT NULL, actor_user_id TEXT,
              before_json TEXT NOT NULL, after_json TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            """
        )
        with connection:
            submission_columns = (
                SUBMISSION_COLUMNS_V6 if schema_version >= 6
                else SUBMISSION_COLUMNS_V4 if schema_version >= 4
                else SUBMISSION_COLUMNS_V3
            )
            restore_rows(connection, "pet_submissions", submission_columns, submissions)
            restore_rows(connection, "moderation_events", EVENT_COLUMNS, events)
            restore_rows(connection, "users", USER_COLUMNS, users)
            restore_rows(connection, "user_api_keys", API_KEY_COLUMNS, api_keys)
            restore_rows(connection, "review_notifications", NOTIFICATION_COLUMNS, notifications)
            restore_rows(connection, "submission_metadata_events", METADATA_EVENT_COLUMNS, metadata_events)
        restored_submissions = connection.execute(
            "SELECT COUNT(*) FROM pet_submissions"
        ).fetchone()[0]
        restored_events = connection.execute(
            "SELECT COUNT(*) FROM moderation_events"
        ).fetchone()[0]
        restored_users = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        restored_api_keys = connection.execute("SELECT COUNT(*) FROM user_api_keys").fetchone()[0]
        restored_notifications = connection.execute(
            "SELECT COUNT(*) FROM review_notifications"
        ).fetchone()[0]
        restored_metadata_events = connection.execute(
            "SELECT COUNT(*) FROM submission_metadata_events"
        ).fetchone()[0]
        if (
            restored_submissions != len(submissions)
            or restored_events != len(events)
            or restored_users != len(users)
            or restored_api_keys != len(api_keys)
            or restored_notifications != len(notifications)
            or restored_metadata_events != len(metadata_events)
        ):
            raise RuntimeError("Restored row count does not match the backup")
        return {
            "ok": True,
            "backup": str(path.resolve()),
            "submissions": restored_submissions,
            "events": restored_events,
            "users": restored_users,
            "apiKeys": restored_api_keys,
            "notifications": restored_notifications,
            "metadataChanges": restored_metadata_events,
            "target": "sqlite-memory",
        }
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("backup", type=Path)
    args = parser.parse_args()
    print(json.dumps(run_drill(args.backup), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
