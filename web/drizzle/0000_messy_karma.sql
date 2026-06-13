CREATE TYPE "public"."user_role" AS ENUM('admin', 'planner', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('Planning', 'Active', 'On Hold', 'Completed');--> statement-breakpoint
CREATE TABLE "allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"hours_per_week" numeric NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"status" "project_status" DEFAULT 'Planning' NOT NULL,
	"priority" integer DEFAULT 2 NOT NULL,
	"color" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"manager" text,
	"budget" numeric,
	"tags" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"team" text NOT NULL,
	"capacity" numeric NOT NULL,
	"day_rate" numeric,
	"avatar_url" text,
	"tags" text[] DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;