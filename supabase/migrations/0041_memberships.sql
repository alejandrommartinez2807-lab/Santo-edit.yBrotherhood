-- ============================================================
-- Hotel · P2-C: MEMBRESÍAS / FIDELIZACIÓN + PASE DE INVITADO
--
-- memberships       = niveles de membresía (nombre, nivel, beneficios,
--                     % de descuento sobre la tarifa, activo).
-- guest_memberships = la membresía de CADA huésped: ligada a su ficha CRM,
--                     con un código propio y un PASE DE INVITADO transferible.
--                     El pase, al usarse en una reserva pública, sugiere el
--                     descuento y registra el referido (pass_uses/last_referral).
-- Aditiva por branch_id. RLS on (acceso por service role).
-- ============================================================

create table if not exists memberships (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid references branches(id) on delete cascade,
  name          text not null default '',
  level         text not null default '',
  benefits      text not null default '',
  discount_pct  numeric(5,2) not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists idx_memberships_branch on memberships (branch_id, active);

create table if not exists guest_memberships (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid references branches(id) on delete cascade,
  membership_id     uuid references memberships(id) on delete cascade,
  guest_profile_id  uuid references guest_profiles(id) on delete set null,
  guest_name        text not null default '',
  code              text not null default '',
  guest_pass_code   text not null default '',
  pass_uses         integer not null default 0,
  last_referral     text not null default '',
  expires_at        date,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists idx_guest_memberships_branch on guest_memberships (branch_id, active);
create index if not exists idx_guest_memberships_code on guest_memberships (branch_id, code);
create index if not exists idx_guest_memberships_pass on guest_memberships (branch_id, guest_pass_code);

alter table memberships enable row level security;
alter table guest_memberships enable row level security;
