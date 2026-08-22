/*
  Warnings:

  - You are about to drop the column `gross_pay` on the `payroll_run_item_branches` table. All the data in the column will be lost.
  - Added the required column `net_pay` to the `payroll_run_item_branches` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "payroll_run_item_branches" DROP COLUMN "gross_pay",
ADD COLUMN     "net_pay" DECIMAL(12,2) NOT NULL;
