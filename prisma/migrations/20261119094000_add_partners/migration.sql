CREATE TABLE "partners" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

INSERT INTO "partners" ("account_id", "name", "updated_at")
SELECT "account_id", MIN(BTRIM("partner_name")), CURRENT_TIMESTAMP
FROM "jobs"
WHERE "partner_name" IS NOT NULL
  AND BTRIM("partner_name") <> ''
GROUP BY "account_id", LOWER(BTRIM("partner_name"));

ALTER TABLE "jobs"
ADD COLUMN "partner_id" INTEGER;

UPDATE "jobs" j
SET "partner_id" = p."id"
FROM "partners" p
WHERE j."account_id" = p."account_id"
  AND j."partner_name" IS NOT NULL
  AND LOWER(BTRIM(j."partner_name")) = LOWER(p."name");

CREATE UNIQUE INDEX "partners_account_id_name_key"
ON "partners"("account_id", "name");

CREATE UNIQUE INDEX "partners_account_id_normalized_name_key"
ON "partners"("account_id", LOWER(BTRIM("name")));

CREATE INDEX "partners_account_id_active_name_idx"
ON "partners"("account_id", "active", "name");

CREATE INDEX "jobs_partner_id_idx"
ON "jobs"("partner_id");

ALTER TABLE "partners"
ADD CONSTRAINT "partners_account_id_fkey"
FOREIGN KEY ("account_id") REFERENCES "accounts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "jobs"
ADD CONSTRAINT "jobs_partner_id_fkey"
FOREIGN KEY ("partner_id") REFERENCES "partners"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
