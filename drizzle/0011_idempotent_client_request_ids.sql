ALTER TABLE "notes" ADD COLUMN "client_request_id" text;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "client_request_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "notes_user_client_request_id_idx" ON "notes" USING btree ("user_id","client_request_id") WHERE "notes"."client_request_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_user_client_request_id_idx" ON "time_entries" USING btree ("user_id","client_request_id") WHERE "time_entries"."client_request_id" is not null;