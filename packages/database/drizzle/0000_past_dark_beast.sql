CREATE TYPE "public"."form_status_enum" AS ENUM('DRAFT', 'PUBLISHED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."form_submission_access_enum" AS ENUM('ANYONE', 'ACCESS_CODE', 'AUTHENTICATED_ONLY');--> statement-breakpoint
CREATE TYPE "public"."form_submission_layout_enum" AS ENUM('ONE_AT_A_TIME', 'ALL_AT_ONCE');--> statement-breakpoint
CREATE TYPE "public"."form_template_enum" AS ENUM('CORPORATE', 'SURVEY', 'EDUCATION', 'DEVELOPER', 'RETRO', 'INVITATION', 'TICKET', 'LANDING', 'CLASSIC');--> statement-breakpoint
CREATE TYPE "public"."form_visibility_enum" AS ENUM('PUBLIC', 'UNLISTED');--> statement-breakpoint
CREATE TYPE "public"."field_type_enum" AS ENUM('TEXT', 'EMAIL', 'NUMBER', 'YES_NO', 'PASSWORD', 'LONG_TEXT', 'DROPDOWN', 'MULTI_SELECT', 'CHECKBOX_GROUP', 'DATE', 'RATING');--> statement-breakpoint
CREATE TYPE "public"."oauth_provider" AS ENUM('google');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text,
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
	"visibility" "form_visibility_enum" DEFAULT 'PUBLIC' NOT NULL,
	"submission_access" "form_submission_access_enum" DEFAULT 'ANYONE' NOT NULL,
	"template" "form_template_enum" DEFAULT 'CLASSIC' NOT NULL,
	"submission_layout" "form_submission_layout_enum" DEFAULT 'ONE_AT_A_TIME' NOT NULL,
	"access_code" varchar(12),
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
CREATE TABLE "form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid,
	"submitted_by" uuid,
	"values" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
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
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "oauth_provider_account_unique" UNIQUE("provider","provider_account_id")
);
--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;