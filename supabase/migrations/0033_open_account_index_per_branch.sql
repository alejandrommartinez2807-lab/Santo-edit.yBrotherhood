-- 0033_open_account_index_per_branch.sql
-- Auditoría 2026-07-24 (R1 cuentas abiertas): el índice único "una cuenta
-- abierta por mesa" NO estaba separado por sede, así que si San Diego y Viñedo
-- tienen ambas una "Mesa 1", la segunda no podía abrir cuenta (colisión entre
-- sedes). Se recrea el índice incluyendo branch_id.

drop index if exists uq_open_account_per_table;

create unique index if not exists uq_open_account_per_table_branch
  on open_accounts (branch_id, table_number)
  where status = 'Abierta';
