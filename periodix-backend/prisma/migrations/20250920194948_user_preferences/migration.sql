-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "hiddenSubjects" JSONB,
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
