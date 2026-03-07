-- V1 alinhamento semântico final: suporte a frequência DAILY.
-- Migration aditiva e segura para PostgreSQL.

ALTER TYPE "RecurringFrequency" ADD VALUE IF NOT EXISTS 'DAILY';
