-- ============================================================
-- Concepto La Granja · Programa de fidelidad
-- Migración: 0016_loyalty
--
-- Clientes registrados que acumulan puntos por sus compras (validadas por la
-- administración) y los canjean por premios/beneficios. Participación
-- voluntaria; el cliente controla sus datos.
-- ============================================================

create table if not exists loyalty_customers (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references branches(id) on delete cascade,
  full_name    text not null default '',
  phone        text not null default '',
  email        text not null default '',
  document     text not null default '',
  points       integer not null default 0,      -- saldo cacheado (suma de transacciones)
  tier         text not null default 'general',  -- general | plata | oro
  birthday     date,
  joined_at    timestamptz not null default now(),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_loyalty_branch on loyalty_customers (branch_id);
create unique index if not exists uq_loyalty_phone on loyalty_customers (branch_id, phone);
create trigger trg_loyalty_customers_updated before update on loyalty_customers
  for each row execute function set_updated_at();

-- kind: compra | canje | ajuste | bono
--   points positivo = acumula ; negativo = canje
create table if not exists loyalty_transactions (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references branches(id) on delete cascade,
  customer_id  uuid references loyalty_customers(id) on delete cascade,
  points       integer not null default 0,
  kind         text not null default 'compra',
  amount       numeric(12,2) not null default 0,  -- monto de la compra (informativo)
  note         text not null default '',
  created_by   text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists idx_loyalty_tx_customer on loyalty_transactions (customer_id, created_at desc);
create index if not exists idx_loyalty_tx_branch on loyalty_transactions (branch_id, created_at desc);

alter table loyalty_customers    enable row level security;
alter table loyalty_transactions enable row level security;
