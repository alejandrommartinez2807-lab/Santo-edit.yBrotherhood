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
