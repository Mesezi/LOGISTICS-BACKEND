/*
  Warnings:

  - You are about to drop the column `mode_note` on the `expenses` table. All the data in the column will be lost.
  - You are about to drop the column `mode_note` on the `payments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "expenses" DROP COLUMN "mode_note",
ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "payments"
RENAME COLUMN "mode_note" TO "bank_name";

ALTER TABLE "payments"
ADD COLUMN "note" TEXT;
