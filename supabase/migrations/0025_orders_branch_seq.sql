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
