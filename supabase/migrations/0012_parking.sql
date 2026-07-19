-- ============================================================
-- Concepto La Granja · Estacionamiento (500 puestos)
-- Migración: 0012_parking
--
-- Tickets con código (QR) de entrada/salida, tarifa por tiempo con gracia y
-- tope diario, cortesías por consumo (validación de un local) y abonos
-- mensuales / vehículos autorizados. El cliente puede escanear el QR y ver
-- cuánto debe desde su teléfono (ruta pública), sin caja.
-- ============================================================

-- Configuración de tarifas del estacionamiento (una fila por centro comercial).
create table if not exists parking_config (
  branch_id           uuid primary key references branches(id) on delete cascade,
  free_minutes        integer not null default 15,     -- gracia inicial sin cobro
  rate_per_hour       numeric(10,2) not null default 1,-- tarifa por hora (o fracción)
  rate_currency       text not null default 'USD',
  daily_cap           numeric(10,2) not null default 0,-- tope por día (0 = sin tope)
  grace_exit_minutes  integer not null default 15,     -- minutos para salir tras pagar
  updated_at          timestamptz not null default now()
);
create trigger trg_parking_config_updated before update on parking_config
  for each row execute function set_updated_at();

-- Tickets de estacionamiento.
--   status: abierto | por_pagar | pagado | cortesia | anulado
create table if not exists parking_tickets (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  code           text not null,                 -- corto, para el QR
  plate          text not null default '',
  vehicle_type   text not null default 'carro', -- carro | moto | otro
  entered_at     timestamptz not null default now(),
  exited_at      timestamptz,
  minutes        integer not null default 0,
  amount         numeric(10,2) not null default 0,
  currency       text not null default 'USD',
  status         text not null default 'abierto',
  paid_method    text not null default '',       -- efectivo | pago_movil | tarjeta | ...
  paid_at        timestamptz,
  validated_by   text not null default '',       -- local que dio la cortesía por consumo
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists uq_parking_ticket_code on parking_tickets (branch_id, code);
create index if not exists idx_parking_tickets_status on parking_tickets (branch_id, status);
create index if not exists idx_parking_tickets_plate on parking_tickets (branch_id, plate);
create trigger trg_parking_tickets_updated before update on parking_tickets
  for each row execute function set_updated_at();

-- Abonos mensuales / vehículos autorizados (empleados, comerciantes, residentes).
create table if not exists parking_passes (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  plate          text not null default '',
  holder_name    text not null default '',
  unit_id        uuid references units(id) on delete set null,  -- local asociado (opcional)
  valid_from     date,
  valid_to       date,
  monthly_fee    numeric(10,2) not null default 0,
  currency       text not null default 'USD',
  active         boolean not null default true,
  notes          text not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists idx_parking_passes_branch on parking_passes (branch_id, active);
create index if not exists idx_parking_passes_plate on parking_passes (branch_id, plate);

-- RLS cerrado por defecto (solo service role del servidor).
alter table parking_config  enable row level security;
alter table parking_tickets enable row level security;
alter table parking_passes  enable row level security;

-- Config por defecto para el centro comercial existente (idempotente).
insert into parking_config (branch_id)
select id from branches
where not exists (select 1 from parking_config pc where pc.branch_id = branches.id);
