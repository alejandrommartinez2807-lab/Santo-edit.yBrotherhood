-- 0035 · Cuentas abiertas: índice único por mesa NORMALIZADO (auditoría
-- 2026-07-24, H14). El índice de la 0033 comparaba table_number en crudo,
-- pero la app busca la cuenta con texto normalizado (sin mayúsculas ni
-- espacios extra): "Mesa 1" y "mesa 1" convivían como DOS cuentas Abiertas de
-- la misma mesa y el pedido caía en la que apareciera primero.
-- Nota: si este índice falla por duplicados existentes ("Mesa 1"/"mesa 1"
-- abiertas a la vez), cierra una de las dos cuentas y reintenta.

drop index if exists uq_open_account_per_table_branch;

create unique index if not exists uq_open_account_per_table_branch
  on open_accounts (branch_id, lower(trim(table_number)))
  where status = 'Abierta';
