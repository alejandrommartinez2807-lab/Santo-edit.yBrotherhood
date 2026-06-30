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
