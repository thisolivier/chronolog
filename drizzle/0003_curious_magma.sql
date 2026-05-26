-- Convert users.id and all user_id FKs from uuid to text (to match Better Auth text IDs).
-- FK constraints must be dropped first: altering either side alone leaves the
-- column types mismatched against the still-uuid counterpart, which Postgres rejects.
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "notes" DROP CONSTRAINT IF EXISTS "notes_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "time_entries" DROP CONSTRAINT IF EXISTS "time_entries_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "weekly_statuses" DROP CONSTRAINT IF EXISTS "weekly_statuses_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "time_entries" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "weekly_statuses" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_statuses" ADD CONSTRAINT "weekly_statuses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password_hash";
