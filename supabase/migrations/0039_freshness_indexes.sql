-- 0039_freshness_indexes.sql
-- OPCIONAL (micro-optimización, 2026-08-04). La huella barata de los sondeos
-- pide en cada tick "count + max(timestamp)" sobre orders, open_accounts y
-- payment_proofs. Con las tablas de hoy (cientos de filas) el escaneo
-- secuencial es irrelevante; estos índices son para cuando crezcan.
--
-- No cambia ningún comportamiento: solo velocidad de esas consultas.
-- Es idempotente: correrlo dos veces no rompe ni duplica nada.

-- /api/orders · frescura por sede y consolidado (branch_id null)
create index if not exists idx_orders_branch_updated
  on orders (branch_id, updated_at desc);
create index if not exists idx_orders_updated
  on orders (updated_at desc);

-- /api/open-accounts · frescura de cuentas + superconjunto de pedidos anclados
create index if not exists idx_open_accounts_branch_updated
  on open_accounts (branch_id, updated_at desc);
create index if not exists idx_orders_attached_updated
  on orders (branch_id, updated_at desc)
  where open_account_id is not null;

-- /api/payment-proofs · frescura por creación y por revisión
create index if not exists idx_payment_proofs_branch_created
  on payment_proofs (branch_id, created_at desc);
create index if not exists idx_payment_proofs_branch_reviewed
  on payment_proofs (branch_id, reviewed_at desc)
  where reviewed_at is not null;
