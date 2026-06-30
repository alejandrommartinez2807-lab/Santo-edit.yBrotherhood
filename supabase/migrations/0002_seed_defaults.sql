-- ============================================================
-- Santo Edit · Semilla de datos por defecto (Fase 0)
-- Migración: 0002_seed_defaults
-- Mesas iniciales + fila única de configuración del negocio.
-- Idempotente: se puede correr varias veces sin duplicar.
-- ============================================================

-- Mesas por defecto (coinciden con DEFAULT_LOCAL_TABLES) --------
insert into tables (id, name, area, sort_order, is_active) values
  ('mesa-1', 'Mesa 1', 'Principal', 1, true),
  ('mesa-2', 'Mesa 2', 'Principal', 2, true),
  ('mesa-3', 'Mesa 3', 'Principal', 3, true),
  ('mesa-4', 'Mesa 4', 'Principal', 4, true),
  ('barra',  'Barra',  'Barra',     5, true),
  ('afuera', 'Afuera', 'Exterior',  6, true)
on conflict (id) do nothing;

-- Fila única de configuración (se rellena luego desde el panel) -
insert into business_config (id, config) values (1, '{}'::jsonb)
on conflict (id) do nothing;
