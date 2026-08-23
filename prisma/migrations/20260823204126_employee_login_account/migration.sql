-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "username" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "employees_username_key" ON "employees"("username");

