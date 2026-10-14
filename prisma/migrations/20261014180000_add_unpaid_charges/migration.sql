-- CreateTable
CREATE TABLE "unpaid_charges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "statement_month" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unpaid_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "unpaid_charges_user_id_idx" ON "unpaid_charges"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "unpaid_charges_user_id_source_type_source_id_key" ON "unpaid_charges"("user_id", "source_type", "source_id");

-- AddForeignKey
ALTER TABLE "unpaid_charges" ADD CONSTRAINT "unpaid_charges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
