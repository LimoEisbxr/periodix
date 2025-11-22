-- CreateTable
CREATE TABLE "public"."ClassTimetableCache" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "classId" INTEGER NOT NULL,
    "rangeStart" TIMESTAMP(3),
    "rangeEnd" TIMESTAMP(3),
    "payload" JSONB NOT NULL,

    CONSTRAINT "ClassTimetableCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassTimetableCache_classId_createdAt_idx" ON "public"."ClassTimetableCache"("classId", "createdAt");

-- CreateIndex
CREATE INDEX "ClassTimetableCache_classId_rangeStart_rangeEnd_createdAt_idx" ON "public"."ClassTimetableCache"("classId", "rangeStart", "rangeEnd", "createdAt");
