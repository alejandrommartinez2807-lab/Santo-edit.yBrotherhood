-- ============================================================
-- Hotel · Fase 21: SERVICIOS Y ACTIVIDADES DEL RESORT
--
-- Catálogo de servicios reservables (spa, tour, restaurante, alquiler, clase)
-- con precio, cupo por franja y duración; y las reservas de esos servicios por
-- fecha/hora con control de cupo. Migración ADITIVA, aislada por branch_id.
-- El cobro al folio llega en la Fase 22 (cargos del resort).
-- ============================================================

create table if not exists resort_services (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id) on delete cascade,
  name          text not null,
  kind          text not null default 'otro',   -- spa | tour | restaurante | alquiler | clase | otro
  description   text not null default '',
  price         numeric(12,2) not null default 0,
  capacity      integer not null default 1,      -- cupo por franja (fecha+hora)
  duration_min  integer not null default 60,
  active        boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_resort_services_branch on resort_services (branch_id, sort_order);

create table if not exists service_bookings (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  service_id     uuid references resort_services(id) on delete cascade,
  reservation_id uuid references hotel_reservations(id) on delete set null,
  guest_name     text not null default '',
  guest_phone    text not null default '',
  date           date not null,
  time           text not null default '',       -- "HH:MM" (opcional)
  people         integer not null default 1,
  status         text not null default 'reservada', -- reservada | cumplida | cancelada
  note           text not null default '',
  created_at     timestamptz not null default now()
);

create index if not exists idx_service_bookings_branch on service_bookings (branch_id, date);
create index if not exists idx_service_bookings_service on service_bookings (service_id, date);

alter table resort_services enable row level security;
alter table service_bookings enable row level security;
