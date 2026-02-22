ALTER TABLE "attachments" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "note_links" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "note_time_entries" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "work_types" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_links" ADD CONSTRAINT "note_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_time_entries" ADD CONSTRAINT "note_time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_types" ADD CONSTRAINT "work_types_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Backfill user_id on contracts from clients
UPDATE contracts SET user_id = clients.user_id FROM clients WHERE contracts.client_id = clients.id;--> statement-breakpoint

-- Backfill user_id on deliverables from contracts
UPDATE deliverables SET user_id = contracts.user_id FROM contracts WHERE deliverables.contract_id = contracts.id;--> statement-breakpoint

-- Backfill user_id on work_types from deliverables
UPDATE work_types SET user_id = deliverables.user_id FROM deliverables WHERE work_types.deliverable_id = deliverables.id;--> statement-breakpoint

-- Backfill user_id on note_links from notes (source note)
UPDATE note_links SET user_id = notes.user_id FROM notes WHERE note_links.source_note_id = notes.id;--> statement-breakpoint

-- Backfill user_id on note_time_entries from notes
UPDATE note_time_entries SET user_id = notes.user_id FROM notes WHERE note_time_entries.note_id = notes.id;--> statement-breakpoint

-- Backfill user_id on attachments from notes
UPDATE attachments SET user_id = notes.user_id FROM notes WHERE attachments.note_id = notes.id;