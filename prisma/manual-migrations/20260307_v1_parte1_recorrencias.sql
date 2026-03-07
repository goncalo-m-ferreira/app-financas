-- V1 Parte 1 - Fundação de recorrências (PostgreSQL, aditivo)
-- Gerado a partir de diff entre schema base e schema com recorrências.
-- Não inclui reset/destruição de dados existentes.

-- CreateEnum
CREATE TYPE "RecurringRuleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "RecurringEndMode" AS ENUM ('NONE', 'UNTIL_DATE', 'MAX_OCCURRENCES');

-- CreateEnum
CREATE TYPE "RecurringExecutionStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RecurringErrorType" AS ENUM ('STRUCTURAL', 'TRANSIENT');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RECURRING';

-- AlterTable
ALTER TABLE "transactions"
ADD COLUMN "recurring_execution_id" TEXT,
ADD COLUMN "recurring_rule_id" TEXT;

-- CreateTable
CREATE TABLE "recurring_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "category_id" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "is_subscription" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "next_run_at" TIMESTAMP(3),
    "anchor_day_of_month" INTEGER,
    "anchor_weekday" INTEGER,
    "anchor_month_of_year" INTEGER,
    "anchor_minute_of_day" INTEGER NOT NULL,
    "is_last_day_anchor" BOOLEAN NOT NULL DEFAULT false,
    "end_mode" "RecurringEndMode" NOT NULL DEFAULT 'NONE',
    "end_at" TIMESTAMP(3),
    "max_occurrences" INTEGER,
    "occurrences_generated" INTEGER NOT NULL DEFAULT 0,
    "status" "RecurringRuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "paused_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "last_successful_run_at" TIMESTAMP(3),
    "last_failure_at" TIMESTAMP(3),
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_executions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" "RecurringExecutionStatus" NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "attempted_at" TIMESTAMP(3),
    "error_type" "RecurringErrorType",
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_rules_user_id_status_next_run_at_idx" ON "recurring_rules"("user_id", "status", "next_run_at");

-- CreateIndex
CREATE INDEX "recurring_rules_user_id_created_at_idx" ON "recurring_rules"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_rules_user_id_id_key" ON "recurring_rules"("user_id", "id");

-- CreateIndex
CREATE INDEX "recurring_executions_user_id_created_at_idx" ON "recurring_executions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "recurring_executions_user_id_status_created_at_idx" ON "recurring_executions"("user_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_executions_user_id_id_key" ON "recurring_executions"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_executions_rule_id_scheduled_for_key" ON "recurring_executions"("rule_id", "scheduled_for");

-- CreateIndex
CREATE INDEX "transactions_user_id_recurring_rule_id_transaction_date_idx" ON "transactions"("user_id", "recurring_rule_id", "transaction_date");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_user_id_recurring_execution_id_key" ON "transactions"("user_id", "recurring_execution_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_recurring_rule_id_fkey" FOREIGN KEY ("user_id", "recurring_rule_id") REFERENCES "recurring_rules"("user_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_recurring_execution_id_fkey" FOREIGN KEY ("user_id", "recurring_execution_id") REFERENCES "recurring_executions"("user_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_user_id_wallet_id_fkey" FOREIGN KEY ("user_id", "wallet_id") REFERENCES "wallets"("user_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_user_id_category_id_fkey" FOREIGN KEY ("user_id", "category_id") REFERENCES "expense_categories"("user_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recurring_executions" ADD CONSTRAINT "recurring_executions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_executions" ADD CONSTRAINT "recurring_executions_user_id_rule_id_fkey" FOREIGN KEY ("user_id", "rule_id") REFERENCES "recurring_rules"("user_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
