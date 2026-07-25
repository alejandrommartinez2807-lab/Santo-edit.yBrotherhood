-- 0034 · Seguridad (auditoría 2026-07-24, hallazgo A3)
-- supplier_purchase_payments (abonos a proveedores) era la ÚNICA tabla del
-- esquema sin Row Level Security: quedó fuera del barrido de la migración
-- 0032. Con RLS activo y sin políticas, el rol anon/authenticated no puede
-- leer ni escribir; la app no se ve afectada porque el servidor usa la
-- service key (bypasea RLS), igual que el resto de tablas.

alter table supplier_purchase_payments enable row level security;
