ALTER TABLE "clients" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "pinned_at" timestamp with time zone;--> statement-breakpoint
-- Notes pinned before 039 keep their place on top: pinned "when last changed"
UPDATE "notes" SET "pinned_at" = "updated_at" WHERE "is_pinned" AND "pinned_at" IS NULL;
