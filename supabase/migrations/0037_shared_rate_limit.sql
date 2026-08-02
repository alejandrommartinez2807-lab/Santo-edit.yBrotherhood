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
