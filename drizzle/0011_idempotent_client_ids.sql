ALTER TABLE "notes" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "client_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "notes_user_client_id_idx" ON "notes" USING btree ("user_id","client_id") WHERE "notes"."client_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_user_client_id_idx" ON "time_entries" USING btree ("user_id","client_id") WHERE "time_entries"."client_id" is not null;