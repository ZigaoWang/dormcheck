CREATE TYPE "public"."check_type" AS ENUM('morning', 'evening', 'studyhall', 'tech_handin');--> statement-breakpoint
CREATE TYPE "public"."device_exemption_type" AS ENUM('phone', 'laptop', 'ipad');--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "checkins_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"student_id" text NOT NULL,
	"uid" text,
	"name" text NOT NULL,
	"grade" integer NOT NULL,
	"temperature" real,
	"check_type" "check_type" NOT NULL,
	"is_late" boolean DEFAULT false NOT NULL,
	"is_fever" boolean DEFAULT false NOT NULL,
	"device_id" text,
	"photo_url" text,
	"phone_handed_in" boolean,
	"laptop_handed_in" boolean,
	"ipad_handed_in" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config" (
	"house" text PRIMARY KEY NOT NULL,
	"fever_threshold" real DEFAULT 37.3 NOT NULL,
	"late_grace_minutes" integer DEFAULT 5 NOT NULL,
	"morning_start" time DEFAULT '06:30' NOT NULL,
	"morning_end" time DEFAULT '08:00' NOT NULL,
	"morning_deadline_junior" time DEFAULT '07:15' NOT NULL,
	"morning_deadline_senior" time DEFAULT '07:30' NOT NULL,
	"studyhall_end" time DEFAULT '19:15' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_exemptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "device_exemptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"student_id" text NOT NULL,
	"device_type" "device_exemption_type" NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"house" text,
	"api_key" text NOT NULL,
	"last_seen" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "devices_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "lockers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lockers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"student_id" text NOT NULL,
	"has_phone" boolean DEFAULT true NOT NULL,
	"has_laptop" boolean DEFAULT true NOT NULL,
	"has_ipad" boolean DEFAULT false NOT NULL,
	"house" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lockers_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"student_id" text PRIMARY KEY NOT NULL,
	"uid" text,
	"name" text NOT NULL,
	"grade" integer NOT NULL,
	"house" text,
	"expected_morning_time" time DEFAULT '07:30' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "students_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"house" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_student_id_students_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_exemptions" ADD CONSTRAINT "device_exemptions_student_id_students_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lockers" ADD CONSTRAINT "lockers_student_id_students_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkins_created_at_idx" ON "checkins" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "checkins_student_id_idx" ON "checkins" USING btree ("student_id");