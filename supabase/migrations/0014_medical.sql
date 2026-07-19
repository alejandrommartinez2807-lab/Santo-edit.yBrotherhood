-- ============================================================
-- Concepto La Granja · Consultorios médicos (torre médica: 75 consultorios)
-- Migración: 0014_medical
--
-- Directorio de doctores por especialidad, su horario semanal y la agenda de
-- citas. El público reserva en línea (elige doctor -> ve cupos -> reserva); la
-- administración confirma/atiende desde el panel. Cada doctor puede vincularse
-- a su local/consultorio (units).
-- ============================================================

create table if not exists doctors (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references branches(id) on delete cascade,
  unit_id      uuid references units(id) on delete set null,  -- consultorio
  full_name    text not null,
  specialty    text not null default '',
  phone        text not null default '',
  email        text not null default '',
  photo_url    text not null default '',
  bio          text not null default '',
  consult_fee  numeric(10,2) not null default 0,
  currency     text not null default 'USD',
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_doctors_branch on doctors (branch_id, active, sort_order);
create index if not exists idx_doctors_specialty on doctors (branch_id, specialty);
create trigger trg_doctors_updated before update on doctors
  for each row execute function set_updated_at();

-- Horario semanal del doctor (bloques por día de la semana).
--   weekday: 0=domingo .. 6=sábado ; horas en formato 'HH:MM'.
create table if not exists doctor_schedule (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references branches(id) on delete cascade,
  doctor_id    uuid references doctors(id) on delete cascade,
  weekday      integer not null default 1,
  start_time   text not null default '09:00',
  end_time     text not null default '13:00',
  slot_minutes integer not null default 30,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_doctor_schedule_doctor on doctor_schedule (doctor_id, weekday);

-- Citas.
--   status: solicitada | confirmada | atendida | cancelada | no_asistio
--   source: online | panel
create table if not exists medical_appointments (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  doctor_id      uuid references doctors(id) on delete cascade,
  patient_name   text not null default '',
  patient_phone  text not null default '',
  patient_email  text not null default '',
  starts_at      timestamptz not null,
  duration_min   integer not null default 30,
  reason         text not null default '',
  status         text not null default 'solicitada',
  source         text not null default 'online',
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_appointments_doctor on medical_appointments (doctor_id, starts_at);
create index if not exists idx_appointments_branch on medical_appointments (branch_id, starts_at desc);
create index if not exists idx_appointments_status on medical_appointments (branch_id, status);
create unique index if not exists uq_appointment_slot on medical_appointments (doctor_id, starts_at)
  where status <> 'cancelada';
create trigger trg_appointments_updated before update on medical_appointments
  for each row execute function set_updated_at();

alter table doctors              enable row level security;
alter table doctor_schedule      enable row level security;
alter table medical_appointments enable row level security;
