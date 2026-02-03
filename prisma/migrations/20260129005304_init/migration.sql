-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('open', 'paid');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "credit_limit" DECIMAL(12,2) NOT NULL,
    "closing_day" INTEGER NOT NULL,
    "due_day" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_purchases" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount_total" DECIMAL(12,2) NOT NULL,
    "purchase_date" DATE NOT NULL,
    "installments" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_installments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "statement_month" DATE NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_payments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "statement_month" DATE NOT NULL,
    "payment_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'other',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_payment_allocations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "installment_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debit_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "cards_user_id_idx" ON "cards"("user_id");

-- CreateIndex
CREATE INDEX "card_purchases_user_id_idx" ON "card_purchases"("user_id");

-- CreateIndex
CREATE INDEX "card_purchases_card_id_idx" ON "card_purchases"("card_id");

-- CreateIndex
CREATE INDEX "card_purchases_purchase_date_idx" ON "card_purchases"("purchase_date");

-- CreateIndex
CREATE INDEX "card_installments_user_id_idx" ON "card_installments"("user_id");

-- CreateIndex
CREATE INDEX "card_installments_card_id_idx" ON "card_installments"("card_id");

-- CreateIndex
CREATE INDEX "card_installments_statement_month_idx" ON "card_installments"("statement_month");

-- CreateIndex
CREATE UNIQUE INDEX "card_installments_purchase_id_installment_number_key" ON "card_installments"("purchase_id", "installment_number");

-- CreateIndex
CREATE INDEX "card_payments_user_id_idx" ON "card_payments"("user_id");

-- CreateIndex
CREATE INDEX "card_payments_card_id_idx" ON "card_payments"("card_id");

-- CreateIndex
CREATE INDEX "card_payments_statement_month_idx" ON "card_payments"("statement_month");

-- CreateIndex
CREATE INDEX "card_payment_allocations_user_id_idx" ON "card_payment_allocations"("user_id");

-- CreateIndex
CREATE INDEX "card_payment_allocations_payment_id_idx" ON "card_payment_allocations"("payment_id");

-- CreateIndex
CREATE INDEX "card_payment_allocations_installment_id_idx" ON "card_payment_allocations"("installment_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_payment_allocations_payment_id_installment_id_key" ON "card_payment_allocations"("payment_id", "installment_id");

-- CreateIndex
CREATE INDEX "debit_transactions_user_id_idx" ON "debit_transactions"("user_id");

-- CreateIndex
CREATE INDEX "debit_transactions_date_idx" ON "debit_transactions"("date");

-- CreateIndex
CREATE INDEX "income_transactions_user_id_idx" ON "income_transactions"("user_id");

-- CreateIndex
CREATE INDEX "income_transactions_date_idx" ON "income_transactions"("date");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_purchases" ADD CONSTRAINT "card_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_purchases" ADD CONSTRAINT "card_purchases_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_installments" ADD CONSTRAINT "card_installments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_installments" ADD CONSTRAINT "card_installments_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_installments" ADD CONSTRAINT "card_installments_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "card_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_payments" ADD CONSTRAINT "card_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_payments" ADD CONSTRAINT "card_payments_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_payment_allocations" ADD CONSTRAINT "card_payment_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_payment_allocations" ADD CONSTRAINT "card_payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "card_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_payment_allocations" ADD CONSTRAINT "card_payment_allocations_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "card_installments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_transactions" ADD CONSTRAINT "debit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_transactions" ADD CONSTRAINT "income_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
