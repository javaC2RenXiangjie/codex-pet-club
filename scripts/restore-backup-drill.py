#!/usr/bin/env python3
"""Restore a Codex Pet Club backup into temporary in-memory SQLite tables."""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


SUBMISSION_COLUMNS = (
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


def restore_rows(connection: sqlite3.Connection, table: str, columns: tuple[str, ...], rows: list[dict]) -> None:
    placeholders = ", ".join("?" for _ in columns)
    names = ", ".join(columns)
    connection.executemany(
        f"INSERT INTO {table} ({names}) VALUES ({placeholders})",
        [tuple(row.get(column) for column in columns) for row in rows],
    )


def run_drill(path: Path) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("schemaVersion") != 1 or payload.get("source") != "codex-pet-club-db":
        raise ValueError("Unsupported backup schema")
    submissions = payload.get("submissions")
    events = payload.get("moderationEvents")
    if not isinstance(submissions, list) or not isinstance(events, list):
        raise ValueError("Backup rows are missing")
    if not all(isinstance(row, dict) for row in [*submissions, *events]):
        raise ValueError("Backup rows must be JSON objects")

    connection = sqlite3.connect(":memory:")
    try:
        connection.executescript(
            """
            CREATE TABLE pet_submissions (
              id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL,
              description TEXT NOT NULL DEFAULT '', author TEXT NOT NULL DEFAULT '',
              license TEXT NOT NULL DEFAULT 'unspecified', status TEXT NOT NULL,
              file_key TEXT NOT NULL, sha256 TEXT NOT NULL, size_bytes INTEGER NOT NULL,
              created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT,
              reviewed_at TEXT, review_note TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE moderation_events (
              id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, pet_key TEXT NOT NULL,
              display_name TEXT NOT NULL, action TEXT NOT NULL,
              note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
            );
            """
        )
        with connection:
            restore_rows(connection, "pet_submissions", SUBMISSION_COLUMNS, submissions)
            restore_rows(connection, "moderation_events", EVENT_COLUMNS, events)
        restored_submissions = connection.execute(
            "SELECT COUNT(*) FROM pet_submissions"
        ).fetchone()[0]
        restored_events = connection.execute(
            "SELECT COUNT(*) FROM moderation_events"
        ).fetchone()[0]
        if restored_submissions != len(submissions) or restored_events != len(events):
            raise RuntimeError("Restored row count does not match the backup")
        return {
            "ok": True,
            "backup": str(path.resolve()),
            "submissions": restored_submissions,
            "events": restored_events,
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
