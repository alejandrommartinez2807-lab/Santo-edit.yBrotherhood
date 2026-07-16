-- ============================================================
-- Hotel · P3-H: TURNOS / ASISTENCIA DEL PERSONAL (sin nómina)
--
-- staff_shifts = un turno planificado por usuario y fecha, con la marca real
-- de entrada/salida. staff_username referencia al roster de usuarios del
-- panel (staffUsers en business_config); staff_name queda denormalizado para
-- que el historial sobreviva si el usuario se elimina. NADA de sueldos.
-- Aditiva por branch_id. RLS on (acceso por service role).
-- ============================================================

create table if not exists staff_shifts (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  staff_username text not null default '',
  staff_name     text not null default '',
  shift_date     date not null,
  shift_label    text not null default '',
  planned_start  text not null default '',
  planned_end    text not null default '',
  check_in_at    timestamptz,
  check_out_at   timestamptz,
  note           text not null default '',
  created_at     timestamptz not null default now()
);

create index if not exists idx_staff_shifts_branch_date on staff_shifts (branch_id, shift_date);
create index if not exists idx_staff_shifts_user on staff_shifts (branch_id, staff_username, shift_date);

alter table staff_shifts enable row level security;
