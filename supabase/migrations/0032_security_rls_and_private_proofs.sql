-- 0032_security_rls_and_private_proofs.sql
-- Auditoría de seguridad 2026-07-24.

-- (1) order_branch_counters: faltaba RLS. Sin políticas, la clave anon no ve
--     nada; el trigger que asigna el correlativo corre con service role y se
--     salta RLS, así que la operación normal NO se ve afectada.
alter table order_branch_counters enable row level security;

-- (2) Bucket payment-proofs a PRIVADO. Los comprobantes dejan de ser legibles
--     por URL pública; el panel los mostrará con URLs firmadas (ver Paso 2 de
--     SEGURIDAD-RLS-Y-COMPROBANTES.md). menu-images se deja público a propósito.
update storage.buckets
   set public = false
 where id = 'payment-proofs';
