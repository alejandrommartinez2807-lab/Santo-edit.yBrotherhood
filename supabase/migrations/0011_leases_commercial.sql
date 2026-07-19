-- ============================================================
-- Concepto La Granja · Arrendamiento comercial (lo propio de un mall)
-- Migración: 0011_leases_commercial
--
-- La base de condominio ya resuelve: locales (units, con alícuota/m²/piso),
-- comerciantes (residents), condominio y cobranza (fee_periods/charges/
-- receipts/payments) e incidencias. Lo que un CENTRO COMERCIAL agrega y un
-- condominio NO tiene es el CONTRATO DE ARRENDAMIENTO por local:
--   · canon mensual (además de la cuota de condominio),
--   · depósito de garantía, vigencia y vencimiento,
--   · aumentos programados,
--   · RENTA PORCENTUAL (percentage rent): % sobre las ventas del local, con
--     canon mínimo garantizado — el gran diferenciador si el local usa el POS.
--
-- Además se enriquecen `units` con datos de vitrina para el directorio público
-- (nombre comercial, rubro, logo).
-- ============================================================

-- ------------------------------------------------------------
-- Enriquecer LOCALES para el directorio y la clasificación por rubro.
-- (idempotente: add column if not exists)
-- ------------------------------------------------------------
alter table units add column if not exists commercial_name text not null default '';   -- "Beco", "Capitán Grill"
alter table units add column if not exists activity        text not null default '';   -- moda | comida | salud | electronica | servicios | consultorio | oficina | kiosco | banco | ...
alter table units add column if not exists logo_url        text not null default '';   -- logo del local (directorio)
create index if not exists idx_units_activity on units (branch_id, activity);

-- ------------------------------------------------------------
-- CONTRATOS DE ARRENDAMIENTO
--   Un local puede tener a lo largo del tiempo varios contratos; el vigente es
--   status='activo'. `resident_id` = comerciante/inquilino titular del contrato.
--   status: borrador | activo | por_vencer | vencido | renovado | terminado
--   Montos en moneda de cuenta (USD por defecto); el cobro local sale del
--   motor de cobranza existente (charges/payments con su tasa).
-- ------------------------------------------------------------
create table if not exists leases (
  id                    uuid primary key default gen_random_uuid(),
  branch_id             uuid references branches(id) on delete cascade,
  unit_id               uuid references units(id) on delete cascade,
  resident_id           uuid references residents(id) on delete set null,
  code                  text not null default '',            -- nº de contrato visible
  status                text not null default 'borrador',
  starts_on             date,
  ends_on               date,

  -- Canon (alquiler) ------------------------------------------------
  canon_amount          numeric(12,2) not null default 0,    -- canon mensual
  canon_currency        text not null default 'USD',
  condo_included        boolean not null default false,      -- si el canon ya incluye condominio
  billing_day           integer not null default 1,          -- día del mes en que se emite
  due_day               integer not null default 5,          -- día de vencimiento
  grace_days            integer not null default 0,          -- días de gracia antes de mora
  late_fee_percent      numeric(6,3) not null default 0,     -- recargo por mora (%)

  -- Depósito de garantía -------------------------------------------
  deposit_amount        numeric(12,2) not null default 0,
  deposit_currency      text not null default 'USD',
  deposit_held          boolean not null default false,      -- si ya se recibió

  -- Renta porcentual (percentage rent) — el diferenciador -----------
  percentage_rent       boolean not null default false,
  percentage_rent_rate  numeric(6,3) not null default 0,     -- % sobre ventas del local
  percentage_rent_min   numeric(12,2) not null default 0,    -- canon mínimo garantizado

  -- Renovación / responsables --------------------------------------
  auto_renew            boolean not null default false,
  renewal_notice_days   integer not null default 60,         -- preaviso de renovación/no-renovación
  guarantor_name        text not null default '',            -- fiador / responsable solidario
  guarantor_phone       text not null default '',

  documents             jsonb not null default '[]'::jsonb,  -- [{name,url}] contrato, pólizas, permisos
  notes                 text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_leases_branch on leases (branch_id, status);
create index if not exists idx_leases_unit on leases (unit_id, status);
create index if not exists idx_leases_resident on leases (resident_id);
create index if not exists idx_leases_ends on leases (branch_id, ends_on);
-- un solo contrato ACTIVO por local (los históricos quedan con otro status)
create unique index if not exists uq_lease_active_unit
  on leases (unit_id) where status = 'activo';
create trigger trg_leases_updated before update on leases
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- AUMENTOS PROGRAMADOS del canon
--   kind: fijo (new_canon absoluto) | porcentaje (sube el canon vigente value%)
--   applied: ya se reflejó en leases.canon_amount.
-- ------------------------------------------------------------
create table if not exists lease_increases (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  lease_id       uuid references leases(id) on delete cascade,
  effective_on   date not null,
  kind           text not null default 'porcentaje',  -- fijo | porcentaje
  value          numeric(12,3) not null default 0,     -- monto (fijo) o % (porcentaje)
  new_canon      numeric(12,2) not null default 0,     -- canon resultante (calculado al programar)
  applied        boolean not null default false,
  note           text not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists idx_lease_increases_lease on lease_increases (lease_id, effective_on);
create index if not exists idx_lease_increases_pending on lease_increases (branch_id, applied, effective_on);

-- ------------------------------------------------------------
-- HISTORIAL del contrato (firma, renovación, modificación, terminación…)
--   Rastro legible del ciclo de vida del contrato (además del audit_logs global).
-- ------------------------------------------------------------
create table if not exists lease_events (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  lease_id       uuid references leases(id) on delete cascade,
  kind           text not null default 'nota',   -- creado | firmado | renovado | aumento | multa | terminado | nota
  description    text not null default '',
  effective_on   date not null default current_date,
  actor_label    text not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists idx_lease_events_lease on lease_events (lease_id, created_at desc);

-- ------------------------------------------------------------
-- VENTAS REPORTADAS del local (para la renta porcentual)
--   Fuente: el comerciante las reporta, o se toman del POS si usa el motor Santo.
--   Sobre esto se calcula el cargo de percentage rent del período.
-- ------------------------------------------------------------
create table if not exists lease_sales (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  lease_id       uuid references leases(id) on delete cascade,
  unit_id        uuid references units(id) on delete cascade,
  period_month   date not null,                  -- primer día del mes
  gross_sales    numeric(14,2) not null default 0,
  currency       text not null default 'USD',
  source         text not null default 'reportado', -- reportado | pos | auditado
  reported_by    text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists uq_lease_sales_period on lease_sales (lease_id, period_month);
create index if not exists idx_lease_sales_branch on lease_sales (branch_id, period_month desc);
create trigger trg_lease_sales_updated before update on lease_sales
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- RLS: cerrado por defecto (solo service role del servidor), igual que el resto.
-- ------------------------------------------------------------
alter table leases          enable row level security;
alter table lease_increases enable row level security;
alter table lease_events    enable row level security;
alter table lease_sales     enable row level security;
