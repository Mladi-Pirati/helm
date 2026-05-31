ALTER TABLE "users" ADD COLUMN "keycloak_user_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_keycloak_user_id_unique" ON "users" USING btree ("keycloak_user_id");