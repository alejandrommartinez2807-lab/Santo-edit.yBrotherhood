-- ============================================================
-- Santo Edit · Envío por distancia (Google Maps + km)
-- Migración: 0024_delivery_distance
--
-- El cliente pega su link de Google Maps (o comparte su GPS) y el costo del
-- delivery se calcula por kilómetros desde la sede, con tarifas por rango
-- ("hasta 10 km → $6"). Una fila de configuración por sucursal; si una sede
-- no tiene fila propia, hereda la de la sucursal principal (se resuelve en
-- código, igual que el menú por sede).
-- ============================================================

create table if not exists delivery_distance_settings (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id) on delete cascade,
  enabled         boolean not null default false,
  -- Link de Google Maps del local (lo pega el dueño en Configuración).
  origin_maps_url text not null default '',
  origin_lat      double precision,
  origin_lng      double precision,
  -- La distancia se mide en línea recta; este factor compensa la ruta real.
  road_factor     numeric not null default 1.3,
  -- Tarifas por rango: [{"upToKm": 3, "costUSD": 2}, {"upToKm": 10, "costUSD": 6}]
  tiers           jsonb not null default '[]'::jsonb,
  updated_at      timestamptz not null default now()
);

alter table delivery_distance_settings enable row level security;

-- Una sola fila por sucursal (branch_id null = configuración global/heredable).
create unique index if not exists uq_delivery_distance_settings_branch
  on delivery_distance_settings (coalesce(branch_id::text, 'global'));

create index if not exists idx_delivery_distance_settings_branch
  on delivery_distance_settings (branch_id);
