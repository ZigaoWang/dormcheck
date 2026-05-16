-- Add tech_handin to check_type enum
ALTER TYPE "check_type" ADD VALUE IF NOT EXISTS 'tech_handin';

-- Add photo_url column to checkins
ALTER TABLE "checkins" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;

-- Create lockers table
CREATE TABLE IF NOT EXISTS "lockers" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "student_id" text NOT NULL UNIQUE REFERENCES "students"("student_id"),
  "has_phone" boolean NOT NULL DEFAULT true,
  "has_laptop" boolean NOT NULL DEFAULT true,
  "has_ipad" boolean NOT NULL DEFAULT false,
  "house" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
