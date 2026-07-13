-- ============================================================
-- Santo Edit · Núcleo Hotelero (PMS) — Fase 1
-- Migración: 0026_hotel_core
--
-- Convierte la base multi-sede (restaurante) en multi-PROPIEDAD hotelera
-- reutilizando `branches` como "propiedad/hotel". Agrega el modelo completo
-- del PMS: tipos de habitación, habitaciones, huéspedes (ficha legal),
-- reservas por RANGO DE NOCHES, folio del huésped (cargos + pagos, conectable
-- al POS), temporadas de tarifa y housekeeping.
--
-- Diseño alineado con el resto del repo:
--  · snake_case, uuid pk con gen_random_uuid()
--  · branch_id -> branches(id) para aislar por propiedad (fitness de aislamiento)
--  · RLS habilitado y CERRADO por defecto: solo el servidor con service role key
--  · updated_at lo setea la capa de aplicación (como en reservations)
--
-- NADA en esta migración toca las tablas del restaurante; es puramente aditiva.
-- El solape de reservas por fechas se valida en la capa de aplicación
-- (src/lib/hotelReservationConflicts.ts), aquí solo persistimos + índices.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1) Tipos de habitación (Individual, Doble, Suite, …)
--    La tarifa base vive aquí; una habitación concreta puede sobreescribirla.
-- ------------------------------------------------------------
create table if not exists room_types (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  name           text not null,
  description    text not null default '',
  base_capacity  integer not null default 2,   -- capacidad estándar (huéspedes)
  max_capacity   integer not null default 2,   -- con camas extra
  base_rate      numeric(12,2) not null default 0, -- tarifa/noche en moneda base
  sort_order     integer not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_room_types_branch on room_types (branch_id, sort_order);

-- ------------------------------------------------------------
-- 2) Habitaciones
--    Estado de OCUPACIÓN se deriva de las reservas activas; aquí guardamos el
--    estado de LIMPIEZA (housekeeping) y si está fuera de servicio.
--    housekeeping_status: limpia | sucia | inspeccion | mantenimiento
-- ------------------------------------------------------------
create table if not exists rooms (
  id                  uuid primary key default gen_random_uuid(),
  branch_id           uuid references branches(id) on delete cascade,
  room_type_id        uuid references room_types(id) on delete set null,
  name                text not null,              -- número/nombre visible: "101", "Suite Mar"
  floor               text not null default '',
  capacity            integer not null default 2,
  base_rate           numeric(12,2),              -- null = usa la del tipo
  housekeeping_status text not null default 'limpia',
  out_of_service      boolean not null default false, -- mantenimiento largo/bloqueada
  amenities           text not null default '',   -- lista libre: "TV, A/C, Balcón"
  notes               text not null default '',
  sort_order          integer not null default 0,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_rooms_branch on rooms (branch_id, sort_order);
create index if not exists idx_rooms_type on rooms (room_type_id);

-- ------------------------------------------------------------
-- 3) Huéspedes (ficha legal para check-in)
-- ------------------------------------------------------------
create table if not exists guests (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid references branches(id) on delete cascade,
  full_name        text not null,
  document_type    text not null default 'cedula', -- cedula | pasaporte | rif | otro
  document_number  text not null default '',
  phone            text not null default '',
  email            text not null default '',
  nationality      text not null default '',
  birth_date       date,
  address          text not null default '',
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_guests_branch on guests (branch_id);
create index if not exists idx_guests_document on guests (branch_id, document_number);

-- ------------------------------------------------------------
-- 4) Reservas hoteleras (por RANGO de noches)
--    room_id es null hasta asignar habitación; room_type_id fija el tipo pedido.
--    status: pendiente | confirmada | checkin | checkout | cancelada | no_show
--    source: recepcion | telefono | whatsapp | web | ota
-- ------------------------------------------------------------
create table if not exists hotel_reservations (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid references branches(id) on delete cascade,
  code              text not null default '',   -- código corto de confirmación
  room_id           uuid references rooms(id) on delete set null,
  room_type_id      uuid references room_types(id) on delete set null,
  guest_id          uuid references guests(id) on delete set null,
  guest_name        text not null default '',   -- snapshot para listados rápidos
  guest_phone       text not null default '',
  check_in_date     date not null,
  check_out_date    date not null,              -- exclusiva (día de salida)
  adults            integer not null default 1,
  children          integer not null default 0,
  rate_per_night    numeric(12,2) not null default 0,
  total_amount      numeric(12,2) not null default 0,
  status            text not null default 'confirmada',
  source            text not null default 'recepcion',
  note              text not null default '',
  checked_in_at     timestamptz,
  checked_out_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint hotel_reservations_dates_ck check (check_out_date > check_in_date)
);

create index if not exists idx_hotel_res_branch_dates
  on hotel_reservations (branch_id, check_in_date, check_out_date);
create index if not exists idx_hotel_res_room on hotel_reservations (room_id);
create index if not exists idx_hotel_res_status on hotel_reservations (branch_id, status);

-- ------------------------------------------------------------
-- 5) Folio del huésped (cuenta de la estadía)
--    Un folio por reserva. El balance se calcula sumando folio_items.
--    status: abierto | cerrado
-- ------------------------------------------------------------
create table if not exists folios (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid references branches(id) on delete cascade,
  reservation_id   uuid references hotel_reservations(id) on delete cascade,
  guest_id         uuid references guests(id) on delete set null,
  status           text not null default 'abierto',
  opened_at        timestamptz not null default now(),
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_folios_branch on folios (branch_id, status);
create index if not exists idx_folios_reservation on folios (reservation_id);

-- ------------------------------------------------------------
-- 6) Líneas del folio: cargos y pagos
--    kind: cargo | pago
--    category (cargo): habitacion | restaurante | minibar | lavanderia | extra
--    category (pago):  pago
--    source_order_id enlaza un consumo del POS (restaurante) al folio.
--    Montos SIEMPRE positivos; el signo lo da `kind` en la capa de aplicación.
-- ------------------------------------------------------------
create table if not exists folio_items (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid references branches(id) on delete cascade,
  folio_id         uuid references folios(id) on delete cascade,
  kind             text not null default 'cargo',
  category         text not null default 'extra',
  description      text not null default '',
  quantity         numeric(12,2) not null default 1,
  unit_amount      numeric(12,2) not null default 0,
  amount           numeric(12,2) not null default 0, -- total de la línea
  method           text not null default '',         -- método de pago (si kind=pago)
  source_order_id  text,                              -- id del pedido del POS (texto: "ord-...")
  created_by       text not null default '',
  created_at       timestamptz not null default now()
);

create index if not exists idx_folio_items_folio on folio_items (folio_id, created_at);
create index if not exists idx_folio_items_order on folio_items (source_order_id);

-- ------------------------------------------------------------
-- 7) Temporadas de tarifa
--    Sobreescriben la tarifa base por rango de fechas. room_type_id null = aplica
--    a todos los tipos. La resolución (prioridad) vive en la capa de aplicación.
--    mode: fija (rate) | factor (multiplier sobre la base)
-- ------------------------------------------------------------
create table if not exists rate_seasons (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid references branches(id) on delete cascade,
  room_type_id     uuid references room_types(id) on delete cascade,
  name             text not null,
  start_date       date not null,
  end_date         date not null,
  mode             text not null default 'fija', -- fija | factor
  rate             numeric(12,2) not null default 0,
  multiplier       numeric(6,3) not null default 1,
  priority         integer not null default 0,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint rate_seasons_dates_ck check (end_date >= start_date)
);

create index if not exists idx_rate_seasons_branch
  on rate_seasons (branch_id, start_date, end_date);

-- ------------------------------------------------------------
-- 8) Tareas de housekeeping (bitácora de limpieza/mantenimiento)
--    El estado rápido vive en rooms.housekeeping_status; esta tabla registra
--    tareas asignables e historial.
--    type: salida | estancia | mantenimiento
--    status: pendiente | en_proceso | hecha
-- ------------------------------------------------------------
create table if not exists housekeeping_tasks (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid references branches(id) on delete cascade,
  room_id          uuid references rooms(id) on delete cascade,
  type             text not null default 'salida',
  status           text not null default 'pendiente',
  assigned_to      text not null default '',
  note             text not null default '',
  created_at       timestamptz not null default now(),
  done_at          timestamptz
);

create index if not exists idx_hk_tasks_branch
  on housekeeping_tasks (branch_id, status);
create index if not exists idx_hk_tasks_room on housekeeping_tasks (room_id);

-- ------------------------------------------------------------
-- RLS: cerrado por defecto en todas (solo service role del servidor).
-- ------------------------------------------------------------
alter table room_types          enable row level security;
alter table rooms               enable row level security;
alter table guests              enable row level security;
alter table hotel_reservations  enable row level security;
alter table folios              enable row level security;
alter table folio_items         enable row level security;
alter table rate_seasons        enable row level security;
alter table housekeeping_tasks  enable row level security;
