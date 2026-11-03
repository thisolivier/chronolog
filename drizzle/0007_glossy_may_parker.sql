ALTER TABLE "notes" DROP CONSTRAINT "notes_contract_id_contracts_id_fk";
--> statement-breakpoint
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_contract_id_contracts_id_fk";
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_one_system_client_per_user" ON "clients" USING btree ("user_id") WHERE "clients"."is_system";--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_one_system_contract_per_client" ON "contracts" USING btree ("client_id") WHERE "contracts"."is_system";