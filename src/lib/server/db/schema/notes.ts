import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { contracts } from "./contracts";

export const notes = pgTable("notes", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	// No cascade: deleting a contract must first reassign its entries and notes (sprint 026-CL).
	contractId: uuid("contract_id")
		.notNull()
		.references(() => contracts.id, { onDelete: "no action" }),
	title: text("title"),
	content: text("content"),
	contentJson: text("content_json"),
	wordCount: integer("word_count").notNull().default(0),
	isPinned: boolean("is_pinned").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	// Server-side trash (sprint 037-CL): set on delete, cleared on restore. Trashed notes keep their
	// ID, links and time-entry links; reads skip them unless asked. Purged after 30 days.
	deletedAt: timestamp("deleted_at", { withTimezone: true })
}, (table) => [
	index("notes_trash_user_id_idx").on(table.userId).where(sql`${table.deletedAt} is not null`)
]);
