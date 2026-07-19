-- ============================================================
-- Concepto La Granja · Publicidad y espacios comerciales
-- Migración: 0013_advertising
--
-- Otra fuente de ingreso del mall: alquiler de espacios publicitarios
-- (pantallas LED, vallas, banners, pendones, activaciones en pasillos,
-- publicidad en estacionamiento / redes / web). Cada espacio se reserva por
-- un período con su precio, diseño aprobado y evidencia de instalación.
-- ============================================================

-- Espacios publicitarios disponibles.
--   kind: pantalla | valla | banner | pendon | pasillo | estacionamiento | redes | web | otro
create table if not exists ad_spaces (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id) on delete cascade,
  name          text not null,                 -- "Pantalla LED entrada principal"
  kind          text not null default 'pantalla',
  location      text not null default '',       -- dónde está
  base_price    numeric(12,2) not null default 0, -- precio referencial (por período)
  currency      text not null default 'USD',
  active        boolean not null default true,
  notes         text not null default '',
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_ad_spaces_branch on ad_spaces (branch_id, sort_order);
create trigger trg_ad_spaces_updated before update on ad_spaces
  for each row execute function set_updated_at();

-- Contrataciones de publicidad (reservas de un espacio por período).
--   status: reservado | activo | finalizado | cancelado
create table if not exists ad_bookings (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id) on delete cascade,
  space_id      uuid references ad_spaces(id) on delete cascade,
  client_name   text not null default '',
  client_phone  text not null default '',
  resident_id   uuid references residents(id) on delete set null, -- si es un comerciante del mall
  starts_on     date,
  ends_on       date,
  price         numeric(12,2) not null default 0,
  currency      text not null default 'USD',
  status        text not null default 'reservado',
  design_url    text not null default '',        -- arte aprobado
  proof_url     text not null default '',        -- evidencia de instalación
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_ad_bookings_branch on ad_bookings (branch_id, status);
create index if not exists idx_ad_bookings_space on ad_bookings (space_id, starts_on);
create trigger trg_ad_bookings_updated before update on ad_bookings
  for each row execute function set_updated_at();

-- RLS cerrado por defecto (solo service role del servidor).
alter table ad_spaces   enable row level security;
alter table ad_bookings enable row level security;
