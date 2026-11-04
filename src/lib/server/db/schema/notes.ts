import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
	// Kept in step with pinnedAt (sprint 039-CL): older code and the API read the boolean
	isPinned: boolean("is_pinned").notNull().default(false),
	// When the note was pinned (sprint 039-CL); pinned notes sort first, most recently pinned on top
	pinnedAt: timestamp("pinned_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	// Server-side trash (sprint 037-CL): set on delete, cleared on restore. Trashed notes keep their
	// ID, links and time-entry links; reads skip them unless asked. Purged after 30 days.
	deletedAt: timestamp("deleted_at", { withTimezone: true }),
	// The creating client's own ID for the note (sprint 045-CL: the offline outbox's temp ID), so a
	// create sent twice returns the first note instead of making a second one
	clientRequestId: text("client_request_id")
}, (table) => [
	index("notes_trash_user_id_idx").on(table.userId).where(sql`${table.deletedAt} is not null`),
	uniqueIndex("notes_user_client_request_id_idx").on(table.userId, table.clientRequestId).where(sql`${table.clientRequestId} is not null`)
]);
