-- ============================================================
-- Santo Edit · Caja: cierres y gastos (Fase 3d)
-- Migración: 0006_caja
--
-- Recrea day_closes y day_expenses con id de texto + payload JSONB (igual
-- patrón que inventario). Estaban vacías en Supabase (nunca se usaron).
-- Los comprobantes (payment_proofs) ya calzan con el esquema de la Fase 0,
-- así que no se tocan aquí.
-- ============================================================

drop table if exists day_expenses cascade;
drop table if exists day_closes cascade;

-- Cierres de caja: todo el resumen del día en `data` -----------
create table day_closes (
  id          text primary key,
  created_at  timestamptz not null default now(),
  data        jsonb not null default '{}'::jsonb
);
create index idx_day_closes_created on day_closes (created_at desc);

-- Gastos del día: payload en `data`, con columnas sueltas para filtrar
create table day_expenses (
  id            text primary key,
  created_at    timestamptz not null default now(),
  date_value    text not null default '',
  close_status  text not null default '',
  data          jsonb not null default '{}'::jsonb
);
create index idx_day_expenses_date on day_expenses (date_value);
create index idx_day_expenses_close on day_expenses (close_status);

-- RLS: cerrado (solo servidor con service role key) ------------
alter table day_closes   enable row level security;
alter table day_expenses enable row level security;
