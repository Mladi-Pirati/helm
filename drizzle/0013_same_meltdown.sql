CREATE TABLE "access_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"keycloak_client_id" text NOT NULL,
	"keycloak_role_name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_application_access" (
	"member_id" text NOT NULL,
	"application_id" text NOT NULL,
	"granted_by" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_application_access_pkey" PRIMARY KEY("member_id","application_id")
);
--> statement-breakpoint
ALTER TABLE "member_application_access" ADD CONSTRAINT "member_application_access_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_application_access" ADD CONSTRAINT "member_application_access_application_id_access_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."access_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_application_access" ADD CONSTRAINT "member_application_access_granted_by_members_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_applications_active_name_unique" ON "access_applications" USING btree ("name") WHERE "access_applications"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "access_applications_active_keycloak_role_unique" ON "access_applications" USING btree ("keycloak_client_id","keycloak_role_name") WHERE "access_applications"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "member_application_access_application_id_idx" ON "member_application_access" USING btree ("application_id");