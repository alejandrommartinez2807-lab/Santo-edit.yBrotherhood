-- ============================================================
-- Concepto La Granja · Esquema Supabase COMPLETO (self-contained)
-- Generado desde supabase/migrations/0001..0011
-- NOTA: si el editor de Supabase se atraganta al pegar todo (error
--       42601 end of input), aplica cada archivo de migrations/ POR
--       SEPARADO en orden 0001 -> 0011.
-- ============================================================


-- >>>>>>>>>> 0001_core_infra.sql <<<<<<<<<<

-- ============================================================
-- Condominios · Núcleo / Infraestructura compartida
-- Migración: 0001_core_infra
--
-- Base derivada del PMS hotelero (rama demo-lidotel): reutiliza el patrón
-- multi-propiedad `branches` (aquí: cada fila = UN CONDOMINIO/EDIFICIO
-- administrado), el auth de personal (staff_users), la config única JSONB
-- (business_config), la bitácora de auditoría (audit_logs) y las
-- suscripciones push. Sobre eso se monta el dominio de propiedad horizontal.
--
-- Convenciones (idénticas al resto del repo):
--  · snake_case; PK uuid con gen_random_uuid()
--  · branch_id -> branches(id) para aislar por condominio (fitness de aislamiento)
--  · estados como text + comentario + check (más flexible que enum)
--  · RLS habilitado y CERRADO por defecto; la app accede con SERVICE ROLE KEY
--    desde las API routes de Next (bypassa RLS). El portal del residente lee
--    vía esas rutas, nunca con la anon key directo a la tabla.
-- ============================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- Función utilitaria: updated_at automático ---------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- CONDOMINIOS  (physical table `branches` — un condominio por fila)
--   Multi-propiedad: una administradora puede gestionar varios edificios.
-- ============================================================
create table if not exists branches (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,               -- "Residencias El Parque"
  legal_name         text not null default '',    -- razón social / junta de condominio
  tax_id             text not null default '',    -- RIF / NIT
  address            text not null default '',
  city               text not null default '',
  phone              text not null default '',
  email              text not null default '',
  timezone           text not null default 'America/Caracas',
  currency_primary   text not null default 'USD',  -- moneda de cuenta (alícuotas)
  currency_secondary text not null default 'VES',  -- moneda de cobro local
  logo_url           text not null default '',
  -- parámetros de cobro y reglas del condominio (día de corte, % mora, etc.)
  config             jsonb not null default '{}'::jsonb,
  is_active          boolean not null default true,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger trg_branches_updated before update on branches
  for each row execute function set_updated_at();

comment on table branches is 'Cada fila = un condominio/edificio administrado (multi-propiedad).';

-- Centro comercial por defecto (idempotente).
insert into branches (name, sort_order)
select 'Concepto La Granja', 1
where not exists (select 1 from branches);

-- ============================================================
-- PERSONAL / USUARIOS ADMINISTRATIVOS
--   Ligado a Supabase Auth (auth.users). Roles del condominio:
--   admin        = administrador de la empresa/edificio (todo)
--   junta        = junta de condominio (lectura + aprobaciones + asambleas)
--   contador     = finanzas (cuotas, gastos, conciliación)
--   conserje     = recepción (visitas, encomiendas, incidencias)
--   seguridad    = control de acceso (garita)
--   mantenimiento= atiende incidencias/tareas
--   soporte      = nuestro rol interno
-- ============================================================
create table if not exists staff_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        text not null,             -- admin | junta | contador | conserje | seguridad | mantenimiento | soporte
  -- condominios que puede operar; vacío = todos (para la administradora)
  branch_ids  uuid[] not null default '{}',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_staff_users_role on staff_users (role);
alter table staff_users enable row level security;

-- Un usuario autenticado puede leer SU PROPIA fila (para conocer su rol).
do $$ begin
  create policy "staff can read own row"
    on staff_users for select
    using (auth.uid() = id);
exception when duplicate_object then null; end $$;

-- ============================================================
-- CONFIGURACIÓN DEL NEGOCIO  (fila única; marca/módulos/parámetros en JSONB)
--   Guarda: marca y tema, módulos habilitados, parámetros globales de cobro
--   (día de emisión de cuotas, día de vencimiento, % de recargo por mora,
--   gracia en días, textos legales, WhatsApp de la administración, etc.).
-- ============================================================
create table if not exists business_config (
  id            integer primary key default 1,
  config        jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  constraint business_config_single_row check (id = 1)
);
create trigger trg_business_config_updated before update on business_config
  for each row execute function set_updated_at();

insert into business_config (id, config)
select 1, '{}'::jsonb
where not exists (select 1 from business_config where id = 1);

-- ============================================================
-- BITÁCORA DE AUDITORÍA (append-only)  ·  TRANSPARENCIA
--   Quién hizo qué, cuándo y desde dónde. La escribe la capa de API tras cada
--   acción sensible (emitir cuotas, confirmar/anular pago, editar unidad,
--   aprobar gasto, publicar comunicado, autorizar visita, etc.).
--   branch_id es TEXT sin FK a propósito: auditar NUNCA debe fallar por una FK.
-- ============================================================
create table if not exists audit_logs (
  id           uuid primary key default gen_random_uuid(),
  branch_id    text,
  action       text not null,
  entity_type  text not null default '',
  entity_id    text,
  actor_role   text,
  actor_label  text,
  actor_source text,
  ip_address   text,
  user_agent   text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists idx_audit_logs_created on audit_logs (created_at desc);
create index if not exists idx_audit_logs_branch on audit_logs (branch_id);
create index if not exists idx_audit_logs_action on audit_logs (action);
create index if not exists idx_audit_logs_entity on audit_logs (entity_type, entity_id);
alter table audit_logs enable row level security;

-- ============================================================
-- SUSCRIPCIONES PUSH (Web Push / VAPID)
--   Sirve tanto a personal como a residentes del portal.
--   subscriber_type: staff | resident
-- ============================================================
create table if not exists push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid references branches(id) on delete cascade,
  subscriber_type  text not null default 'resident', -- staff | resident
  subscriber_id    text not null default '',         -- id de staff_user o resident
  endpoint         text not null,
  p256dh           text not null default '',
  auth             text not null default '',
  user_agent       text not null default '',
  created_at       timestamptz not null default now()
);
create unique index if not exists uq_push_endpoint on push_subscriptions (endpoint);
create index if not exists idx_push_subscriber on push_subscriptions (subscriber_type, subscriber_id);
alter table push_subscriptions enable row level security;

-- >>>>>>>>>> 0002_units_residents.sql <<<<<<<<<<

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

-- >>>>>>>>>> 0003_finance.sql <<<<<<<<<<

-- ============================================================
-- Condominios · Finanzas y cobranza  (EL NÚCLEO)
-- Migración: 0003_finance
--
-- Resuelve las 3 quejas #1 del rubro:
--   (a) MOROSIDAD: cuotas emitidas por período, vencimiento, recargo por mora
--       automático, recordatorios y pago en línea con comprobante.
--   (b) TRANSPARENCIA: gasto común detallado y publicable, presupuesto,
--       recibo por unidad con saldo anterior + cargos + pagos + saldo nuevo.
--   (c) "LAS CUENTAS NO CUADRAN": cada pago se APLICA a cargos concretos
--       (payment_allocations); el saldo de la unidad es siempre reconstruible.
--
-- Montos SIEMPRE positivos; el signo lo da la semántica (cargo vs pago).
-- Moneda de cuenta = branches.currency_primary (ej. USD); se guarda además el
-- monto en moneda local y la tasa usada para el recibo.
-- ============================================================

-- ------------------------------------------------------------
-- Proveedores (para gastos y mantenimiento)
-- ------------------------------------------------------------
create table if not exists providers (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id) on delete cascade,
  name          text not null,
  category      text not null default '',   -- limpieza | seguridad | ascensores | jardinería | ...
  tax_id        text not null default '',
  phone         text not null default '',
  email         text not null default '',
  notes         text not null default '',
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_providers_branch on providers (branch_id);

-- ------------------------------------------------------------
-- Categorías de gasto común (para el prorrateo y los informes)
-- ------------------------------------------------------------
create table if not exists expense_categories (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id) on delete cascade,
  name          text not null,              -- "Electricidad áreas comunes", "Aseo urbano"...
  -- cómo se reparte entre unidades cuando alimenta la cuota:
  -- alicuota | partes_iguales | por_unidad_tipo | no_prorratea
  proration     text not null default 'alicuota',
  sort_order    integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists idx_expense_categories_branch on expense_categories (branch_id, sort_order);

-- ------------------------------------------------------------
-- Presupuesto anual (opcional, alimenta transparencia y planificación)
-- ------------------------------------------------------------
create table if not exists budgets (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id) on delete cascade,
  year          integer not null,
  status        text not null default 'borrador', -- borrador | aprobado | cerrado
  approved_at   timestamptz,
  note          text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists uq_budget_year on budgets (branch_id, year);

create table if not exists budget_lines (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  budget_id      uuid references budgets(id) on delete cascade,
  category_id    uuid references expense_categories(id) on delete set null,
  label          text not null default '',
  annual_amount  numeric(12,2) not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists idx_budget_lines_budget on budget_lines (budget_id);

-- ------------------------------------------------------------
-- Gastos comunes efectivos (lo que realmente se gastó ese mes)
--   Alimenta el recibo del período (prorrateo) y el informe de transparencia.
--   proof_url: comprobante escaneado (factura del proveedor).
-- ------------------------------------------------------------
create table if not exists expenses (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  category_id    uuid references expense_categories(id) on delete set null,
  provider_id    uuid references providers(id) on delete set null,
  period_id      uuid,                       -- fee_periods(id); FK se agrega abajo
  description    text not null default '',
  amount         numeric(12,2) not null default 0,   -- moneda de cuenta
  amount_local   numeric(14,2) not null default 0,   -- moneda local (informativo)
  currency       text not null default 'USD',
  spent_on       date not null default current_date,
  proof_url      text not null default '',
  approved_by    text not null default '',
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_expenses_branch on expenses (branch_id, spent_on);
create index if not exists idx_expenses_period on expenses (period_id);
create index if not exists idx_expenses_category on expenses (category_id);
create trigger trg_expenses_updated before update on expenses
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Períodos de cobro (típicamente 1 por mes)
--   status: borrador | emitido | cerrado
--   Al EMITIR se generan los charges + receipts de todas las unidades activas.
-- ------------------------------------------------------------
create table if not exists fee_periods (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  label          text not null,              -- "2026-07" o "Julio 2026"
  period_month   date not null,              -- primer día del mes (para orden/filtro)
  status         text not null default 'borrador',
  issued_at      timestamptz,
  due_date       date,                       -- vencimiento de las cuotas del período
  exchange_rate  numeric(14,4) not null default 0,  -- tasa moneda_cuenta->local del recibo
  common_expense_total numeric(12,2) not null default 0, -- gasto común prorrateado del mes
  note           text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists uq_fee_period on fee_periods (branch_id, period_month);
create index if not exists idx_fee_periods_branch on fee_periods (branch_id, period_month desc);
create trigger trg_fee_periods_updated before update on fee_periods
  for each row execute function set_updated_at();

-- FK diferida de expenses.period_id -> fee_periods.id
do $$ begin
  alter table expenses
    add constraint fk_expenses_period
    foreign key (period_id) references fee_periods(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- Cargos a la unidad
--   concept: cuota_ordinaria | cuota_extraordinaria | multa | mora |
--            reserva_amenidad | consumo | ajuste | otro
--   Un cargo puede prorratear un gasto (alicuota_used) o ser fijo.
--   status: pendiente | pagado | parcial | anulado
-- ------------------------------------------------------------
create table if not exists charges (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  unit_id        uuid references units(id) on delete cascade,
  period_id      uuid references fee_periods(id) on delete set null,
  concept        text not null default 'cuota_ordinaria',
  description    text not null default '',
  amount         numeric(12,2) not null default 0,   -- moneda de cuenta
  amount_paid    numeric(12,2) not null default 0,   -- aplicado por payment_allocations
  alicuota_used  numeric(9,6),                        -- si prorratea gasto común
  source_expense_id uuid references expenses(id) on delete set null,
  source_ref     text not null default '',            -- id de reserva/multa que lo originó
  due_date       date,
  status         text not null default 'pendiente',
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_charges_unit on charges (unit_id, status);
create index if not exists idx_charges_period on charges (period_id);
create index if not exists idx_charges_branch_status on charges (branch_id, status);
create trigger trg_charges_updated before update on charges
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Recibo / estado de cuenta por unidad y período
--   Es la foto que ve el residente: saldo anterior + cargos - pagos = saldo.
--   number: correlativo por condominio (para el recibo imprimible/PDF).
-- ------------------------------------------------------------
create table if not exists receipts (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id) on delete cascade,
  unit_id         uuid references units(id) on delete cascade,
  period_id       uuid references fee_periods(id) on delete cascade,
  number          integer not null default 0,
  previous_balance numeric(12,2) not null default 0,
  charges_total   numeric(12,2) not null default 0,
  payments_total  numeric(12,2) not null default 0,
  new_balance     numeric(12,2) not null default 0,
  exchange_rate   numeric(14,4) not null default 0,
  status          text not null default 'emitido',  -- emitido | pagado | vencido | anulado
  issued_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists uq_receipt_unit_period on receipts (unit_id, period_id);
create index if not exists idx_receipts_branch on receipts (branch_id, issued_at desc);
create trigger trg_receipts_updated before update on receipts
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Pagos (reportados por el residente O registrados por el admin)
--   Patrón "reportar mi pago" (heredado de Brotherhood): el residente sube
--   comprobante y el monto en moneda local; la administración concilia.
--   status: reportado | confirmado | rechazado | anulado
--   method: transferencia | pago_movil | efectivo | zelle | tarjeta | otro
-- ------------------------------------------------------------
create table if not exists payments (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id) on delete cascade,
  unit_id         uuid references units(id) on delete cascade,
  resident_id     uuid references residents(id) on delete set null,
  amount          numeric(12,2) not null default 0,   -- en moneda de cuenta
  amount_local    numeric(14,2) not null default 0,   -- lo que realmente pagó (local)
  currency        text not null default 'USD',
  exchange_rate   numeric(14,4) not null default 0,
  method          text not null default 'transferencia',
  reference       text not null default '',            -- nº de referencia/confirmación
  proof_url       text not null default '',            -- comprobante (imagen)
  paid_on         date not null default current_date,
  status          text not null default 'reportado',
  reviewed_by     text not null default '',
  reviewed_at     timestamptz,
  reject_reason   text not null default '',
  note            text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_payments_unit on payments (unit_id, status);
create index if not exists idx_payments_branch_status on payments (branch_id, status);
create index if not exists idx_payments_reference on payments (branch_id, reference);
create trigger trg_payments_updated before update on payments
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Aplicación de un pago confirmado a cargos concretos
--   Deja el rastro exacto de a qué se abonó cada bolívar/dólar.
--   Suma de allocations de un pago <= payment.amount (validado en la app).
-- ------------------------------------------------------------
create table if not exists payment_allocations (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id) on delete cascade,
  payment_id      uuid references payments(id) on delete cascade,
  charge_id       uuid references charges(id) on delete cascade,
  amount          numeric(12,2) not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_alloc_payment on payment_allocations (payment_id);
create index if not exists idx_alloc_charge on payment_allocations (charge_id);

-- ------------------------------------------------------------
-- RLS: cerrado por defecto (solo service role del servidor).
-- ------------------------------------------------------------
alter table providers           enable row level security;
alter table expense_categories  enable row level security;
alter table budgets             enable row level security;
alter table budget_lines        enable row level security;
alter table expenses            enable row level security;
alter table fee_periods         enable row level security;
alter table charges             enable row level security;
alter table receipts            enable row level security;
alter table payments            enable row level security;
alter table payment_allocations enable row level security;

-- >>>>>>>>>> 0004_amenities.sql <<<<<<<<<<

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

-- >>>>>>>>>> 0005_tickets.sql <<<<<<<<<<

-- ============================================================
-- Condominios · Incidencias (PQR) y mantenimiento
-- Migración: 0005_tickets
--
-- QUEJA QUE CORRIGE: "reporté una fuga/luz dañada por WhatsApp y nunca supe
-- si lo vieron ni cuándo lo resolvieron". Aquí cada reporte es un TICKET con
-- estado, responsable, fotos, bitácora pública para el residente y SLA.
-- Cubre PQR (peticiones/quejas/reclamos) y órdenes de mantenimiento.
-- ============================================================

-- ------------------------------------------------------------
-- Tickets / incidencias
--   category: mantenimiento | limpieza | seguridad | ruido | administrativo |
--             sugerencia | reclamo | otro
--   priority: baja | media | alta | urgente
--   status:   abierto | en_proceso | en_espera | resuelto | cerrado | rechazado
--   area:     unidad | area_comun (define si va ligado a una unidad concreta)
-- ------------------------------------------------------------
create table if not exists tickets (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  code           text not null default '',     -- correlativo visible: "INC-000123"
  unit_id        uuid references units(id) on delete set null,
  resident_id    uuid references residents(id) on delete set null,
  reporter_name  text not null default '',      -- snapshot (o conserje que lo abre)
  area           text not null default 'unidad',
  category       text not null default 'mantenimiento',
  priority       text not null default 'media',
  status         text not null default 'abierto',
  title          text not null default '',
  description    text not null default '',
  location       text not null default '',       -- "Pasillo torre B piso 3"
  photos         jsonb not null default '[]'::jsonb,  -- [urls]
  assigned_to    text not null default '',        -- staff o proveedor
  provider_id    uuid references providers(id) on delete set null,
  due_at         timestamptz,                     -- SLA objetivo de resolución
  resolved_at    timestamptz,
  closed_at      timestamptz,
  rating         integer,                         -- 1..5 satisfacción del residente al cerrar
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_tickets_branch_status on tickets (branch_id, status);
create index if not exists idx_tickets_unit on tickets (unit_id);
create index if not exists idx_tickets_priority on tickets (branch_id, priority);
create trigger trg_tickets_updated before update on tickets
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Bitácora del ticket (comentarios + cambios de estado)
--   visibility: publico (lo ve el residente) | interno (solo staff)
-- ------------------------------------------------------------
create table if not exists ticket_updates (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  ticket_id      uuid references tickets(id) on delete cascade,
  author_label   text not null default '',
  author_role    text not null default '',       -- residente | admin | conserje | mantenimiento
  visibility     text not null default 'publico',
  message        text not null default '',
  status_from    text not null default '',
  status_to      text not null default '',
  photos         jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists idx_ticket_updates_ticket on ticket_updates (ticket_id, created_at);

-- ------------------------------------------------------------
-- Activos / equipos del condominio (ascensores, bombas, planta, portón)
-- ------------------------------------------------------------
create table if not exists maintenance_assets (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  name           text not null,               -- "Ascensor Torre A", "Bomba hidroneumática"
  location       text not null default '',
  brand          text not null default '',
  serial         text not null default '',
  provider_id    uuid references providers(id) on delete set null,
  notes          text not null default '',
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists idx_maint_assets_branch on maintenance_assets (branch_id);

-- ------------------------------------------------------------
-- Tareas de mantenimiento (preventivo/correctivo, con recurrencia)
--   status: programada | en_proceso | hecha | vencida | cancelada
--   recurrence: none | mensual | trimestral | semestral | anual
-- ------------------------------------------------------------
create table if not exists maintenance_tasks (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  asset_id       uuid references maintenance_assets(id) on delete set null,
  ticket_id      uuid references tickets(id) on delete set null,
  title          text not null default '',
  description    text not null default '',
  provider_id    uuid references providers(id) on delete set null,
  status         text not null default 'programada',
  recurrence     text not null default 'none',
  scheduled_for  date,
  done_at        timestamptz,
  cost           numeric(12,2) not null default 0,
  expense_id     uuid references expenses(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_maint_tasks_branch on maintenance_tasks (branch_id, status);
create index if not exists idx_maint_tasks_scheduled on maintenance_tasks (branch_id, scheduled_for);
create trigger trg_maint_tasks_updated before update on maintenance_tasks
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- RLS: cerrado por defecto.
-- ------------------------------------------------------------
alter table tickets            enable row level security;
alter table ticket_updates     enable row level security;
alter table maintenance_assets enable row level security;
alter table maintenance_tasks  enable row level security;

-- >>>>>>>>>> 0006_communication.sql <<<<<<<<<<

-- ============================================================
-- Condominios · Comunicación
-- Migración: 0006_communication
--
-- QUEJA QUE CORRIGE: "mala comunicación con la administración, sobre todo con
-- las alzas de gasto común" y "me entero tarde de todo". Cartelera digital con
-- ACUSE DE LECTURA (sé quién leyó), notificaciones multicanal (push + WhatsApp
-- + email) y un hilo de mensajería por unidad.
-- ============================================================

-- ------------------------------------------------------------
-- Comunicados / cartelera
--   audience: todos | torre | unidad | morosos | propietarios
--   audience_ref: torre o unit_id según audience.
--   status: borrador | publicado | archivado
--   requires_ack: exige acuse de lectura (para actas, alzas, reglas).
-- ------------------------------------------------------------
create table if not exists announcements (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  title          text not null,
  body           text not null default '',
  category       text not null default 'general', -- general | mantenimiento | asamblea | cobranza | seguridad | evento
  audience       text not null default 'todos',
  audience_ref   text not null default '',
  attachments    jsonb not null default '[]'::jsonb, -- [{name,url}]
  is_pinned      boolean not null default false,
  requires_ack   boolean not null default false,
  status         text not null default 'borrador',
  published_at   timestamptz,
  expires_at     timestamptz,
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_announcements_branch
  on announcements (branch_id, published_at desc);
create index if not exists idx_announcements_status on announcements (branch_id, status);
create trigger trg_announcements_updated before update on announcements
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Acuse de lectura de un comunicado (transparencia / cumplimiento)
-- ------------------------------------------------------------
create table if not exists announcement_reads (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid references branches(id) on delete cascade,
  announcement_id  uuid references announcements(id) on delete cascade,
  resident_id      uuid references residents(id) on delete cascade,
  unit_id          uuid references units(id) on delete set null,
  read_at          timestamptz not null default now(),
  acknowledged     boolean not null default false
);
create unique index if not exists uq_ann_read
  on announcement_reads (announcement_id, resident_id);
create index if not exists idx_ann_reads_announcement on announcement_reads (announcement_id);

-- ------------------------------------------------------------
-- Registro de notificaciones enviadas (evita duplicados, sirve de historial)
--   kind: comunicado | recibo | recordatorio_pago | mora | reserva |
--         incidencia | encomienda | asamblea | visita
--   channel: push | whatsapp | email | sms
--   status: enviado | fallido | entregado
-- ------------------------------------------------------------
create table if not exists notifications_log (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  resident_id    uuid references residents(id) on delete set null,
  unit_id        uuid references units(id) on delete set null,
  kind           text not null default 'comunicado',
  channel        text not null default 'push',
  ref_type       text not null default '',    -- entidad relacionada (announcement, receipt...)
  ref_id         text not null default '',
  title          text not null default '',
  status         text not null default 'enviado',
  error          text not null default '',
  sent_at        timestamptz not null default now()
);
create index if not exists idx_notiflog_branch on notifications_log (branch_id, sent_at desc);
create index if not exists idx_notiflog_resident on notifications_log (resident_id);
create index if not exists idx_notiflog_ref on notifications_log (ref_type, ref_id);

-- ------------------------------------------------------------
-- Mensajería (hilo por unidad entre residente y administración)
-- ------------------------------------------------------------
create table if not exists message_threads (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  unit_id        uuid references units(id) on delete set null,
  subject        text not null default '',
  status         text not null default 'abierto',  -- abierto | cerrado
  last_message_at timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index if not exists idx_threads_branch on message_threads (branch_id, last_message_at desc);
create index if not exists idx_threads_unit on message_threads (unit_id);

create table if not exists messages (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  thread_id      uuid references message_threads(id) on delete cascade,
  author_role    text not null default 'residente', -- residente | admin
  author_label   text not null default '',
  body           text not null default '',
  attachments    jsonb not null default '[]'::jsonb,
  read_by_admin  boolean not null default false,
  read_by_resident boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists idx_messages_thread on messages (thread_id, created_at);

-- ------------------------------------------------------------
-- RLS: cerrado por defecto.
-- ------------------------------------------------------------
alter table announcements       enable row level security;
alter table announcement_reads  enable row level security;
alter table notifications_log   enable row level security;
alter table message_threads     enable row level security;
alter table messages            enable row level security;

-- >>>>>>>>>> 0007_governance.sql <<<<<<<<<<

-- ============================================================
-- Condominios · Gobernanza (asambleas y votaciones)
-- Migración: 0007_governance
--
-- QUEJA QUE CORRIGE: "las asambleas no tienen quórum, las decisiones se
-- toman entre pocos, no hay actas claras y las votaciones se prestan a
-- trampa". Aquí el QUÓRUM se calcula por ALÍCUOTA, el voto se pondera por
-- coeficiente, se verifica identidad (portal) y queda todo con acta y bitácora.
-- ============================================================

-- ------------------------------------------------------------
-- Asambleas
--   type: ordinaria | extraordinaria
--   status: convocada | en_curso | cerrada | cancelada
--   quorum_required: fracción de alícuota requerida (0.50 = 50 %)
-- ------------------------------------------------------------
create table if not exists assemblies (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  title          text not null,
  type           text not null default 'ordinaria',
  status         text not null default 'convocada',
  scheduled_at   timestamptz,
  location       text not null default '',       -- presencial o "Virtual"
  is_virtual     boolean not null default false,
  quorum_required numeric(5,4) not null default 0.5,
  agenda         jsonb not null default '[]'::jsonb,  -- [{orden, punto}]
  minutes_url    text not null default '',        -- acta firmada (PDF)
  opened_at      timestamptz,
  closed_at      timestamptz,
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_assemblies_branch on assemblies (branch_id, scheduled_at desc);
create trigger trg_assemblies_updated before update on assemblies
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Asistencia / representación
--   attendance_alicuota: alícuota que representa (para sumar el quórum).
--   proxy_of_unit_id: si asiste por poder de otra unidad.
--   mode: presencial | virtual | poder
-- ------------------------------------------------------------
create table if not exists assembly_attendance (
  id                 uuid primary key default gen_random_uuid(),
  branch_id          uuid references branches(id) on delete cascade,
  assembly_id        uuid references assemblies(id) on delete cascade,
  unit_id            uuid references units(id) on delete set null,
  resident_id        uuid references residents(id) on delete set null,
  attendee_name      text not null default '',
  mode               text not null default 'presencial',
  proxy_of_unit_id   uuid references units(id) on delete set null,
  attendance_alicuota numeric(9,6) not null default 0,
  checked_in_at      timestamptz not null default now()
);
create unique index if not exists uq_attendance_unit
  on assembly_attendance (assembly_id, unit_id);
create index if not exists idx_attendance_assembly on assembly_attendance (assembly_id);

-- ------------------------------------------------------------
-- Votaciones / encuestas (dentro de una asamblea o independientes)
--   weighting: alicuota | un_voto_por_unidad
--   status: borrador | abierta | cerrada
--   type: single (una opción) | multiple | si_no
-- ------------------------------------------------------------
create table if not exists polls (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  assembly_id    uuid references assemblies(id) on delete set null,
  question       text not null,
  description    text not null default '',
  type           text not null default 'single',
  weighting      text not null default 'alicuota',
  status         text not null default 'borrador',
  opens_at       timestamptz,
  closes_at      timestamptz,
  result         jsonb not null default '{}'::jsonb, -- snapshot al cerrar
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_polls_branch on polls (branch_id, created_at desc);
create index if not exists idx_polls_assembly on polls (assembly_id);
create trigger trg_polls_updated before update on polls
  for each row execute function set_updated_at();

create table if not exists poll_options (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  poll_id        uuid references polls(id) on delete cascade,
  label          text not null,
  sort_order     integer not null default 0
);
create index if not exists idx_poll_options_poll on poll_options (poll_id, sort_order);

-- ------------------------------------------------------------
-- Votos
--   weight: peso aplicado (alícuota o 1). UNA fila por unidad y poll (unicidad
--   evita doble voto). resident_id deja rastro de QUIÉN votó por la unidad.
-- ------------------------------------------------------------
create table if not exists votes (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  poll_id        uuid references polls(id) on delete cascade,
  option_id      uuid references poll_options(id) on delete cascade,
  unit_id        uuid references units(id) on delete set null,
  resident_id    uuid references residents(id) on delete set null,
  weight         numeric(9,6) not null default 0,
  created_at     timestamptz not null default now()
);
create unique index if not exists uq_vote_unit on votes (poll_id, unit_id);
create index if not exists idx_votes_poll on votes (poll_id);
create index if not exists idx_votes_option on votes (option_id);

-- ------------------------------------------------------------
-- RLS: cerrado por defecto.
-- ------------------------------------------------------------
alter table assemblies          enable row level security;
alter table assembly_attendance enable row level security;
alter table polls               enable row level security;
alter table poll_options        enable row level security;
alter table votes               enable row level security;

-- >>>>>>>>>> 0008_access_security.sql <<<<<<<<<<

-- ============================================================
-- Condominios · Control de acceso y seguridad
-- Migración: 0008_access_security
--
-- QUEJA QUE CORRIGE: "no sé quién entra, la garita anota en un cuaderno, me
-- dejan pasar gente sin avisarme, y las encomiendas se pierden". Aquí el
-- residente PRE-AUTORIZA visitas desde el portal (con QR/código), la garita
-- registra entrada/salida, y las encomiendas se registran y notifican.
-- ============================================================

-- ------------------------------------------------------------
-- Visitas
--   kind: visita | proveedor | delivery | mudanza | taxi
--   status: preautorizada | dentro | salio | denegada | vencida
--   authorized_by: residente que la autoriza (desde el portal).
--   access_code / qr: para validar en garita sin llamar al residente.
-- ------------------------------------------------------------
create table if not exists visitors (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  unit_id        uuid references units(id) on delete set null,
  authorized_by  uuid references residents(id) on delete set null,
  kind           text not null default 'visita',
  full_name      text not null default '',
  document_number text not null default '',
  company        text not null default '',       -- proveedor/empresa
  vehicle_plate  text not null default '',
  access_code    text not null default '',        -- código/QR de un solo uso
  valid_from     timestamptz,
  valid_until    timestamptz,
  status         text not null default 'preautorizada',
  photo_url      text not null default '',
  note           text not null default '',
  created_by     text not null default '',         -- residente o conserje
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_visitors_branch on visitors (branch_id, created_at desc);
create index if not exists idx_visitors_unit on visitors (unit_id);
create index if not exists idx_visitors_code on visitors (branch_id, access_code);
create trigger trg_visitors_updated before update on visitors
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Bitácora de acceso (entradas/salidas efectivas registradas en garita)
--   direction: entrada | salida
--   subject_type: visitante | residente | vehiculo | proveedor
-- ------------------------------------------------------------
create table if not exists access_events (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  visitor_id     uuid references visitors(id) on delete set null,
  unit_id        uuid references units(id) on delete set null,
  subject_type   text not null default 'visitante',
  subject_label  text not null default '',        -- nombre/placa
  direction      text not null default 'entrada',
  gate           text not null default '',         -- "Peatonal", "Vehicular"
  recorded_by    text not null default '',         -- guardia
  photo_url      text not null default '',
  note           text not null default '',
  occurred_at    timestamptz not null default now()
);
create index if not exists idx_access_events_branch on access_events (branch_id, occurred_at desc);
create index if not exists idx_access_events_unit on access_events (unit_id);
create index if not exists idx_access_events_visitor on access_events (visitor_id);

-- ------------------------------------------------------------
-- Encomiendas / paquetería
--   status: recibida | notificada | entregada | devuelta
--   Al recibir, se notifica al residente; al entregar, firma/foto.
-- ------------------------------------------------------------
create table if not exists deliveries (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  unit_id        uuid references units(id) on delete set null,
  courier        text not null default '',         -- MRW, Zoom, Amazon, particular
  description    text not null default '',
  tracking       text not null default '',
  status         text not null default 'recibida',
  received_by    text not null default '',          -- conserje
  received_at    timestamptz not null default now(),
  notified_at    timestamptz,
  delivered_to   text not null default '',           -- quién retiró
  delivered_at   timestamptz,
  photo_url      text not null default '',
  signature_url  text not null default '',
  note           text not null default ''
);
create index if not exists idx_deliveries_branch on deliveries (branch_id, received_at desc);
create index if not exists idx_deliveries_unit on deliveries (unit_id, status);

-- ------------------------------------------------------------
-- RLS: cerrado por defecto.
-- ------------------------------------------------------------
alter table visitors       enable row level security;
alter table access_events  enable row level security;
alter table deliveries     enable row level security;

-- >>>>>>>>>> 0009_documents.sql <<<<<<<<<<

-- ============================================================
-- Condominios · Documentos
-- Migración: 0009_documents
--
-- QUEJA QUE CORRIGE: "el reglamento, las actas y los estados financieros no
-- aparecen o hay que pedirlos por WhatsApp". Repositorio único con categorías
-- y visibilidad (residentes vs solo junta), versionado simple y auditable.
-- ============================================================

create table if not exists documents (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  category       text not null default 'general', -- reglamento | acta | estado_financiero | poliza | contrato | plano | general
  title          text not null,
  description    text not null default '',
  file_url       text not null default '',
  file_name      text not null default '',
  file_size      integer not null default 0,
  -- quién puede verlo: residentes | junta | admin (jerárquico: admin ve todo)
  visibility     text not null default 'residentes',
  period_ref     text not null default '',         -- "2026-06" para estados mensuales
  version        integer not null default 1,
  is_active      boolean not null default true,
  uploaded_by    text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_documents_branch on documents (branch_id, category);
create index if not exists idx_documents_visibility on documents (branch_id, visibility);
create trigger trg_documents_updated before update on documents
  for each row execute function set_updated_at();

-- Acuse de lectura de documentos que lo requieran (ej. nuevo reglamento)
create table if not exists document_reads (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  document_id    uuid references documents(id) on delete cascade,
  resident_id    uuid references residents(id) on delete cascade,
  read_at        timestamptz not null default now()
);
create unique index if not exists uq_document_read on document_reads (document_id, resident_id);

alter table documents      enable row level security;
alter table document_reads enable row level security;

-- >>>>>>>>>> 0011_leases_commercial.sql <<<<<<<<<<

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
