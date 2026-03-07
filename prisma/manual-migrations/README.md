# Prisma migration note (safe path)

## Current diagnosis
- `prisma/schema.prisma` and runtime are configured for PostgreSQL.
- `prisma/migrations/migration_lock.toml` still points to `sqlite`.
- Because of this mismatch, `prisma migrate` history is not in a reliable baseline state.

## What is safe in this phase
- Use only additive SQL scripts in `prisma/manual-migrations/`.
- Avoid destructive operations (`reset`, drop/recreate, migration history rewrites).

## Recommended normalization path (dedicated PR)
1. Backup production/staging database.
2. Create a clean PostgreSQL baseline migration history from current live schema.
3. Move/archive legacy SQLite migration artifacts outside `prisma/migrations`.
4. Align `migration_lock.toml` provider with PostgreSQL.
5. Validate with `prisma migrate diff` to confirm zero drift.

This project phase implements only additive SQL steps to avoid any data-loss risk.
