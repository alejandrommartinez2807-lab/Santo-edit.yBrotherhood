-- ============================================================
-- Concepto La Granja · Productos destacados + color propio del micrositio
-- Migración: 0018_microsite_products
--
-- Cada local puede mostrar sus productos/servicios con precio e imagen en su
-- mini-web (/tienda/<slug>) y definir un color de acento para que cada sitio
-- tenga identidad propia (si está vacío, se usa el color del rubro).
-- (idempotente: add column if not exists)
-- ============================================================

alter table units add column if not exists featured_products jsonb not null default '[]'::jsonb; -- [{name, price, image, description}]
alter table units add column if not exists accent_color      text  not null default '';          -- color de acento del micrositio (#rrggbb)
