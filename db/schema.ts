import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const petSubmissions = sqliteTable(
  "pet_submissions",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    author: text("author").notNull().default(""),
    license: text("license").notNull().default("unspecified"),
    category: text("category", {
      enum: ["character", "animal", "fantasy", "robot", "other"],
    }).notNull().default("other"),
    tags: text("tags").notNull().default("[]"),
    status: text("status", { enum: ["pending", "published", "unpublished", "rejected"] })
      .notNull()
      .default("pending"),
    fileKey: text("file_key").notNull(),
    sha256: text("sha256").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    publishedAt: text("published_at"),
    reviewedAt: text("reviewed_at"),
    reviewNote: text("review_note").notNull().default(""),
    ownerUserId: text("owner_user_id"),
    isOfficial: integer("is_official", { mode: "boolean" }).notNull().default(false),
    homepageFeatured: integer("homepage_featured", { mode: "boolean" }).notNull().default(false),
    homepagePriority: integer("homepage_priority").notNull().default(0),
  },
  (table) => [
    uniqueIndex("pet_published_slug_unique")
      .on(table.slug)
      .where(sql`${table.status} = 'published'`),
    index("pet_published_category_updated_idx").on(
      table.status,
      table.category,
      table.publishedAt,
    ),
    index("pet_homepage_featured_idx").on(
      table.status,
      table.homepageFeatured,
      table.homepagePriority,
      table.publishedAt,
    ),
  ],
);

export const moderationEvents = sqliteTable(
  "moderation_events",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id").notNull(),
    petKey: text("pet_key").notNull(),
    displayName: text("display_name").notNull(),
    action: text("action", {
      enum: ["submitted", "published", "rejected", "unpublished"],
    }).notNull(),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("moderation_events_created_idx").on(table.createdAt)],
);

export const submissionMetadataEvents = sqliteTable(
  "submission_metadata_events",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id").notNull(),
    actorType: text("actor_type", { enum: ["admin", "creator"] }).notNull(),
    actorUserId: text("actor_user_id"),
    beforeJson: text("before_json").notNull(),
    afterJson: text("after_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("submission_metadata_events_submission_idx").on(
      table.submissionId,
      table.createdAt,
    ),
  ],
);

export const submissionRateLimits = sqliteTable("submission_rate_limits", {
  fingerprint: text("fingerprint").primaryKey(),
  windowStart: integer("window_start").notNull(),
  attempts: integer("attempts").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    emailVerifiedAt: text("email_verified_at").notNull(),
    status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const emailLoginCodes = sqliteTable(
  "email_login_codes",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: integer("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("email_login_codes_lookup_idx").on(table.email, table.createdAt)],
);

export const userSessions = sqliteTable(
  "user_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("user_sessions_token_unique").on(table.tokenHash),
    index("user_sessions_user_idx").on(table.userId),
  ],
);

export const userApiKeys = sqliteTable(
  "user_api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("user_api_keys_prefix_unique").on(table.prefix),
    uniqueIndex("user_api_keys_hash_unique").on(table.keyHash),
    index("user_api_keys_user_idx").on(table.userId),
  ],
);

export const authRateLimits = sqliteTable("auth_rate_limits", {
  fingerprint: text("fingerprint").primaryKey(),
  windowStart: integer("window_start").notNull(),
  attempts: integer("attempts").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});

export const reviewNotifications = sqliteTable(
  "review_notifications",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id").notNull(),
    userId: text("user_id").notNull(),
    action: text("action", {
      enum: ["published", "rejected", "unpublished"],
    }).notNull(),
    status: text("status", {
      enum: ["pending", "sending", "sent", "failed"],
    }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error").notNull().default(""),
    requestId: text("request_id"),
    nextAttemptAt: integer("next_attempt_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    sentAt: text("sent_at"),
  },
  (table) => [
    index("review_notifications_retry_idx").on(table.status, table.nextAttemptAt),
    index("review_notifications_submission_idx").on(table.submissionId, table.createdAt),
  ],
);

export const maintenanceRuns = sqliteTable(
  "maintenance_runs",
  {
    id: text("id").primaryKey(),
    status: text("status", {
      enum: ["running", "succeeded", "failed"],
    }).notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    backupKey: text("backup_key"),
    deletedRecords: integer("deleted_records").notNull().default(0),
    error: text("error").notNull().default(""),
  },
  (table) => [index("maintenance_runs_started_idx").on(table.startedAt)],
);
