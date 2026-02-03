-- CreateTable
CREATE TABLE "card_loans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "borrower_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "loan_date" DATE NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_loans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "card_loans_user_id_idx" ON "card_loans"("user_id");

-- CreateIndex
CREATE INDEX "card_loans_card_id_idx" ON "card_loans"("card_id");

-- CreateIndex
CREATE INDEX "card_loans_borrower_name_idx" ON "card_loans"("borrower_name");

-- AddForeignKey
ALTER TABLE "card_loans" ADD CONSTRAINT "card_loans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_loans" ADD CONSTRAINT "card_loans_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
