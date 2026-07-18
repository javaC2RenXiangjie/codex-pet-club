import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const petSubmissions = sqliteTable(
  "pet_submissions",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    author: text("author").notNull().default(""),
    license: text("license").notNull().default("unspecified"),
    status: text("status", { enum: ["pending", "published", "rejected"] })
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
