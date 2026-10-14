-- AlterTable
ALTER TABLE "card_purchases" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Outros';

-- AlterTable
ALTER TABLE "debit_transactions" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Outros';
ALTER TABLE "debit_transactions" ADD COLUMN "recurring_id" UUID;

-- AlterTable
ALTER TABLE "income_transactions" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Outros';
ALTER TABLE "income_transactions" ADD COLUMN "recurring_id" UUID;

-- CreateTable
CREATE TABLE "recurring_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Outros',
    "day_of_month" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_budgets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "statement_month" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_transactions_user_id_idx" ON "recurring_transactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_budgets_user_id_statement_month_key" ON "monthly_budgets"("user_id", "statement_month");

-- AddForeignKey
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_budgets" ADD CONSTRAINT "monthly_budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
