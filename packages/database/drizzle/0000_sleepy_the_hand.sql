CREATE TYPE "public"."form_respondent_identity_enum" AS ENUM('ANONYMOUS', 'VERIFIED_EMAIL');--> statement-breakpoint
CREATE TYPE "public"."form_status_enum" AS ENUM('DRAFT', 'PUBLISHED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."form_submission_access_enum" AS ENUM('ANYONE', 'ACCESS_CODE', 'AUTHENTICATED_ONLY');--> statement-breakpoint
CREATE TYPE "public"."form_submission_layout_enum" AS ENUM('ONE_AT_A_TIME', 'ALL_AT_ONCE');--> statement-breakpoint
CREATE TYPE "public"."form_template_enum" AS ENUM('CORPORATE', 'SURVEY', 'EDUCATION', 'DEVELOPER', 'RETRO', 'INVITATION', 'TICKET', 'LANDING', 'CLASSIC');--> statement-breakpoint
CREATE TYPE "public"."field_type_enum" AS ENUM('TEXT', 'EMAIL', 'NUMBER', 'YES_NO', 'PASSWORD', 'LONG_TEXT', 'DROPDOWN', 'MULTI_SELECT', 'CHECKBOX_GROUP', 'DATE', 'RATING', 'RADIO_GROUP', 'FILE_UPLOAD');--> statement-breakpoint
CREATE TYPE "public"."file_upload_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'ATTACHED');--> statement-breakpoint
CREATE TYPE "public"."oauth_provider" AS ENUM('google');--> statement-breakpoint
CREATE TYPE "public"."form_view_device_enum" AS ENUM('DESKTOP', 'MOBILE', 'TABLET', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."ai_request_status_enum" AS ENUM('IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."subscription_source_enum" AS ENUM('PADDLE', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."subscription_status_enum" AS ENUM('ACTIVE', 'TRIALING', 'PAST_DUE', 'PAUSED', 'CANCELED');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text,
	"email_verified" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(50) NOT NULL,
	"decription" varchar(300),
	"status" "form_status_enum" DEFAULT 'DRAFT' NOT NULL,
	"submission_access" "form_submission_access_enum" DEFAULT 'ANYONE' NOT NULL,
	"template" "form_template_enum" DEFAULT 'CLASSIC' NOT NULL,
	"submission_layout" "form_submission_layout_enum" DEFAULT 'ONE_AT_A_TIME' NOT NULL,
	"access_code" varchar(12),
	"respondent_identity" "form_respondent_identity_enum" DEFAULT 'ANONYMOUS' NOT NULL,
	"one_response_per_email" boolean DEFAULT false NOT NULL,
	"published_version_id" uuid,
	"closes_at" timestamp,
	"closed_reason" varchar(16),
	"last_activity_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "form_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid,
	"label" varchar(100) NOT NULL,
	"label_key" varchar(100) NOT NULL,
	"description" text,
	"placeholer" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"config" jsonb,
	"index" numeric NOT NULL,
	"type" "field_type_enum" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "form_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid,
	"version_id" uuid,
	"submitted_by" uuid,
	"respondent_email" varchar(255),
	"email_key" varchar(255),
	"idempotency_key" varchar(64),
	"values" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "file_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid,
	"field_id" uuid,
	"submission_id" uuid,
	"owner_id" uuid,
	"actor_key" varchar(80) NOT NULL,
	"storage_key" varchar(255) NOT NULL,
	"kind" varchar(8) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"bytes" integer,
	"status" "file_upload_status_enum" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	"attached_at" timestamp,
	CONSTRAINT "file_uploads_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "form_respondent_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"nonce" varchar(64) NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "form_respondent_challenges_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "oauth_provider_account_unique" UNIQUE("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "form_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid,
	"device" "form_view_device_enum" DEFAULT 'UNKNOWN' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"feature" varchar(40) DEFAULT 'FORM_BUILDER' NOT NULL,
	"plan_key" varchar(40) DEFAULT 'free' NOT NULL,
	"form_id" uuid,
	"status" "ai_request_status_enum" DEFAULT 'IN_PROGRESS' NOT NULL,
	"provider" varchar(40),
	"model" varchar(100),
	"attempts" integer DEFAULT 0 NOT NULL,
	"fallback_used" boolean DEFAULT false NOT NULL,
	"intent" varchar(20),
	"prompt_chars" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_micros" bigint DEFAULT 0 NOT NULL,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"first_token_ms" integer,
	"error_code" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_spend_counters" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"tokens" bigint DEFAULT 0 NOT NULL,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feature" varchar(40) DEFAULT 'FORM_BUILDER' NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"window_end" timestamp with time zone,
	"requests_used" integer DEFAULT 0 NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"input_tokens_used" bigint DEFAULT 0 NOT NULL,
	"output_tokens_used" bigint DEFAULT 0 NOT NULL,
	"cost_micros_used" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"event_id" varchar(64) PRIMARY KEY NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" varchar(20) DEFAULT 'APPLIED' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_key" varchar(20) NOT NULL,
	"status" "subscription_status_enum" DEFAULT 'ACTIVE' NOT NULL,
	"source" "subscription_source_enum" DEFAULT 'PADDLE' NOT NULL,
	"paddle_subscription_id" varchar(64),
	"paddle_customer_id" varchar(64),
	"paddle_price_id" varchar(64),
	"billing_cycle" varchar(10),
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"grace_until" timestamp with time zone,
	"last_event_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_version_id_form_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."form_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_submission_id_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_respondent_challenges" ADD CONSTRAINT "form_respondent_challenges_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_views" ADD CONSTRAINT "form_views_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_windows" ADD CONSTRAINT "ai_usage_windows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forms_created_by_status_idx" ON "forms" USING btree ("created_by","status");--> statement-breakpoint
CREATE INDEX "forms_status_closes_idx" ON "forms" USING btree ("status","closes_at");--> statement-breakpoint
CREATE INDEX "forms_status_activity_idx" ON "forms" USING btree ("status","last_activity_at");--> statement-breakpoint
CREATE UNIQUE INDEX "form_versions_form_version_idx" ON "form_versions" USING btree ("form_id","version");--> statement-breakpoint
CREATE INDEX "form_submissions_form_created_idx" ON "form_submissions" USING btree ("form_id","created_at");--> statement-breakpoint
CREATE INDEX "form_submissions_version_idx" ON "form_submissions" USING btree ("version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "form_submissions_email_key_idx" ON "form_submissions" USING btree ("form_id","email_key");--> statement-breakpoint
CREATE UNIQUE INDEX "form_submissions_idempotency_idx" ON "form_submissions" USING btree ("form_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "file_uploads_status_created_idx" ON "file_uploads" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "file_uploads_form_status_idx" ON "file_uploads" USING btree ("form_id","status");--> statement-breakpoint
CREATE INDEX "file_uploads_owner_idx" ON "file_uploads" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "file_uploads_actor_status_idx" ON "file_uploads" USING btree ("actor_key","status");--> statement-breakpoint
CREATE INDEX "file_uploads_submission_idx" ON "file_uploads" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "email_verification_user_created_idx" ON "email_verification_tokens" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "form_respondent_challenges_form_email_idx" ON "form_respondent_challenges" USING btree ("form_id","email","created_at");--> statement-breakpoint
CREATE INDEX "form_respondent_challenges_form_nonce_idx" ON "form_respondent_challenges" USING btree ("form_id","nonce");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_requests_user_request_uq" ON "ai_requests" USING btree ("user_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_requests_one_in_flight_per_user_uq" ON "ai_requests" USING btree ("user_id") WHERE status = 'IN_PROGRESS';--> statement-breakpoint
CREATE INDEX "ai_requests_user_created_idx" ON "ai_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_requests_created_idx" ON "ai_requests" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_windows_user_feature_uq" ON "ai_usage_windows" USING btree ("user_id","feature");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_uq" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_paddle_sub_uq" ON "subscriptions" USING btree ("paddle_subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_customer_idx" ON "subscriptions" USING btree ("paddle_customer_id");