-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" TEXT,
    "full_name" TEXT,
    "country" VARCHAR(2),
    "kyc_status" TEXT NOT NULL DEFAULT 'PENDING',
    "kyc_provider_id" TEXT,
    "kyc_approved_at" TIMESTAMP(3),
    "tier" TEXT NOT NULL DEFAULT 'BASIC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipients" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "bank_name" TEXT,
    "sort_code" VARCHAR(6) NOT NULL,
    "account_number" VARCHAR(8) NOT NULL,
    "country" VARCHAR(2) NOT NULL DEFAULT 'GB',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "send_currency" VARCHAR(3) NOT NULL,
    "receive_currency" VARCHAR(3) NOT NULL,
    "send_amount" DECIMAL(18,2) NOT NULL,
    "receive_amount" DECIMAL(18,2) NOT NULL,
    "mid_market_rate" DECIMAL(18,8) NOT NULL,
    "applied_rate" DECIMAL(18,8) NOT NULL,
    "spread_pct" DECIMAL(5,4) NOT NULL,
    "flat_fee" DECIMAL(18,2) NOT NULL,
    "total_fee" DECIMAL(18,2) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "send_amount" DECIMAL(18,2) NOT NULL,
    "send_currency" VARCHAR(3) NOT NULL,
    "receive_amount" DECIMAL(18,2) NOT NULL,
    "receive_currency" VARCHAR(3) NOT NULL,
    "fee_amount" DECIMAL(18,2) NOT NULL,
    "applied_rate" DECIMAL(18,8) NOT NULL,
    "payment_method" TEXT,
    "payment_provider_id" TEXT,
    "fiat_received_at" TIMESTAMP(3),
    "usdc_amount" DECIMAL(18,6),
    "blockchain_network" TEXT DEFAULT 'solana',
    "blockchain_tx_hash" TEXT,
    "blockchain_fee" DECIMAL(18,6),
    "settled_at" TIMESTAMP(3),
    "otc_provider" TEXT,
    "otc_reference" TEXT,
    "gbp_received" DECIMAL(18,2),
    "converted_at" TIMESTAMP(3),
    "payout_provider" TEXT,
    "payout_reference" TEXT,
    "payout_initiated_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "failure_step" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_status_log" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "triggered_by" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_status_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "balance" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "journal_id" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "entry_type" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_code_key" ON "ledger_accounts"("code");

-- AddForeignKey
ALTER TABLE "recipients" ADD CONSTRAINT "recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "recipients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_status_log" ADD CONSTRAINT "transaction_status_log_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_code_fkey" FOREIGN KEY ("account_code") REFERENCES "ledger_accounts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
