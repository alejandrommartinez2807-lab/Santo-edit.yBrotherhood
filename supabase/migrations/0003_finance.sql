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
