-- ============================================================
-- Hotel · Fase 12: REGISTRO DE NOTIFICACIONES
-- Marca qué avisos (confirmación, recordatorio, post-estadía) ya se enviaron a
-- una reserva, para no repetirlos. El envío es por enlace de WhatsApp (wa.me),
-- sin API externa. Migración ADITIVA por branch_id.
-- ============================================================

create table if not exists notification_log (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid references branches(id) on delete cascade,
  reservation_id uuid references hotel_reservations(id) on delete cascade,
  kind           text not null default 'confirmacion', -- confirmacion | recordatorio | post
  channel        text not null default 'whatsapp',
  sent_at        timestamptz not null default now()
);

create index if not exists idx_notification_log_branch on notification_log (branch_id, reservation_id);

alter table notification_log enable row level security;
