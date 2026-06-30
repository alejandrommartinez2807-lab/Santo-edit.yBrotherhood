-- ============================================================
-- Santo Edit · Esquema inicial (Fase 0)
-- Migración: 0001_initial_schema
--
-- Reemplaza el backend de Google Sheets / Apps Script por Postgres.
-- Modelado relacional para lo crítico (pedidos, ítems, cuentas, mesas,
-- pagos) y JSONB para las configuraciones muy anidadas (menú, inventario,
-- cierres). Diseñado para que la app acceda desde las API routes de Next
-- usando la SERVICE ROLE KEY (bypassa RLS). RLS queda activado y cerrado
-- por defecto; las políticas públicas se añaden en la fase del flujo QR.
-- ============================================================

-- Extensiones --------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- Tipos enumerados ---------------------------------------------
-- (coinciden con los union types de src/types/localOrders.ts)
do $$ begin
  create type order_status as enum
    ('Nuevo','Preparando','Listo','Entregado','Cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum
    ('Pendiente','Pago parcial','Pagado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_type as enum
    ('Comer aquí','Para llevar','Delivery');
exception when duplicate_object then null; end $$;

do $$ begin
  create type open_account_status as enum
    ('Abierta','Cerrada','Cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_payment_in as enum
    ('Divisas','Bolívares','Mixto','Sin registrar');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_report_status as enum
    ('Sin reportar','Entrega reportada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_staff_confirmation_status as enum
    ('not_required','pending','partial','confirmed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_proof_status as enum
    ('Comprobante enviado','En revisión','Confirmado por caja','Rechazado','Necesita corrección');
exception when duplicate_object then null; end $$;

-- Función utilitaria: updated_at automático --------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- MESAS
-- ============================================================
create table if not exists tables (
  id          text primary key,            -- "mesa-1", "barra", ...
  name        text not null,               -- "Mesa 1"
  area        text not null default 'Principal',
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_tables_updated before update on tables
  for each row execute function set_updated_at();

-- ============================================================
-- CUENTAS ABIERTAS (por mesa)
-- ============================================================
create table if not exists open_accounts (
  id                uuid primary key default gen_random_uuid(),
  table_number      text not null,         -- nombre de mesa (ej. "Mesa 1")
  table_id          text references tables(id) on delete set null,
  customer_name     text not null default '',
  customer_phone    text,
  status            open_account_status not null default 'Abierta',
  note              text,
  opened_by         text,
  closed_by         text,
  closed_at         timestamptz,
  -- totales cacheados (se recalculan al enganchar/cobrar pedidos)
  total_estimated_usd  numeric(12,2) not null default 0,
  total_collected_usd  numeric(12,2) not null default 0,
  pending_usd          numeric(12,2) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_open_accounts_updated before update on open_accounts
  for each row execute function set_updated_at();

-- Solo UNA cuenta "Abierta" por mesa a la vez (clave para el flujo QR)
create unique index if not exists uq_open_account_per_table
  on open_accounts (table_number)
  where status = 'Abierta';

create index if not exists idx_open_accounts_status on open_accounts (status);

-- ============================================================
-- PEDIDOS
-- ============================================================
create table if not exists orders (
  id                text primary key,       -- id/numero visible del pedido
  display_number    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  customer_name     text not null default '',
  customer_phone    text,
  table_number      text not null default '',
  order_type        order_type not null default 'Comer aquí',
  customer_note     text not null default '',

  -- vínculo con cuenta abierta
  open_account_id     uuid references open_accounts(id) on delete set null,
  open_account_table  text,
  open_account_status open_account_status,

  -- delivery
  delivery_address           text,
  delivery_reference         text,
  delivery_zone              text,
  delivery_cost_usd          numeric(12,2) default 0,
  total_before_delivery_usd  numeric(12,2) default 0,

  -- ítems (relacional en order_items; copia de texto para compat.)
  items_text        text not null default '',

  -- totales
  total_price          numeric(12,2) not null default 0,
  total_ves            numeric(14,2) not null default 0,
  total_usd            numeric(12,2) default 0,
  total_combos_usd     numeric(12,2) default 0,
  total_regular_usd    numeric(12,2) default 0,
  total_regular_ves    numeric(14,2) default 0,

  -- tasa de cambio usada
  exchange_rate        numeric(14,4) not null default 0,
  exchange_source      text,
  exchange_value_date  text,

  status            order_status not null default 'Nuevo',

  -- reporte de delivery
  delivery_report_status  delivery_report_status default 'Sin reportar',
  delivery_reported_at    timestamptz,
  delivery_reported_by    text,

  -- inventario
  inventory_processed     boolean default false,
  inventory_processed_at  timestamptz,
  inventory_summary       text,
  inventory_warnings      text,
  inventory_movements     jsonb default '[]'::jsonb,

  -- confirmación de personal
  staff_confirmation_status          order_staff_confirmation_status default 'not_required',
  staff_confirmation_required_count  integer default 0,
  staff_confirmation_confirmed_count integer default 0,
  staff_confirmation_pending_count   integer default 0,
  staff_confirmation_updated_at      timestamptz,
  staff_confirmation_updated_by      text,

  -- pago (embebido; coincide con OrderPayment)
  payment_status               payment_status default 'Pendiente',
  amount_received_usd          numeric(12,2) default 0,
  amount_received_ves          numeric(14,2) default 0,
  payment_method_usd           text,
  payment_method_ves           text,
  delivery_payment_in          delivery_payment_in default 'Sin registrar',
  payment_note                 text,
  payment_total_order_usd      numeric(12,2) default 0,
  payment_received_equiv_usd   numeric(12,2) default 0,
  payment_pending_usd          numeric(12,2) default 0,
  payment_updated_at           timestamptz
);
create trigger trg_orders_updated before update on orders
  for each row execute function set_updated_at();

create index if not exists idx_orders_created_at on orders (created_at desc);
create index if not exists idx_orders_status on orders (status);
create index if not exists idx_orders_open_account on orders (open_account_id);
create index if not exists idx_orders_table on orders (table_number);

-- ============================================================
-- ÍTEMS DE PEDIDO
-- ============================================================
create table if not exists order_items (
  id                bigint generated always as identity primary key,
  order_id          text not null references orders(id) on delete cascade,
  line_id           text,                  -- cartLineId
  product_id        integer,               -- id del producto en el menú
  name              text not null,
  category          text,
  product_type      text,                  -- normal | variations | addons | buildable | combo
  payment_mode      text,                  -- divisa | mixto
  price             numeric(12,2) not null default 0,
  base_price        numeric(12,2),
  unit_options_price numeric(12,2),
  quantity          integer not null default 1,
  image             text,
  note              text,
  note_enabled      boolean default false,
  selection_summary text,
  -- selecciones complejas (variación, addons, removidos)
  selected_variation  jsonb,
  selected_addons     jsonb default '[]'::jsonb,
  removed_ingredients jsonb default '[]'::jsonb,
  -- confirmación de personal por línea
  requires_waiter_confirmation boolean default false,
  staff_confirmation_status    text,       -- pending | confirmed
  staff_confirmed_at           timestamptz,
  staff_confirmed_by           text,
  staff_confirmed_role         text,
  sort_order        integer not null default 0
);
create index if not exists idx_order_items_order on order_items (order_id);

-- ============================================================
-- COMPROBANTES DE PAGO
-- ============================================================
create table if not exists payment_proofs (
  id                 text primary key,
  order_id           text references orders(id) on delete set null,
  created_at         timestamptz not null default now(),
  customer_name      text default '',
  customer_phone     text default '',
  order_type         text default '',
  order_total_usd    numeric(12,2) default 0,
  reported_method    text default '',
  amount_reported_usd numeric(12,2) default 0,
  amount_reported_ves numeric(14,2) default 0,
  payment_reference  text default '',
  customer_note      text default '',
  proof_image_url    text default '',
  proof_file_id      text default '',
  proof_file_name    text default '',
  status             payment_proof_status not null default 'Comprobante enviado',
  reviewed_by        text default '',
  reviewed_at        timestamptz,
  internal_note      text default ''
);
create index if not exists idx_payment_proofs_order on payment_proofs (order_id);
create index if not exists idx_payment_proofs_status on payment_proofs (status);

-- ============================================================
-- ZONAS DE DELIVERY
-- ============================================================
create table if not exists delivery_zones (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  cost_usd    numeric(12,2) not null default 0,
  is_active   boolean not null default true,
  sort_order  integer not null default 0
);

-- ============================================================
-- CIERRES DE CAJA  (payload anidado en JSONB)
-- ============================================================
create table if not exists day_closes (
  id          uuid primary key default gen_random_uuid(),
  closed_at   timestamptz not null default now(),
  closed_by   text,
  business_date date,
  -- resumen del día (DaySummary, pagos, gastos, etc.)
  summary     jsonb not null default '{}'::jsonb,
  total_usd   numeric(12,2) default 0,
  total_ves   numeric(14,2) default 0,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_day_closes_date on day_closes (business_date);

-- ============================================================
-- GASTOS DEL DÍA
-- ============================================================
create table if not exists day_expenses (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  business_date date,
  label         text not null default '',
  category      text,
  amount_usd    numeric(12,2) not null default 0,
  amount_ves    numeric(14,2) not null default 0,
  note          text,
  created_by    text
);
create index if not exists idx_day_expenses_date on day_expenses (business_date);

-- ============================================================
-- PRODUCTOS DEL MENÚ  (config anidada en JSONB)
-- ============================================================
create table if not exists menu_products (
  id            bigint primary key,        -- id estable del producto
  name          text not null,
  category      text,
  description   text,
  price         numeric(12,2) not null default 0,
  image         text,
  product_type  text not null default 'normal',
  sales_channels text[] default array['local','takeaway','delivery'],
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  payment_mode  text default 'divisa',
  -- grupos de opciones, addons, combo, buildable, recetas vinculadas, etc.
  config        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_menu_products_updated before update on menu_products
  for each row execute function set_updated_at();

-- ============================================================
-- INVENTARIO  (insumos)
-- ============================================================
create table if not exists inventory_items (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  unit          text,                       -- "g", "ml", "unidad"...
  category      text,
  stock         numeric(14,3) not null default 0,
  min_stock     numeric(14,3) not null default 0,
  cost_usd      numeric(12,4) default 0,
  is_active     boolean not null default true,
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_inventory_items_updated before update on inventory_items
  for each row execute function set_updated_at();

-- Recetas: relación producto del menú -> insumos consumidos
create table if not exists inventory_recipes (
  id            uuid primary key default gen_random_uuid(),
  product_id    bigint references menu_products(id) on delete cascade,
  -- líneas de receta: [{ inventory_item_id, quantity, unit }]
  lines         jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_inventory_recipes_updated before update on inventory_recipes
  for each row execute function set_updated_at();
create index if not exists idx_inventory_recipes_product on inventory_recipes (product_id);

-- ============================================================
-- CONFIGURACIÓN DEL NEGOCIO  (fila única + planes/módulos en JSONB)
-- ============================================================
create table if not exists business_config (
  id            integer primary key default 1,
  config        jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  constraint business_config_single_row check (id = 1)
);
create trigger trg_business_config_updated before update on business_config
  for each row execute function set_updated_at();

-- ============================================================
-- RLS · cerrado por defecto
-- La app accede vía SERVICE ROLE KEY desde las API routes (bypassa RLS).
-- Las políticas públicas (lectura de estado de mesa para el QR) se añaden
-- en la migración de la Fase 2.
-- ============================================================
alter table tables             enable row level security;
alter table open_accounts      enable row level security;
alter table orders             enable row level security;
alter table order_items        enable row level security;
alter table payment_proofs     enable row level security;
alter table delivery_zones     enable row level security;
alter table day_closes         enable row level security;
alter table day_expenses       enable row level security;
alter table menu_products      enable row level security;
alter table inventory_items    enable row level security;
alter table inventory_recipes  enable row level security;
alter table business_config    enable row level security;
