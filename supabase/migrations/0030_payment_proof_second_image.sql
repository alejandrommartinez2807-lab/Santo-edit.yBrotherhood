-- 0030: segunda captura del comprobante de pago (F8 lote v5).
--
-- El pago MIXTO puede llevar dos comprobantes (una imagen por cada pata, por
-- ejemplo pago móvil + Zelle). El comprobante ya tenía UNA imagen
-- (proof_image_url / proof_file_id / proof_file_name); aquí se agregan las
-- columnas de la segunda, opcionales (vacías cuando el pago tiene una sola
-- captura). Aditiva e idempotente: sin esta migración, la segunda imagen
-- simplemente se ignora.

alter table payment_proofs
  add column if not exists proof_image_url_2 text default '',
  add column if not exists proof_file_id_2   text default '',
  add column if not exists proof_file_name_2 text default '';
