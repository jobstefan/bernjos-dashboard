/*
  Warnings:

  - You are about to drop the column `notes` on the `incentives` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "incentives" DROP COLUMN "notes",
ALTER COLUMN "reason" DROP NOT NULL;
