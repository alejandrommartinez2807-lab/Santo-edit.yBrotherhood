-- ============================================================
-- Condominios · Estructura física y personas
-- Migración: 0002_units_residents
--
-- Unidades (apto/casa/local/estacionamiento/depósito) con su ALÍCUOTA
-- (coeficiente de participación) — pieza clave para prorratear gastos
-- comunes y ponderar el voto en asambleas. Residentes (propietarios/
-- inquilinos/autorizados) y la relación N:N unidad<->residente con rol.
--
-- QUEJA QUE CORRIGE: "no sé cuánto me toca ni por qué" → la alícuota es
-- explícita, versionable y auditable; el residente ve su coeficiente y
-- cómo se calcula su cuota.
-- ============================================================

-- ------------------------------------------------------------
-- Tipos de unidad (para plantillas de alícuota / cuota base)
-- ------------------------------------------------------------
create table if not exists unit_types (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id) on delete cascade,
  name          text not null,              -- "Apartamento", "Local", "PH", "Estacionamiento"
  description   text not null default '',
  sort_order    integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_unit_types_branch on unit_types (branch_id, sort_order);

-- ------------------------------------------------------------
-- Unidades / inmuebles
--   `alicuota` = coeficiente de participación (0..1 o %, según config).
--   Se guarda como fracción (0.012500 = 1.25 %). La SUMA de alícuotas de un
--   condominio debería dar 1 (100 %); se valida en la capa de aplicación.
--   `status`: activa | desocupada | en_mora | inactiva
-- ------------------------------------------------------------
create table if not exists units (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  unit_type_id   uuid references unit_types(id) on delete set null,
  code           text not null,             -- identificador visible: "A-12B", "Local 3"
  tower          text not null default '',  -- torre / bloque / etapa
  floor          text not null default '',
  area_m2        numeric(10,2) not null default 0,
  alicuota       numeric(9,6) not null default 0,   -- coeficiente (fracción). 0.0125 = 1.25%
  parking_slots  integer not null default 0,
  storage_slots  integer not null default 0,
  -- saldo cacheado (se recalcula al emitir cuotas / registrar pagos)
  balance        numeric(12,2) not null default 0,  -- + = debe, - = a favor
  status         text not null default 'activa',
  notes          text not null default '',
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_units_branch on units (branch_id, sort_order);
create unique index if not exists uq_units_code on units (branch_id, code);
create index if not exists idx_units_status on units (branch_id, status);
create trigger trg_units_updated before update on units
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Residentes / personas
--   Una persona puede estar ligada a varias unidades (ver unit_residents).
--   El acceso al PORTAL se hace por teléfono/email + código (magic link);
--   ver portal_access.
-- ------------------------------------------------------------
create table if not exists residents (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid references branches(id) on delete cascade,
  full_name        text not null,
  document_type    text not null default 'cedula', -- cedula | pasaporte | rif | otro
  document_number  text not null default '',
  phone            text not null default '',
  email            text not null default '',
  is_active        boolean not null default true,
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_residents_branch on residents (branch_id);
create index if not exists idx_residents_phone on residents (branch_id, phone);
create index if not exists idx_residents_document on residents (branch_id, document_number);
create trigger trg_residents_updated before update on residents
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Relación unidad <-> residente
--   role: propietario | inquilino | autorizado | familiar
--   is_primary: contacto principal de esa unidad (a quién se le cobra/avisa).
--   receives_billing: recibe el recibo de condominio (puede diferir del dueño
--   cuando alquila y el inquilino paga).
-- ------------------------------------------------------------
create table if not exists unit_residents (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid references branches(id) on delete cascade,
  unit_id          uuid references units(id) on delete cascade,
  resident_id      uuid references residents(id) on delete cascade,
  role             text not null default 'propietario', -- propietario | inquilino | autorizado | familiar
  is_primary       boolean not null default false,
  receives_billing boolean not null default true,
  can_vote         boolean not null default true,        -- típicamente solo el propietario
  starts_on        date,
  ends_on          date,
  created_at       timestamptz not null default now()
);
create index if not exists idx_unit_residents_unit on unit_residents (unit_id);
create index if not exists idx_unit_residents_resident on unit_residents (resident_id);
create unique index if not exists uq_unit_resident on unit_residents (unit_id, resident_id, role);

-- ------------------------------------------------------------
-- Acceso al portal del residente (autoservicio)
--   Login sin fricción: teléfono o email + código de un solo uso (OTP).
--   QUEJA QUE CORRIGE: "los residentes no quieren descargar otra app / crear
--   cuentas con contraseña". No hay contraseña: se envía un código por
--   WhatsApp/SMS/email y el portal es una PWA instalable.
-- ------------------------------------------------------------
create table if not exists portal_access (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid references branches(id) on delete cascade,
  resident_id      uuid references residents(id) on delete cascade,
  channel          text not null default 'whatsapp', -- whatsapp | sms | email
  otp_hash         text not null default '',         -- hash del código vigente
  otp_expires_at   timestamptz,
  last_login_at    timestamptz,
  is_blocked       boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists idx_portal_access_resident on portal_access (resident_id);

-- ------------------------------------------------------------
-- Vehículos por unidad (para control de acceso y multas de estacionamiento)
-- ------------------------------------------------------------
create table if not exists vehicles (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid references branches(id) on delete cascade,
  unit_id          uuid references units(id) on delete cascade,
  plate            text not null default '',
  brand            text not null default '',
  model            text not null default '',
  color            text not null default '',
  tag              text not null default '',   -- TAG/sticker de acceso
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists idx_vehicles_unit on vehicles (unit_id);
create index if not exists idx_vehicles_plate on vehicles (branch_id, plate);

-- ------------------------------------------------------------
-- Mascotas (opcional; algunos reglamentos las registran)
-- ------------------------------------------------------------
create table if not exists pets (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid references branches(id) on delete cascade,
  unit_id          uuid references units(id) on delete cascade,
  name             text not null default '',
  species          text not null default '',
  breed            text not null default '',
  notes            text not null default '',
  created_at       timestamptz not null default now()
);
create index if not exists idx_pets_unit on pets (unit_id);

-- ------------------------------------------------------------
-- RLS: cerrado por defecto (solo service role del servidor).
-- ------------------------------------------------------------
alter table unit_types      enable row level security;
alter table units           enable row level security;
alter table residents       enable row level security;
alter table unit_residents  enable row level security;
alter table portal_access   enable row level security;
alter table vehicles        enable row level security;
alter table pets            enable row level security;
