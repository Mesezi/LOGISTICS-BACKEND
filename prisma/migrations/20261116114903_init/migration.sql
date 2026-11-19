-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'picked_up', 'delivered', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('payment', 'refund');

-- CreateEnum
CREATE TYPE "PayMode" AS ENUM ('cash', 'transfer');

-- CreateEnum
CREATE TYPE "ExpenseOwner" AS ENUM ('rider', 'office', 'client');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'staff');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "clerk_id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "image_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'staff',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riders" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "rider_id" INTEGER,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "pickup" TEXT NOT NULL,
    "dropoff" TEXT NOT NULL,
    "description" TEXT,
    "job_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "office_fee" INTEGER NOT NULL,
    "sublet_name" TEXT,
    "sublet_amount" INTEGER NOT NULL DEFAULT 0,
    "park_waybill" INTEGER NOT NULL DEFAULT 0,
    "partner_name" TEXT,
    "partner_amount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "type" "PaymentType" NOT NULL DEFAULT 'payment',
    "amount" INTEGER NOT NULL,
    "mode" "PayMode" NOT NULL,
    "mode_note" TEXT,
    "reference" TEXT,
    "paid_at" DATE NOT NULL DEFAULT CURRENT_DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expense_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "mode" "PayMode" NOT NULL,
    "mode_note" TEXT,
    "owner" "ExpenseOwner" NOT NULL,
    "rider_id" INTEGER,
    "client_id" INTEGER,
    "job_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" INTEGER NOT NULL,
    "action" "AuditAction" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users"("clerk_id");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riders" ADD CONSTRAINT "riders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


--RULES

-- jobs
ALTER TABLE jobs
  ADD CONSTRAINT jobs_amounts_non_negative CHECK (
    office_fee >= 0 AND sublet_amount >= 0 AND park_waybill >= 0
    AND partner_amount >= 0 AND total >= 0),

  ADD CONSTRAINT jobs_total_is_sum CHECK (
    total = office_fee + sublet_amount + park_waybill + partner_amount),

  ADD CONSTRAINT jobs_sublet_pair CHECK (
    (sublet_name IS NULL AND sublet_amount = 0)
    OR (sublet_name IS NOT NULL AND sublet_amount > 0)),

  ADD CONSTRAINT jobs_partner_pair CHECK (
    (partner_name IS NULL AND partner_amount = 0)
    OR (partner_name IS NOT NULL AND partner_amount > 0)),

  ADD CONSTRAINT jobs_rider_or_sublet CHECK (
    rider_id IS NULL OR sublet_amount = 0);

-- payments
ALTER TABLE payments
  ADD CONSTRAINT payments_amount_positive CHECK (amount > 0),
  ADD CONSTRAINT payments_transfer_needs_bank CHECK (
    mode = 'cash' OR mode_note IS NOT NULL);

-- expenses
ALTER TABLE expenses
  ADD CONSTRAINT expenses_amount_positive CHECK (amount > 0),
  ADD CONSTRAINT expenses_transfer_needs_bank CHECK (
    mode = 'cash' OR mode_note IS NOT NULL),
  ADD CONSTRAINT expenses_owner_matches CHECK (
    (owner = 'rider'  AND rider_id IS NOT NULL AND client_id IS NULL)
    OR (owner = 'client' AND client_id IS NOT NULL AND rider_id IS NULL)
    OR (owner = 'office' AND rider_id IS NULL AND client_id IS NULL));

-- amount received per job (payments minus refunds)
CREATE VIEW job_balances AS
SELECT j.id AS job_id,
       j.total,
       COALESCE(SUM(CASE WHEN p.type = 'payment' THEN p.amount
                         WHEN p.type = 'refund'  THEN -p.amount END), 0)::int AS received
FROM jobs j
LEFT JOIN payments p ON p.job_id = j.id
GROUP BY j.id, j.total;