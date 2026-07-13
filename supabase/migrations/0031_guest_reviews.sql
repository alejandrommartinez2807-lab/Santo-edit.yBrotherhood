-- ============================================================
-- Hotel · Fase 13: RESEÑAS DEL HUÉSPED
-- Valoración 1-5 + comentario tras la estadía. Migración ADITIVA por branch_id.
-- ============================================================

create table if not exists guest_reviews (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid references branches(id) on delete cascade,
  reservation_id  uuid references hotel_reservations(id) on delete set null,
  guest_name      text not null default '',
  rating          integer not null default 5,
  comment         text not null default '',
  published       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists idx_guest_reviews_branch on guest_reviews (branch_id, created_at);

alter table guest_reviews enable row level security;
