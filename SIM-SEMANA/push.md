# Prueba de web push con VAPID (receptor RFC 8291 propio)

run: brotherhood-week-001 · inicio real: 2026-07-29T18:52:44.117Z

- `PASS` **PUSH-1** el servidor anuncia push habilitado con la clave pública del entorno — enabled=true coincide=true
- `PASS` **PUSH-2** la suscripción del pedido se guarda (201) — status=201 {"ok":true}
- `PASS` **PUSH-3** el push LLEGÓ al receptor al marcar el pedido LISTO — entregas=2
- `PASS` **PUSH-4** la entrega viene FIRMADA con VAPID (JWT + la clave pública del entorno) — authorization=vapid t=eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1… incluyeClave=true
- `PASS` **PUSH-5** el payload viaja CIFRADO (aes128gcm, RFC 8291) — encoding=aes128gcm bytes=269
- `PASS` **PUSH-6** el payload descifrado es el aviso real de 'pedido listo' — payload={"title":"🍳 ¡Tu pedido entró a cocina!","body":"Ya estamos preparando tu pedido #496-p. Te avisamos cuando esté listo.","url":"/pedido/ord-ms6fzkgb-modytqe9am"
- `PASS` **PUSH-7** la suscripción vive en push_subscriptions con su pedido — row={"order_id":"ord-ms6fzkgb-modytqe9am","endpoint":"https://127.0.0.1:3999/sim-push-sink"}

limpieza: 1 pedido(s) de prueba y sus suscripciones eliminados
