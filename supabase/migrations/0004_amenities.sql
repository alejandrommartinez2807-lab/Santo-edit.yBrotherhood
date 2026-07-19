-- ============================================================
-- Condominios · Amenidades / áreas comunes
-- Migración: 0004_amenities
--
-- Reserva de espacios comunes (salón de fiestas, BBQ, cancha, piscina,
-- coworking) evitando DUPLICIDAD de horario y con cobro opcional que se
-- convierte en un `charge` de la unidad (concept = reserva_amenidad).
--
-- QUEJA QUE CORRIGE: "reservas por WhatsApp que se pisan, favoritismo, no se
-- sabe quién pagó el uso". Aquí el calendario es único, el cobro queda en el
-- estado de cuenta y todo tiene bitácora.
--
-- El solape se valida en la capa de aplicación (como en reservations del
-- restaurante y hotel_reservations): aquí persistimos + indexamos.
-- ============================================================

-- ------------------------------------------------------------
-- Amenidades configurables
--   booking_mode: por_franja (slots) | por_dia (día completo)
--   requires_approval: la junta/admin aprueba antes de confirmar.
--   fee: costo de uso (0 = gratis) -> genera charge al confirmar.
--   deposit: depósito reembolsable (garantía por daños).
-- ------------------------------------------------------------
create table if not exists amenities (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid references branches(id) on delete cascade,
  name              text not null,             -- "Salón de fiestas", "Cancha", "BBQ 1"
  description       text not null default '',
  capacity          integer not null default 0,
  booking_mode      text not null default 'por_franja', -- por_franja | por_dia
  open_time         text not null default '08:00',      -- "HH:MM"
  close_time        text not null default '22:00',
  slot_minutes      integer not null default 120,       -- duración de franja (si por_franja)
  max_hours_per_unit integer not null default 0,        -- 0 = sin tope
  requires_approval boolean not null default false,
  fee               numeric(12,2) not null default 0,   -- costo de uso (moneda de cuenta)
  deposit           numeric(12,2) not null default 0,   -- depósito/garantía
  rules             text not null default '',           -- reglamento de uso
  photo_url         text not null default '',
  active            boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_amenities_branch on amenities (branch_id, sort_order);
create trigger trg_amenities_updated before update on amenities
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Bloqueos / mantenimiento de una amenidad (no reservable)
-- ------------------------------------------------------------
create table if not exists amenity_blackouts (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id) on delete cascade,
  amenity_id    uuid references amenities(id) on delete cascade,
  reason        text not null default '',
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  created_by    text not null default '',
  created_at    timestamptz not null default now(),
  constraint amenity_blackouts_range_ck check (ends_at > starts_at)
);
create index if not exists idx_amenity_blackouts on amenity_blackouts (amenity_id, starts_at);

-- ------------------------------------------------------------
-- Reservas de amenidad
--   status: pendiente | confirmada | rechazada | cancelada | completada | no_show
--   charge_id: cargo generado por el uso (si fee > 0).
--   Reserva la crea el residente (portal) o la administración.
-- ------------------------------------------------------------
create table if not exists amenity_reservations (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid references branches(id) on delete cascade,
  amenity_id        uuid references amenities(id) on delete cascade,
  unit_id           uuid references units(id) on delete set null,
  resident_id       uuid references residents(id) on delete set null,
  resident_name     text not null default '',   -- snapshot para listados
  reservation_date  date not null,
  start_time        text not null default '',   -- "HH:MM"
  end_time          text not null default '',
  guests            integer not null default 0,
  status            text not null default 'pendiente',
  fee_amount        numeric(12,2) not null default 0,
  deposit_amount    numeric(12,2) not null default 0,
  charge_id         uuid references charges(id) on delete set null,
  approved_by       text not null default '',
  note              text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_amenity_res_amenity_date
  on amenity_reservations (amenity_id, reservation_date);
create index if not exists idx_amenity_res_unit on amenity_reservations (unit_id);
create index if not exists idx_amenity_res_branch_status
  on amenity_reservations (branch_id, status);
create trigger trg_amenity_res_updated before update on amenity_reservations
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- RLS: cerrado por defecto.
-- ------------------------------------------------------------
alter table amenities            enable row level security;
alter table amenity_blackouts    enable row level security;
alter table amenity_reservations enable row level security;
