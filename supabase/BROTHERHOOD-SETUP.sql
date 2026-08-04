-- ============================================================
-- BROTHERHOOD — Esquema completo (todas las migraciones en orden)
-- Generado a partir de supabase/migrations/*.sql
-- Pega TODO este archivo en Supabase → SQL Editor → Run.
-- Es idempotente: si lo corres dos veces no rompe ni duplica.
--
-- NO lo edites a mano: se regenera con `npm run setup:sql`.
-- ============================================================


-- ============================================================
-- >>> 0001_initial_schema.sql
-- ============================================================

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


-- ============================================================
-- >>> 0002_seed_defaults.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Semilla de datos por defecto (Fase 0)
-- Migración: 0002_seed_defaults
-- Mesas iniciales + fila única de configuración del negocio.
-- Idempotente: se puede correr varias veces sin duplicar.
-- ============================================================

-- Mesas por defecto (coinciden con DEFAULT_LOCAL_TABLES) --------
insert into tables (id, name, area, sort_order, is_active) values
  ('mesa-1', 'Mesa 1', 'Principal', 1, true),
  ('mesa-2', 'Mesa 2', 'Principal', 2, true),
  ('mesa-3', 'Mesa 3', 'Principal', 3, true),
  ('mesa-4', 'Mesa 4', 'Principal', 4, true),
  ('barra',  'Barra',  'Barra',     5, true),
  ('afuera', 'Afuera', 'Exterior',  6, true)
on conflict (id) do nothing;

-- Fila única de configuración (se rellena luego desde el panel) -
insert into business_config (id, config) values (1, '{}'::jsonb)
on conflict (id) do nothing;


-- ============================================================
-- >>> 0003_orders_seq.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Numeración secuencial de pedidos (Fase 1)
-- Migración: 0003_orders_seq
--
-- La UI (caja/cocina) muestra el número de pedido a partir de `rowNumber`.
-- Antes lo daba la fila de la hoja de Google. Ahora usamos una secuencia
-- propia en Postgres: cada pedido recibe un `seq` correlativo y estable.
-- ============================================================

alter table orders
  add column if not exists seq bigint generated by default as identity;

create index if not exists idx_orders_seq on orders (seq);


-- ============================================================
-- >>> 0005_inventory.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Inventario (Fase 3c)
-- Migración: 0005_inventory
--
-- Recrea las tablas de inventario para que calcen con la forma real que usa
-- la app (ids de texto, campos planos) y agrega la tabla de movimientos.
-- Las tablas previas (inventory_items, inventory_recipes) estaban vacías
-- (nunca se usaron), por eso se pueden recrear sin pérdida de datos.
-- ============================================================

drop table if exists inventory_recipes cascade;
drop table if exists inventory_items cascade;

-- Insumos ------------------------------------------------------
create table inventory_items (
  id                   text primary key,         -- id de texto (ej. "inv-...")
  name                 text not null,
  category             text not null default 'General',
  quantity             numeric(14,3) not null default 0,
  unit                 text not null default 'unidades',
  minimum_stock        numeric(14,3) not null default 0,
  cost_usd             numeric(12,4) not null default 0,
  cost_ves             numeric(14,4) not null default 0,
  equivalent_cost_usd  numeric(12,4) not null default 0,
  note                 text not null default '',
  is_active            boolean not null default true,
  updated_at           timestamptz not null default now()
);
create index idx_inventory_items_active on inventory_items (is_active);

-- Movimientos de inventario ------------------------------------
create table inventory_movements (
  id                 text primary key,
  date_label         text not null default '',
  item_id            text not null,
  item_name          text not null default '',
  movement_type      text not null default 'Ajuste',
  previous_quantity  numeric(14,3) not null default 0,
  quantity_moved     numeric(14,3) not null default 0,
  final_quantity     numeric(14,3) not null default 0,
  unit               text not null default 'unidades',
  reason             text not null default 'Movimiento manual',
  related_expense    boolean not null default false,
  expense_id         text not null default '',
  note               text not null default '',
  created_at         timestamptz not null default now()
);
create index idx_inventory_movements_item on inventory_movements (item_id);
create index idx_inventory_movements_created on inventory_movements (created_at desc);

-- Recetas (producto del menú -> insumos consumidos) ------------
create table inventory_recipes (
  id                text primary key,            -- id de texto (ej. "rec-...")
  product_id        bigint not null default 0,
  product_name      text not null default '',
  product_category  text not null default '',
  ingredients       jsonb not null default '[]'::jsonb,  -- [{itemId,itemName,quantity,unit}]
  note              text not null default '',
  is_active         boolean not null default true,
  updated_at        timestamptz not null default now()
);
create index idx_inventory_recipes_product on inventory_recipes (product_id);

-- RLS: cerrado por defecto (solo el servidor con service role key) ---
alter table inventory_items     enable row level security;
alter table inventory_movements enable row level security;
alter table inventory_recipes   enable row level security;


-- ============================================================
-- >>> 0006_caja.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Caja: cierres y gastos (Fase 3d)
-- Migración: 0006_caja
--
-- Recrea day_closes y day_expenses con id de texto + payload JSONB (igual
-- patrón que inventario). Estaban vacías en Supabase (nunca se usaron).
-- Los comprobantes (payment_proofs) ya calzan con el esquema de la Fase 0,
-- así que no se tocan aquí.
-- ============================================================

drop table if exists day_expenses cascade;
drop table if exists day_closes cascade;

-- Cierres de caja: todo el resumen del día en `data` -----------
create table day_closes (
  id          text primary key,
  created_at  timestamptz not null default now(),
  data        jsonb not null default '{}'::jsonb
);
create index idx_day_closes_created on day_closes (created_at desc);

-- Gastos del día: payload en `data`, con columnas sueltas para filtrar
create table day_expenses (
  id            text primary key,
  created_at    timestamptz not null default now(),
  date_value    text not null default '',
  close_status  text not null default '',
  data          jsonb not null default '{}'::jsonb
);
create index idx_day_expenses_date on day_expenses (date_value);
create index idx_day_expenses_close on day_expenses (close_status);

-- RLS: cerrado (solo servidor con service role key) ------------
alter table day_closes   enable row level security;
alter table day_expenses enable row level security;


-- ============================================================
-- >>> 0007_order_attachment.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Imagen adjunta al pedido
-- Migración: 0007_order_attachment
--
-- Permite que el cliente adjunte una imagen al registrar el pedido (ej.
-- comprobante o referencia visual). La imagen se guarda en el bucket
-- `order-attachments` de Storage y su URL queda en el propio pedido, para
-- mostrarse tanto en Caja como en el panel de Pedidos.
-- ============================================================

alter table orders
  add column if not exists attachment_image_url text;


-- ============================================================
-- >>> 0008_staff_auth.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Auth real (Supabase Auth) · Fase A
-- Migración: 0008_staff_auth
--
-- Tabla de usuarios del personal, ligada a Supabase Auth (auth.users).
-- Cada miembro del personal es un usuario de Supabase Auth (email+clave) y
-- aquí guardamos su ROL y estado. Reemplaza (por fases) las contraseñas en
-- .env. La autorización por rol sigue igual; solo cambia cómo se identifican.
-- ============================================================

create table if not exists staff_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        text not null,            -- owner | manager | cashier | waiter | kitchen | delivery | support | provider | admin
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_staff_users_role on staff_users (role);

alter table staff_users enable row level security;

-- Un usuario autenticado puede leer SU PROPIA fila (para conocer su rol).
-- El servidor (service role) ve todas y se salta RLS.
do $$ begin
  create policy "staff can read own row"
    on staff_users for select
    using (auth.uid() = id);
exception when duplicate_object then null; end $$;


-- ============================================================
-- >>> 0009_branches.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Multi-sucursal (Fase 1: fundación)
-- Migración: 0009_branches
--
-- Cada sucursal tiene su propio menú, inventario, pedidos, caja y cierres.
-- Se agrega branch_id a todas las tablas operativas. Los datos existentes se
-- reasignan a una sucursal "Principal" creada aquí, para no perder nada.
-- (business_config sigue compartido: marca, tema y módulos del negocio.)
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table branches enable row level security;

-- Sucursal por defecto (idempotente: solo si no hay ninguna).
insert into branches (name, sort_order)
select 'Principal', 1
where not exists (select 1 from branches);

-- Agrega branch_id a las tablas operativas (nullable; se backfillea abajo).
do $$
declare
  t text;
  tables text[] := array[
    'menu_products', 'tables', 'orders', 'open_accounts',
    'inventory_items', 'inventory_movements', 'inventory_recipes',
    'day_closes', 'day_expenses', 'delivery_zones', 'payment_proofs'
  ];
  default_branch uuid;
begin
  select id into default_branch from branches order by sort_order, created_at limit 1;

  foreach t in array tables loop
    execute format('alter table %I add column if not exists branch_id uuid references branches(id) on delete cascade', t);
    execute format('update %I set branch_id = %L where branch_id is null', t, default_branch);
    execute format('create index if not exists idx_%s_branch on %I (branch_id)', t, t);
  end loop;
end $$;


-- ============================================================
-- >>> 0010_order_fiscal.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Desglose fiscal fijado en la orden
-- Migración: 0010_order_fiscal
--
-- Guarda el desglose fiscal (IVA por tasa, IGTF, total) calculado AL COBRAR,
-- para que no cambie aunque luego se editen precios o tasas. Y la tasa de IVA
-- usada por cada ítem en esa venta.
-- ============================================================

alter table orders add column if not exists fiscal jsonb;
alter table order_items add column if not exists iva_rate numeric;


-- ============================================================
-- >>> 0011_suppliers.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Proveedores (Fase 1: CRUD / listado)
-- Migración: 0011_suppliers
--
-- Tabla base de proveedores por sucursal. Fase 1 es de bajo riesgo:
-- solo datos de contacto (nombre, contacto, teléfono, email, nota). No
-- toca cobro ni inventario todavía; eso queda para fases posteriores.
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists suppliers (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references branches(id) on delete cascade,
  name         text not null,
  contact_name text not null default '',
  phone        text not null default '',
  email        text not null default '',
  note         text not null default '',
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_suppliers_branch on suppliers (branch_id);

-- RLS: cerrado por defecto (solo el servidor con service role key).
alter table suppliers enable row level security;


-- ============================================================
-- >>> 0012_supplier_purchases.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Compras a proveedores (Proveedores Fase 2a)
-- Migración: 0012_supplier_purchases
--
-- Registro e historial de compras a cada proveedor. Bajo riesgo: solo
-- captura el dato de la compra (proveedor, fecha, documento, total, nota).
-- NO toca inventario ni cuentas por pagar todavía (fases posteriores).
--
-- supplier_id es ON DELETE SET NULL y guardamos un snapshot `supplier_name`
-- para que el historial de compras sobreviva si se elimina el proveedor.
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists supplier_purchases (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id) on delete cascade,
  supplier_id     uuid references suppliers(id) on delete set null,
  supplier_name   text not null default '',
  purchase_date   date not null default current_date,
  document_number text not null default '',
  total_usd       numeric(14,2) not null default 0,
  total_ves       numeric(16,2) not null default 0,
  note            text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists idx_supplier_purchases_branch on supplier_purchases (branch_id);
create index if not exists idx_supplier_purchases_supplier on supplier_purchases (supplier_id);

-- RLS: cerrado por defecto (solo el servidor con service role key).
alter table supplier_purchases enable row level security;


-- ============================================================
-- >>> 0013_supplier_purchase_inventory.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Compras → Inventario (Proveedores Fase 2b)
-- Migración: 0013_supplier_purchase_inventory
--
-- Permite que una compra a proveedor sume stock a un insumo del inventario.
-- Es OPCIONAL por compra. La entrada de stock se registra como un movimiento
-- de inventario ("Compra") para auditoría.
--
-- Comportamiento ADITIVO: la entrada aplicada al inventario NO se revierte al
-- editar o borrar la compra (igual que el flujo gasto→inventario existente).
--
-- inventory_item_id es ON DELETE SET NULL (si se borra el insumo, la compra
-- conserva el snapshot del nombre/cantidad).
-- ============================================================

alter table supplier_purchases
  add column if not exists inventory_item_id text references inventory_items(id) on delete set null,
  add column if not exists inventory_item_name text not null default '',
  add column if not exists inventory_quantity numeric(14,3) not null default 0,
  add column if not exists inventory_unit text not null default '',
  add column if not exists inventory_movement_id text not null default '';

create index if not exists idx_supplier_purchases_inv_item on supplier_purchases (inventory_item_id);


-- ============================================================
-- >>> 0014_supplier_payables.sql
-- ============================================================

-- 0014_supplier_payables.sql
-- Fase 2d: Cuentas por pagar de proveedores.
-- Agrega vencimientos, estado de pago, acumulados pagados y tabla de abonos.

alter table if exists supplier_purchases
  add column if not exists due_date date,
  add column if not exists paid_usd numeric(12,2) not null default 0,
  add column if not exists paid_ves numeric(14,2) not null default 0,
  add column if not exists payment_status text not null default 'Pendiente',
  add column if not exists payment_method text not null default '',
  add column if not exists payment_reference text not null default '',
  add column if not exists payment_note text not null default '',
  add column if not exists last_payment_at timestamptz;

update supplier_purchases
set
  paid_usd = coalesce(paid_usd, 0),
  paid_ves = coalesce(paid_ves, 0),
  payment_status = case
    when coalesce(paid_usd, 0) <= 0 and coalesce(paid_ves, 0) <= 0 then 'Pendiente'
    when coalesce(total_usd, 0) > 0 and coalesce(paid_usd, 0) >= coalesce(total_usd, 0) - 0.01 then 'Pagado'
    when coalesce(total_usd, 0) <= 0 and coalesce(total_ves, 0) > 0 and coalesce(paid_ves, 0) >= coalesce(total_ves, 0) - 0.01 then 'Pagado'
    else 'Parcial'
  end,
  payment_method = coalesce(payment_method, ''),
  payment_reference = coalesce(payment_reference, ''),
  payment_note = coalesce(payment_note, '')
where true;

create table if not exists supplier_purchase_payments (
  id text primary key,
  branch_id text,
  purchase_id text not null,
  supplier_id text,
  supplier_name text not null default '',
  payment_date date not null default current_date,
  amount_usd numeric(12,2) not null default 0,
  amount_ves numeric(14,2) not null default 0,
  method text not null default '',
  reference text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_supplier_purchase_payments_branch
  on supplier_purchase_payments(branch_id);

create index if not exists idx_supplier_purchase_payments_purchase
  on supplier_purchase_payments(purchase_id);

create index if not exists idx_supplier_purchase_payments_supplier
  on supplier_purchase_payments(supplier_id);

create index if not exists idx_supplier_purchase_payments_date
  on supplier_purchase_payments(payment_date desc);

create index if not exists idx_supplier_purchases_payment_status
  on supplier_purchases(payment_status);

create index if not exists idx_supplier_purchases_due_date
  on supplier_purchases(due_date);

-- Constraints idempotentes para instalaciones que corren migraciones manualmente.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'supplier_purchases_payment_status_check'
  ) then
    alter table supplier_purchases
      add constraint supplier_purchases_payment_status_check
      check (payment_status in ('Pendiente', 'Parcial', 'Pagado'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'supplier_purchase_payments_amount_check'
  ) then
    alter table supplier_purchase_payments
      add constraint supplier_purchase_payments_amount_check
      check (amount_usd >= 0 and amount_ves >= 0 and (amount_usd > 0 or amount_ves > 0));
  end if;
end $$;


-- ============================================================
-- >>> 0015_business_complexity_controls.sql
-- ============================================================

-- 0015 — Controles de complejidad y permisos configurables por el dueño.
-- No crea tablas nuevas: completa business_config.config con defaults seguros.

insert into public.business_config (id, config)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

update public.business_config
set config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
  'businessComplexityLevel', coalesce(nullif(trim(config->>'businessComplexityLevel'), ''), 'standard'),
  'publicOrderingEnabled', coalesce(case lower(config->>'publicOrderingEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicDineInEnabled', coalesce(case lower(config->>'publicDineInEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicTakeawayEnabled', coalesce(case lower(config->>'publicTakeawayEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicDeliveryOrdersEnabled', coalesce(case lower(config->>'publicDeliveryOrdersEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicOpenAccountEnabled', coalesce(case lower(config->>'publicOpenAccountEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicPaymentProofUploadEnabled', coalesce(case lower(config->>'publicPaymentProofUploadEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicIngredientCustomizationEnabled', coalesce(case lower(config->>'publicIngredientCustomizationEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicProductNotesEnabled', coalesce(case lower(config->>'publicProductNotesEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicCustomerNotesEnabled', coalesce(case lower(config->>'publicCustomerNotesEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicOrderAttachmentEnabled', coalesce(case lower(config->>'publicOrderAttachmentEnabled') when 'true' then true when 'false' then false else null end, true),
  'publicCustomerPhoneRequired', coalesce(case lower(config->>'publicCustomerPhoneRequired') when 'true' then true when 'false' then false else null end, false),
  'staffCanCancelOrdersEnabled', coalesce(case lower(config->>'staffCanCancelOrdersEnabled') when 'true' then true when 'false' then false else null end, true),
  'staffCanEditOrderNotesEnabled', coalesce(case lower(config->>'staffCanEditOrderNotesEnabled') when 'true' then true when 'false' then false else null end, true),
  'staffCanReopenPaymentsEnabled', coalesce(case lower(config->>'staffCanReopenPaymentsEnabled') when 'true' then true when 'false' then false else null end, false),
  'ownerCloseRequiresReviewEnabled', coalesce(case lower(config->>'ownerCloseRequiresReviewEnabled') when 'true' then true when 'false' then false else null end, false),
  'inventoryAutoDeductEnabled', coalesce(case lower(config->>'inventoryAutoDeductEnabled') when 'true' then true when 'false' then false else null end, false),
  'reportsAdvancedVisibleEnabled', coalesce(case lower(config->>'reportsAdvancedVisibleEnabled') when 'true' then true when 'false' then false else null end, true),
  'updatedAt', coalesce(nullif(trim(config->>'updatedAt'), ''), now()::text)
)
where id = 1;


-- ============================================================
-- >>> 0016_internal_owner_permissions.sql
-- ============================================================

-- Fase 2g — Permisos internos del dueño y preparación segura de inventario automático.
-- Idempotente: agrega valores por defecto en business_config.config sin pisar decisiones existentes.

DO $$
DECLARE
  cfg jsonb;
BEGIN
  INSERT INTO public.business_config (id, config)
  VALUES (1, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  SELECT COALESCE(config, '{}'::jsonb)
    INTO cfg
  FROM public.business_config
  WHERE id = 1
  FOR UPDATE;

  IF NOT (cfg ? 'businessComplexityProfile') THEN
    cfg := jsonb_set(cfg, '{businessComplexityProfile}', to_jsonb('advanced'::text), true);
  END IF;

  IF NOT (cfg ? 'publicAllowOrdering') THEN cfg := jsonb_set(cfg, '{publicAllowOrdering}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicAllowEatHere') THEN cfg := jsonb_set(cfg, '{publicAllowEatHere}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicAllowTakeaway') THEN cfg := jsonb_set(cfg, '{publicAllowTakeaway}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicAllowDelivery') THEN cfg := jsonb_set(cfg, '{publicAllowDelivery}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicAllowOpenAccounts') THEN cfg := jsonb_set(cfg, '{publicAllowOpenAccounts}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicAllowPaymentProofs') THEN cfg := jsonb_set(cfg, '{publicAllowPaymentProofs}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicAllowProductCustomization') THEN cfg := jsonb_set(cfg, '{publicAllowProductCustomization}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicAllowCustomerNotes') THEN cfg := jsonb_set(cfg, '{publicAllowCustomerNotes}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicAllowAttachments') THEN cfg := jsonb_set(cfg, '{publicAllowAttachments}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'publicRequireCustomerPhone') THEN cfg := jsonb_set(cfg, '{publicRequireCustomerPhone}', 'false'::jsonb, true); END IF;

  IF NOT (cfg ? 'internalAllowCancelOrders') THEN cfg := jsonb_set(cfg, '{internalAllowCancelOrders}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'internalAllowEditOrderNotes') THEN cfg := jsonb_set(cfg, '{internalAllowEditOrderNotes}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'internalAllowReopenPayments') THEN cfg := jsonb_set(cfg, '{internalAllowReopenPayments}', 'true'::jsonb, true); END IF;
  IF NOT (cfg ? 'internalRequireCloseReview') THEN cfg := jsonb_set(cfg, '{internalRequireCloseReview}', 'false'::jsonb, true); END IF;
  IF NOT (cfg ? 'internalShowAdvancedReports') THEN cfg := jsonb_set(cfg, '{internalShowAdvancedReports}', 'true'::jsonb, true); END IF;

  -- Preparado pero apagado: no descuenta inventario automáticamente en esta fase.
  IF NOT (cfg ? 'inventoryAutoDeductEnabled') THEN cfg := jsonb_set(cfg, '{inventoryAutoDeductEnabled}', 'false'::jsonb, true); END IF;
  IF NOT (cfg ? 'inventoryAutoDeductDryRun') THEN cfg := jsonb_set(cfg, '{inventoryAutoDeductDryRun}', 'true'::jsonb, true); END IF;

  UPDATE public.business_config
  SET config = cfg
  WHERE id = 1;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'business_config'
      AND column_name = 'updated_at'
  ) THEN
    UPDATE public.business_config
    SET updated_at = NOW()
    WHERE id = 1;
  END IF;
END $$;


-- ============================================================
-- >>> 0017_audit_logs.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Bitácora de auditoría (audit log)
-- Migración: 0017_audit_logs
--
-- Registro append-only de mutaciones sensibles: quién hizo qué, cuándo y
-- desde dónde. Lo escribe `src/lib/audit.ts` (writeAuditLog) desde las rutas
-- de API tras una acción exitosa. branch_id es TEXT sin FK a propósito: la
-- escritura de auditoría NUNCA debe fallar por una FK o un branch nulo.
--
-- Las columnas coinciden 1:1 con el insert de writeAuditLog. La PK tiene
-- default (gen_random_uuid) porque el código no envía id.
-- ============================================================

create extension if not exists "pgcrypto";

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

-- RLS: cerrado por defecto (solo el servidor con service role key lo lee/escribe).
alter table audit_logs enable row level security;


-- ============================================================
-- >>> 0018_order_idempotency.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Idempotencia de pedidos (sync offline)
-- Migración: 0018_order_idempotency
--
-- Cuando un POS pierde internet, los pedidos se encolan localmente y se
-- reenvían al reconectar (ver src/lib/offlineQueue + OfflineSync). Si un
-- pedido SÍ llegó al servidor pero la red se cortó antes de la respuesta,
-- el reintento crearía un DUPLICADO. Para evitarlo, el cliente genera una
-- clave única por pedido (client_order_id, un uuid) que viaja en el payload
-- y se reusa en cada reintento. El servidor, antes de crear, busca esa clave
-- y si ya existe devuelve el pedido existente en vez de crear otro.
--
-- El índice único parcial garantiza la unicidad incluso ante reintentos
-- concurrentes (la segunda inserción falla y el código devuelve el existente).
-- Es parcial (where client_order_id is not null) para no afectar a los
-- pedidos históricos ni a los creados sin clave (canal normal con red).
-- ============================================================

alter table orders
  add column if not exists client_order_id text;

create unique index if not exists idx_orders_client_order_id
  on orders (client_order_id)
  where client_order_id is not null;


-- ============================================================
-- >>> 0019_reservations.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Reservas (Fase 5)
-- Migración: 0019_reservations
--
-- Reservas por sucursal + mesa + franja horaria. La mesa se guarda por
-- table_id (id de la mesa en businessConfig.localTables) más un snapshot
-- del nombre, porque las mesas viven en la configuración y no en SQL.
-- El solape de franjas se valida en la capa de aplicación
-- (src/lib/reservationConflicts.ts); aquí solo persistimos.
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists reservations (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid references branches(id) on delete cascade,
  table_id         text not null default '',
  table_name       text not null default '',
  customer_name    text not null,
  customer_phone   text not null default '',
  party_size       integer not null default 2,
  reservation_date date not null,
  start_time       text not null,  -- "HH:MM" (24h, hora local del negocio)
  end_time         text not null,  -- "HH:MM"
  status           text not null default 'activa', -- activa | completada | cancelada | no_show
  note             text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_reservations_branch_date
  on reservations (branch_id, reservation_date);

-- RLS: cerrado por defecto (solo el servidor con service role key).
alter table reservations enable row level security;


-- ============================================================
-- >>> 0020_subrecipes.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Subrecetas (recetas base reutilizables)
-- Migración: 0020_subrecipes
--
-- Preparaciones base (carnes, masas, salsas, mezclas) hechas a partir de
-- insumos del inventario. Cada subreceta rinde una cantidad (yield) y guarda
-- sus ingredientes como jsonb, igual que inventory_recipes. El costo se calcula
-- en lectura a partir del costo de cada insumo (no se almacena).
-- Aislada por sucursal (branch_id) y con RLS cerrado (solo service role).
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists subrecipes (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  name           text not null,
  yield_quantity numeric(14,3) not null default 1,
  yield_unit     text not null default 'porción',
  ingredients    jsonb not null default '[]'::jsonb, -- [{itemId,itemName,quantity,unit}]
  note           text not null default '',
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_subrecipes_branch on subrecipes (branch_id);

-- RLS: cerrado por defecto (solo el servidor con service role key).
alter table subrecipes enable row level security;


-- ============================================================
-- >>> 0021_training_mode.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Modo entrenamiento
-- Migración: 0021_training_mode
--
-- Marca de "pedido de práctica". Los pedidos creados con Modo entrenamiento
-- activo quedan con is_training = true y se EXCLUYEN de reportes, del descuento
-- de inventario al entregar y del cierre real. Por defecto false: los pedidos
-- y negocios existentes no cambian en nada hasta que alguien use el modo.
-- ============================================================

alter table orders
  add column if not exists is_training boolean not null default false;

-- Índice parcial: la inmensa mayoría de pedidos son reales (false), así que
-- solo indexamos los de entrenamiento para filtrarlos barato.
create index if not exists idx_orders_is_training
  on orders (is_training)
  where is_training = true;


-- ============================================================
-- >>> 0022_order_attribution.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Atribución de ventas por persona
-- Migración: 0022_order_attribution
--
-- Guarda QUIÉN registró y QUIÉN cobró cada pedido, para el reporte de
-- ventas por vendedor/promotor y el desglose del cierre de caja/evento.
--
-- Columnas TEXT sin FK a propósito (mismo criterio que audit_logs y
-- delivery_reported_by): el pedido nunca debe fallar por un staff borrado.
-- - registered_by_*: staff que registró el pedido. NULL = pedido hecho por
--   el cliente desde la página pública (QR/web).
-- - charged_by_*: staff que registró el cobro (caja). Se escribe al cobrar.
--
-- El código escribe estas columnas de forma tolerante: si esta migración
-- aún no está aplicada, reintenta sin atribución (no rompe venta ni cobro).
-- ============================================================

alter table orders add column if not exists registered_by_id   text;
alter table orders add column if not exists registered_by_name text;
alter table orders add column if not exists registered_by_role text;

alter table orders add column if not exists charged_by_id   text;
alter table orders add column if not exists charged_by_name text;
alter table orders add column if not exists charged_by_role text;

-- Reporte de ventas por vendedor: agrupa por quien cobró.
create index if not exists idx_orders_charged_by on orders (charged_by_id);


-- ============================================================
-- >>> 0023_push_subscriptions.sql
-- ============================================================

-- 0023: Suscripciones web push del seguimiento de pedido público.
-- El cliente que toca "Avisarme cuando esté listo" en su confirmación o en
-- /pedido/<id> queda suscrito; al pasar el pedido a "Listo" el servidor le
-- manda la notificación aunque tenga el teléfono bloqueado.
-- Idempotente: se puede correr más de una vez.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  endpoint text not null unique,
  subscription jsonb not null,
  branch_id text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_order_id_idx
  on public.push_subscriptions (order_id);

-- RLS cerrado: solo el servidor (service role) lee/escribe.
alter table public.push_subscriptions enable row level security;


-- ============================================================
-- >>> 0024_delivery_distance.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Envío por distancia (Google Maps + km)
-- Migración: 0024_delivery_distance
--
-- El cliente pega su link de Google Maps (o comparte su GPS) y el costo del
-- delivery se calcula por kilómetros desde la sede, con tarifas por rango
-- ("hasta 10 km → $6"). Una fila de configuración por sucursal; si una sede
-- no tiene fila propia, hereda la de la sucursal principal (se resuelve en
-- código, igual que el menú por sede).
-- ============================================================

create table if not exists delivery_distance_settings (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id) on delete cascade,
  enabled         boolean not null default false,
  -- Link de Google Maps del local (lo pega el dueño en Configuración).
  origin_maps_url text not null default '',
  origin_lat      double precision,
  origin_lng      double precision,
  -- La distancia se mide en línea recta; este factor compensa la ruta real.
  road_factor     numeric not null default 1.3,
  -- Tarifas por rango: [{"upToKm": 3, "costUSD": 2}, {"upToKm": 10, "costUSD": 6}]
  tiers           jsonb not null default '[]'::jsonb,
  updated_at      timestamptz not null default now()
);

alter table delivery_distance_settings enable row level security;

-- Una sola fila por sucursal (branch_id null = configuración global/heredable).
create unique index if not exists uq_delivery_distance_settings_branch
  on delivery_distance_settings (coalesce(branch_id::text, 'global'));

create index if not exists idx_delivery_distance_settings_branch
  on delivery_distance_settings (branch_id);


-- ============================================================
-- >>> 0025_orders_branch_seq.sql
-- ============================================================

-- ============================================================
-- Santo Edit · Numeración de pedidos POR SEDE (con inicial)
-- Migración: 0025_orders_branch_seq
--
-- Antes el número visible del pedido salía de `orders.seq`, un identity GLOBAL:
-- por eso el número subía a la vez en todas las sedes. Ahora cada sede lleva su
-- propio correlativo (`branch_seq`) y guardamos la inicial de la sede
-- (`branch_code`, primera letra del nombre en minúscula) para mostrar #40-s.
--
-- El código de la app cae al `seq` global si estas columnas están vacías, así
-- que la app sigue funcionando aunque esta migración aún no se haya aplicado.
-- ============================================================

alter table orders
  add column if not exists branch_seq bigint;
alter table orders
  add column if not exists branch_code text;

-- Contador por sede: una fila por sede (branch_key = branch_id, con un UUID
-- centinela para pedidos sin sede). Se incrementa de forma atómica.
create table if not exists order_branch_counters (
  branch_key uuid primary key,
  last_seq   bigint not null default 0
);

-- Asigna branch_seq (correlativo por sede) y branch_code (inicial de la sede)
-- en cada inserción. El `on conflict ... returning` bloquea la fila del contador
-- y devuelve el nuevo valor: es seguro ante inserciones concurrentes.
create or replace function assign_order_branch_seq()
returns trigger as $$
declare
  v_key uuid := coalesce(NEW.branch_id, '00000000-0000-0000-0000-000000000000'::uuid);
  v_seq bigint;
begin
  if NEW.branch_seq is null then
    insert into order_branch_counters (branch_key, last_seq)
    values (v_key, 1)
    on conflict (branch_key)
      do update set last_seq = order_branch_counters.last_seq + 1
    returning last_seq into v_seq;
    NEW.branch_seq := v_seq;
  end if;

  if NEW.branch_code is null or NEW.branch_code = '' then
    NEW.branch_code := lower(left(coalesce(
      (select name from branches where id = NEW.branch_id), ''
    ), 1));
  end if;

  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_assign_order_branch_seq on orders;
create trigger trg_assign_order_branch_seq
  before insert on orders
  for each row
  execute function assign_order_branch_seq();

-- ---------- Backfill de pedidos existentes (idempotente) ----------

-- 1) Correlativo por sede según el orden histórico (seq global, luego fecha).
with ranked as (
  select
    id,
    row_number() over (
      partition by coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
      order by seq, created_at
    ) as rn
  from orders
)
update orders o
set branch_seq = r.rn
from ranked r
where o.id = r.id
  and o.branch_seq is null;

-- 2) Contadores al máximo por sede, para que las próximas inserciones sigan.
insert into order_branch_counters (branch_key, last_seq)
select
  coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
  max(branch_seq)
from orders
group by 1
on conflict (branch_key)
  do update set last_seq = greatest(order_branch_counters.last_seq, excluded.last_seq);

-- 3) Inicial de la sede en pedidos ya existentes.
update orders o
set branch_code = lower(left(b.name, 1))
from branches b
where o.branch_id = b.id
  and (o.branch_code is null or o.branch_code = '');

create index if not exists idx_orders_branch_seq on orders (branch_id, branch_seq);


-- ============================================================
-- >>> 0026_kitchen_started_and_item_delivery.sql
-- ============================================================

-- ============================================================
-- 0026: Cronómetro real de cocina + entrega por producto
--
-- 1) orders.kitchen_started_at: momento en que caja envía el pedido a
--    cocina (status → 'Preparando'). El cronómetro del módulo cocina cuenta
--    desde aquí y no desde la creación del pedido, que podía incluir el
--    tiempo de confirmación/pago en caja.
--
-- 2) order_items.delivered_at / delivered_by: en cuentas abiertas (y en
--    cualquier pedido) el personal puede ir marcando qué productos ya se
--    entregaron al cliente. NULL = aún no entregado.
--
-- Idempotente: se puede correr más de una vez. El código degrada con
-- gracia si esta migración no está aplicada (isMissingColumnError).
-- ============================================================

alter table orders
  add column if not exists kitchen_started_at timestamptz;

alter table order_items
  add column if not exists delivered_at timestamptz;

alter table order_items
  add column if not exists delivered_by text;


-- ============================================================
-- >>> 0027_surveys.sql
-- ============================================================

-- ============================================================
-- 0027: Encuesta post-venta con estrellas + envío automático
--
-- 1) survey_responses: la respuesta del cliente a la encuesta pública
--    (/encuesta/<pedido>): estrellas 1–5 por aspecto (jsonb) + sugerencia
--    libre. UNA respuesta por pedido (índice único): responder dos veces
--    no duplica.
--
-- 2) orders.survey_sent_at / survey_sent_channel: marca de que la encuesta
--    ya se envió a ese pedido (botón manual del staff o envío automático
--    por WhatsApp Business), para no mandarla dos veces.
--
-- Idempotente: se puede correr más de una vez. El código degrada con
-- gracia si esta migración no está aplicada.
-- ============================================================

create table if not exists survey_responses (
  id             uuid primary key default gen_random_uuid(),
  order_id       text not null,
  branch_id      uuid,
  -- { "Sabor de la comida": 5, "Tiempo de entrega": 4, ... }
  ratings        jsonb not null default '{}'::jsonb,
  comment        text not null default '',
  customer_name  text not null default '',
  created_at     timestamptz not null default now()
);

create unique index if not exists uq_survey_response_per_order
  on survey_responses (order_id);

create index if not exists idx_survey_responses_created
  on survey_responses (created_at desc);

-- RLS cerrado: solo el servidor (service role) lee/escribe.
alter table survey_responses enable row level security;

alter table orders
  add column if not exists survey_sent_at timestamptz;

alter table orders
  add column if not exists survey_sent_channel text;


-- ============================================================
-- >>> 0028_order_items_product_bigint.sql
-- ============================================================

-- 0028: order_items.product_id de integer a bigint.
--
-- Por qué: el editor de menú (saveMenuProduct), el clonado de sedes/eventos
-- (branchProvisioning) y la carga masiva generan ids de producto con
-- Date.now() (~1.78e12), que desbordan el rango de integer (~2.15e9).
-- menu_products.id e inventory_recipes.product_id ya son bigint; esta era la
-- única columna rezagada y hacía fallar la CREACIÓN de pedidos con
-- "value ... is out of range for type integer" para cualquier producto
-- creado por el editor o clonado (los ids 1-8 del menú semilla sí cabían,
-- por eso no se había notado).

alter table order_items
  alter column product_id type bigint;


-- ============================================================
-- >>> 0029_order_cancellation_requests.sql
-- ============================================================

-- 0029: Anulación con código del dueño (Brotherhood, pedido 2026-07-21).
--
-- El trabajador pide anular con motivo; se genera un código de un solo uso
-- que SOLO ve el dueño (push a sus equipos / su panel / WhatsApp cuando esté
-- conectado). El trabajador no puede anular sin ese código.
--
-- El código se guarda en claro a propósito: el dueño necesita leerlo para
-- dictarlo, la tabla es solo service-role (RLS cerrada), es de un solo uso y
-- expira a las 2 horas.

create table if not exists order_cancellation_requests (
  id text primary key,
  order_id text not null,
  branch_id text,
  display_number text not null default '',
  reason text not null,
  requested_by text not null default '',
  code text not null,
  status text not null default 'pending', -- pending | used | expired
  -- Lo marca el trabajador al anular: ¿los ingredientes ya se usaron?
  -- (si NO se usaron, el sistema devuelve el consumo al inventario).
  inventory_was_used boolean,
  inventory_reverted_count integer not null default 0,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists idx_order_cancellation_requests_order
  on order_cancellation_requests(order_id);

-- Una sola solicitud pendiente por pedido: dos clics simultáneos no pueden
-- crear dos códigos distintos (el segundo insert falla y el API reusa la
-- solicitud ganadora, así el dueño siempre dicta UN solo código).
create unique index if not exists uq_order_cancellation_pending_per_order
  on order_cancellation_requests(order_id)
  where status = 'pending';

create index if not exists idx_order_cancellation_requests_status
  on order_cancellation_requests(status, created_at desc);

alter table order_cancellation_requests enable row level security;
-- Sin policies: solo el service role (API del servidor) puede leer/escribir.


-- ============================================================
-- >>> 0030_payment_proof_second_image.sql
-- ============================================================

-- 0030: segunda captura del comprobante de pago (F8 lote v5).
--
-- El pago MIXTO puede llevar dos comprobantes (una imagen por cada pata, por
-- ejemplo pago móvil + Zelle). El comprobante ya tenía UNA imagen
-- (proof_image_url / proof_file_id / proof_file_name); aquí se agregan las
-- columnas de la segunda, opcionales (vacías cuando el pago tiene una sola
-- captura). Aditiva e idempotente: sin esta migración, la segunda imagen
-- simplemente se ignora.

alter table payment_proofs
  add column if not exists proof_image_url_2 text default '',
  add column if not exists proof_file_id_2   text default '',
  add column if not exists proof_file_name_2 text default '';


-- ============================================================
-- >>> 0031_orders_payment_method.sql
-- ============================================================

-- 0031: método de pago elegido por el CLIENTE al pedir (Pago móvil, Zelle,
-- "Mixto: X Bs … + Y $…"), distinto de payment_method_usd/ves que registra
-- caja al cobrar. Hasta ahora esta columna solo se LEÍA (order-payment,
-- order-status, anulación automática) pero nunca existió ni se escribía:
-- esos selects fallaban con 500 silencioso. El código ya degrada sin ella;
-- al aplicarla, los pedidos nuevos la llenan y se activan: precarga de
-- montos en el reporte de pago, precarga del cobro en caja, paso "Esperando
-- pago" y anulación automática por falta de pago.

alter table orders add column if not exists payment_method text;


-- ============================================================
-- >>> 0032_security_rls_and_private_proofs.sql
-- ============================================================

-- 0032_security_rls_and_private_proofs.sql
-- Auditoría de seguridad 2026-07-24.

-- (1) order_branch_counters: faltaba RLS. Sin políticas, la clave anon no ve
--     nada; el trigger que asigna el correlativo corre con service role y se
--     salta RLS, así que la operación normal NO se ve afectada.
alter table order_branch_counters enable row level security;

-- (2) Bucket payment-proofs a PRIVADO. Los comprobantes dejan de ser legibles
--     por URL pública; el panel los mostrará con URLs firmadas (ver Paso 2 de
--     SEGURIDAD-RLS-Y-COMPROBANTES.md). menu-images se deja público a propósito.
update storage.buckets
   set public = false
 where id = 'payment-proofs';


-- ============================================================
-- >>> 0033_open_account_index_per_branch.sql
-- ============================================================

-- 0033_open_account_index_per_branch.sql
-- Auditoría 2026-07-24 (R1 cuentas abiertas): el índice único "una cuenta
-- abierta por mesa" NO estaba separado por sede, así que si San Diego y Viñedo
-- tienen ambas una "Mesa 1", la segunda no podía abrir cuenta (colisión entre
-- sedes). Se recrea el índice incluyendo branch_id.

drop index if exists uq_open_account_per_table;

create unique index if not exists uq_open_account_per_table_branch
  on open_accounts (branch_id, table_number)
  where status = 'Abierta';


-- ============================================================
-- >>> 0034_supplier_purchase_payments_rls.sql
-- ============================================================

-- 0034 · Seguridad (auditoría 2026-07-24, hallazgo A3)
-- supplier_purchase_payments (abonos a proveedores) era la ÚNICA tabla del
-- esquema sin Row Level Security: quedó fuera del barrido de la migración
-- 0032. Con RLS activo y sin políticas, el rol anon/authenticated no puede
-- leer ni escribir; la app no se ve afectada porque el servidor usa la
-- service key (bypasea RLS), igual que el resto de tablas.

alter table supplier_purchase_payments enable row level security;


-- ============================================================
-- >>> 0035_open_account_index_normalized.sql
-- ============================================================

-- 0035 · Cuentas abiertas: índice único por mesa NORMALIZADO (auditoría
-- 2026-07-24, H14). El índice de la 0033 comparaba table_number en crudo,
-- pero la app busca la cuenta con texto normalizado (sin mayúsculas ni
-- espacios extra): "Mesa 1" y "mesa 1" convivían como DOS cuentas Abiertas de
-- la misma mesa y el pedido caía en la que apareciera primero.
-- Nota: si este índice falla por duplicados existentes ("Mesa 1"/"mesa 1"
-- abiertas a la vez), cierra una de las dos cuentas y reintenta.

drop index if exists uq_open_account_per_table_branch;

create unique index if not exists uq_open_account_per_table_branch
  on open_accounts (branch_id, lower(trim(table_number)))
  where status = 'Abierta';


-- ============================================================
-- >>> 0036_order_cancellation_details.sql
-- ============================================================

-- 0036: Detalle estructurado de la anulación de un pedido.
--
-- Política del dueño (2026-07-29, cierra BH-SIM-005):
-- 1. Anular quita TODO el dinero del pedido, también del cierre de caja,
--    SALVO que el cajero indique que el dinero se quedó en la gaveta
--    (entonces cuenta en el cierre en una línea aparte, nunca como venta).
-- 2. Los anulados se ven en todo momento con su motivo, quién anuló, si los
--    insumos se consumieron y qué pasó con el dinero.
-- 3. Jamás se borra ni se vacía la información de un pedido anulado.
--
-- Hasta ahora el motivo viajaba SOLO concatenado en customer_note
-- ("ANULADO: … | Por: … | …") y en audit_logs: distinguir el ORIGEN exigía
-- parsear texto libre, y quién anuló no quedaba en el pedido. Estas columnas
-- guardan el dato estructurado; la nota se mantiene por compatibilidad con
-- la página pública de seguimiento y con cierres viejos.
--
-- El código escribe estas columnas con tolerancia a migración-no-aplicada
-- (reintento sin ellas), igual que 0022/0026/0031.

-- Origen de la anulación: 'automatico' (sistema, sin pago reportado),
-- 'personal' (staff desde caja/panel) o 'cliente' (seguimiento público).
alter table orders add column if not exists cancel_origin text;

-- Motivo tal cual se escribió. NULL en el caso "cliente que no dejó motivo":
-- la UI lo muestra como "no dejó motivo" (eso ES la información, nunca un
-- espacio en blanco).
alter table orders add column if not exists cancel_reason text;

-- Quién anuló (mismo trío que registered_by_* / charged_by_*, 0022).
-- Sistema: name='Sistema', role='system'. Cliente: role='public'.
alter table orders add column if not exists cancelled_by_id   text;
alter table orders add column if not exists cancelled_by_name text;
alter table orders add column if not exists cancelled_by_role text;

alter table orders add column if not exists cancelled_at timestamptz;

-- ¿Los insumos del pedido se consumieron? true = quedan descontados del
-- inventario; false = se devolvieron al stock; NULL = no se preguntó
-- (anulaciones viejas).
alter table orders add column if not exists cancel_inventory_used boolean;

-- Qué pasó con el dinero YA COBRADO al anular (NULL si no había cobro):
-- 'devuelto' = se le devolvió al cliente (sale del cierre y de reportes);
-- 'se_quedo' = quedó en la gaveta (cuenta en el cierre en línea aparte,
-- nunca como venta). El default de la app es 'devuelto' (supuesto del
-- 2026-07-29, pendiente de confirmación del dueño).
alter table orders add column if not exists cancel_refund text;

-- Monto (equivalente USD) que el pedido tenía cobrado al momento de anular:
-- el registro de la devolución (monto + autor cancelled_by_* + fecha
-- cancelled_at).
alter table orders add column if not exists cancel_refund_usd numeric;

-- La vista transversal de anulados del dueño filtra por estado; los lookups
-- son por id. No hace falta índice nuevo.


-- ============================================================
-- >>> 0037_shared_rate_limit.sql
-- ============================================================

-- 0037_shared_rate_limit.sql
-- Auditoría 2026-08-02 · el rate limit no frenaba un ataque distribuido.
--
-- El contador vivía en un Map en memoria del proceso. En Vercel cada instancia
-- serverless tiene el suyo, así que el límite real era "N instancias x límite":
-- quien sondeaba las contraseñas de rol solo tenía que repartir los intentos y
-- cada uno caía en una instancia distinta, con el contador en cero.
--
-- Esta tabla es el contador COMPARTIDO. Una sola fila por (clave de límite + IP)
-- y ventana, incrementada de forma atómica por la función de abajo: el conteo lo
-- hace Postgres, no la aplicación, así que dos peticiones simultáneas no pueden
-- leer el mismo valor y pisarse.
--
-- Es idempotente: correrlo dos veces no rompe ni duplica.

create table if not exists rate_limit_hits (
  -- "<id del límite>:<ip>", ya saneado por la app.
  key        text primary key,
  count      integer not null default 0,
  -- Cuándo caduca la ventana actual. Al pasarse, el contador vuelve a 1.
  reset_at   timestamptz not null,
  updated_at timestamptz not null default now()
);

-- Barrido de filas caducadas (la app lo llama de vez en cuando).
create index if not exists idx_rate_limit_hits_reset_at
  on rate_limit_hits (reset_at);

-- RLS cerrado: esta tabla SOLO la toca el servidor con la service role key.
alter table rate_limit_hits enable row level security;

-- Incremento atómico. Devuelve cómo queda el contador tras sumar este intento.
--
-- `insert ... on conflict do update` es una sola sentencia: Postgres bloquea la
-- fila y resuelve las carreras. El `case` reinicia el contador cuando la ventana
-- anterior ya venció, en vez de arrastrar el conteo viejo.
create or replace function increment_rate_limit(
  p_key       text,
  p_window_ms integer
)
returns table (hits integer, reset_at timestamptz)
language plpgsql
as $$
declare
  v_now    timestamptz := now();
  v_window interval    := make_interval(secs => greatest(p_window_ms, 1000) / 1000.0);
begin
  return query
  insert into rate_limit_hits as r (key, count, reset_at, updated_at)
  values (p_key, 1, v_now + v_window, v_now)
  on conflict (key) do update
    set count = case
                  when r.reset_at <= v_now then 1
                  else r.count + 1
                end,
        reset_at = case
                     when r.reset_at <= v_now then v_now + v_window
                     else r.reset_at
                   end,
        updated_at = v_now
  returning r.count, r.reset_at;
end;
$$;

-- Consulta SIN gastar intento. La usa el candado de fallos de login: mirar si
-- una IP está bloqueada no puede, en sí mismo, acercarla al bloqueo.
create or replace function peek_rate_limit(p_key text)
returns table (hits integer, reset_at timestamptz)
language sql
stable
as $$
  select
    case when r.reset_at <= now() then 0 else r.count end as hits,
    r.reset_at
  from rate_limit_hits r
  where r.key = p_key;
$$;

-- Limpieza de ventanas ya vencidas, para que la tabla no crezca sin fin.
create or replace function purge_rate_limit_hits()
returns integer
language plpgsql
as $$
declare
  v_deleted integer;
begin
  delete from rate_limit_hits where reset_at <= now() - interval '1 hour';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;


-- ============================================================
-- >>> 0038_order_items_touch_order.sql
-- ============================================================

-- 0038_order_items_touch_order.sql
-- Consumo de Supabase 2026-08-04 · el paso previo para dejar de leer la base
-- entera en cada sondeo.
--
-- Hoy `orders` tiene un trigger que estampa updated_at en cada UPDATE, así que
-- "¿cambió algo?" se puede responder con dos agregados baratos (54 bytes) en
-- vez de bajar 626 KB de filas. PERO hay escrituras que cambian lo que ve el
-- panel y NO tocan la fila del pedido:
--
--   1. Marcar (o desmarcar) UN producto como entregado escribe solo en
--      `order_items`. En un pedido de 3 productos, las dos primeras marcas
--      serían invisibles: cocina y caja se quedarían viendo "0 de 3".
--   2. Al crear un pedido, la fila de `orders` y sus líneas se insertan en dos
--      statements separados. Un sondeo que caiga justo en medio se llevaría la
--      comanda SIN productos, y como nada más cambia, se quedaría así.
--
-- Este trigger cierra las dos de una vez y a prueba de futuro: cualquier
-- escritura sobre las líneas —las de hoy y las que se escriban mañana— marca su
-- pedido como modificado.
--
-- Es idempotente: correrlo dos veces no rompe ni duplica nada.

create or replace function touch_order_from_items()
returns trigger as $$
begin
  -- En DELETE la fila nueva no existe; en INSERT/UPDATE la vieja no.
  update orders
     set updated_at = now()
   where id = coalesce(new.order_id, old.order_id);

  return null; -- AFTER trigger: el valor de retorno se ignora
end;
$$ language plpgsql;

drop trigger if exists trg_order_items_touch_order on order_items;

create trigger trg_order_items_touch_order
  after insert or update or delete on order_items
  for each row execute function touch_order_from_items();

