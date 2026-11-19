/*
  Warnings:

  - Made the column `account_id` on table `audit_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `account_id` on table `clients` required. This step will fail if there are existing NULL values in that column.
  - Made the column `account_id` on table `expenses` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `invited_by_id` to the `invitations` table without a default value. This is not possible if the table is not empty.
  - Made the column `account_id` on table `invitations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `account_id` on table `jobs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `account_id` on table `riders` required. This step will fail if there are existing NULL values in that column.
  - Made the column `account_id` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_account_id_fkey";

-- DropForeignKey
ALTER TABLE "clients" DROP CONSTRAINT "clients_account_id_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_account_id_fkey";

-- DropForeignKey
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_account_id_fkey";

-- DropForeignKey
ALTER TABLE "riders" DROP CONSTRAINT "riders_account_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_account_id_fkey";

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "image_url" TEXT;

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "account_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "account_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "expenses" ALTER COLUMN "account_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "accepted_at" TIMESTAMP(3),
ADD COLUMN     "invited_by_id" INTEGER NOT NULL,
ALTER COLUMN "account_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "jobs" ALTER COLUMN "account_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "riders" ALTER COLUMN "account_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "account_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "audit_logs_account_id_created_at_idx" ON "audit_logs"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_table_name_record_id_idx" ON "audit_logs"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "clients_account_id_name_idx" ON "clients"("account_id", "name");

-- CreateIndex
CREATE INDEX "expenses_account_id_expense_date_idx" ON "expenses"("account_id", "expense_date");

-- CreateIndex
CREATE INDEX "expenses_job_id_idx" ON "expenses"("job_id");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_account_id_status_idx" ON "invitations"("account_id", "status");

-- CreateIndex
CREATE INDEX "jobs_account_id_job_date_idx" ON "jobs"("account_id", "job_date");

-- CreateIndex
CREATE INDEX "jobs_account_id_status_idx" ON "jobs"("account_id", "status");

-- CreateIndex
CREATE INDEX "jobs_client_id_idx" ON "jobs"("client_id");

-- CreateIndex
CREATE INDEX "jobs_rider_id_idx" ON "jobs"("rider_id");

-- CreateIndex
CREATE INDEX "payments_job_id_idx" ON "payments"("job_id");

-- CreateIndex
CREATE INDEX "riders_account_id_idx" ON "riders"("account_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riders" ADD CONSTRAINT "riders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
