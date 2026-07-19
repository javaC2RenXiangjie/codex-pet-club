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
  },
  (table) => [
    uniqueIndex("pet_published_slug_unique")
      .on(table.slug)
      .where(sql`${table.status} = 'published'`),
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

export const submissionRateLimits = sqliteTable("submission_rate_limits", {
  fingerprint: text("fingerprint").primaryKey(),
  windowStart: integer("window_start").notNull(),
  attempts: integer("attempts").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});
