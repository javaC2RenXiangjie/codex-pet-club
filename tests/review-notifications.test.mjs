import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("queues a review notification in the moderation transaction", async () => {
  const [registry, notifications, migration] = await Promise.all([
    readFile(new URL("../lib/pet-registry.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/review-notifications.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_review_notifications.sql", import.meta.url), "utf8"),
  ]);
  assert.match(registry, /reviewNotificationStatement/);
  assert.match(registry, /\.\.\.\(notification \? \[notification\] : \[\]\)/);
  assert.match(notifications, /MAX_AUTOMATIC_ATTEMPTS = 5/);
  assert.match(notifications, /\/v1\/review-result/);
  assert.doesNotMatch(notifications, /subject:/);
  assert.match(migration, /CREATE TABLE `review_notifications`/);
  assert.match(migration, /review_notifications_retry_idx/);
});

test("keeps email failure separate from the review response and supports manual resend", async () => {
  const [decisionRoute, resendRoute, listRoute] = await Promise.all([
    readFile(new URL("../app/api/admin/pets/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/notifications/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/notifications/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(decisionRoute, /deliverLatestReviewNotification/);
  assert.match(decisionRoute, /Review completed but notification delivery could not start/);
  assert.match(resendRoute, /adminOnlyResponse/);
  assert.match(resendRoute, /manual: true/);
  assert.match(listRoute, /listReviewNotifications/);
});

test("retries review mail every five minutes and backs delivery records up", async () => {
  const [worker, vite, backup, restore, adminPage] = await Promise.all([
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/registry-backup.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/restore-backup-drill.py", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(worker, /retryReviewNotifications/);
  assert.match(vite, /"\*\/5 \* \* \* \*"/);
  assert.match(backup, /schemaVersion: 6/);
  assert.match(backup, /reviewNotifications: notifications/);
  assert.match(restore, /review_notifications/);
  assert.match(adminPage, /审核邮件/);
  assert.match(adminPage, /重新发送/);
});
