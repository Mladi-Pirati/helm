CREATE TABLE "api_rate_limit_windows" (
	"scope" text NOT NULL,
	"identifier_hash" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "api_rate_limit_windows_pkey" PRIMARY KEY("scope","identifier_hash","window_start")
);
--> statement-breakpoint
CREATE INDEX "api_rate_limit_windows_expires_at_idx" ON "api_rate_limit_windows" USING btree ("expires_at");