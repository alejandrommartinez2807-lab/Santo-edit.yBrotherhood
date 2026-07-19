-- ============================================================
-- Concepto La Granja · Migraciones 0014-0016 (consultorios, CRM, fidelidad)
-- Aplicar en el SQL Editor de Supabase. Si el pegado se corta (42601),
-- corre cada archivo supabase/migrations/0014, 0015, 0016 por separado.
-- ============================================================


-- >>>>>>>>>> 0014_medical.sql <<<<<<<<<<

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

-- >>>>>>>>>> 0015_crm.sql <<<<<<<<<<

-- ============================================================
-- Concepto La Granja · CRM / Atención al cliente
-- Migración: 0015_crm
--
-- Centraliza consultas, reclamos, sugerencias, objetos perdidos, solicitudes
-- de local y propuestas de proveedores recibidas por cualquier canal. Cada
-- caso tiene responsable, prioridad y estado.
-- ============================================================

-- kind: reclamo | sugerencia | consulta | objeto_perdido | solicitud_local |
--       propuesta_proveedor | otro
-- channel: web | whatsapp | correo | telefono | presencial
-- status: nuevo | en_proceso | resuelto | cerrado
-- priority: baja | media | alta
create table if not exists crm_cases (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  kind           text not null default 'consulta',
  subject        text not null default '',
  message        text not null default '',
  customer_name  text not null default '',
  customer_phone text not null default '',
  customer_email text not null default '',
  channel        text not null default 'web',
  status         text not null default 'nuevo',
  priority       text not null default 'media',
  assigned_to    text not null default '',
  resolution     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_crm_branch_status on crm_cases (branch_id, status);
create index if not exists idx_crm_kind on crm_cases (branch_id, kind);
create index if not exists idx_crm_created on crm_cases (branch_id, created_at desc);
create trigger trg_crm_cases_updated before update on crm_cases
  for each row execute function set_updated_at();

alter table crm_cases enable row level security;

-- >>>>>>>>>> 0016_loyalty.sql <<<<<<<<<<

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
