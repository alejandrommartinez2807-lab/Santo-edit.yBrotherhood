# Prueba de Reservas, Encuestas y Soporte

run: brotherhood-week-001 · inicio real: 2026-07-29T15:54:10.372Z

- `PASS` **MOD-R0** el módulo lista las mesas activas de la sede para reservar — status=200 mesas=8
- `FAIL` **MOD-R1** crear reserva (staff): 200 y queda activa — status=201 estado=activa
- `PASS` **MOD-R2** editar reserva: el mismo id actualiza (6 personas) — status=200 personas=6
- `PASS` **MOD-R3** doble reserva de la MISMA mesa en franja pisada: rechazada — status=409 error=La mesa Mesa 1 ya está reservada de 19:00 a 21:00 (SIM MOD Cliente Reserva).
- `PASS` **MOD-R4** hora inválida (25:99): rechazada con 400 — status=400 error=Revisa la fecha y la franja horaria (la hora de fin debe ser mayor a la de inicio)
- `PASS` **MOD-R5** cancelar reserva: pasa a 'cancelada' — status=200 estado=cancelada
- `PASS` **MOD-R6** marcar no-show: pasa a 'no_show' (el cliente no llegó queda registrado) — status=200 estado=no_show
- `FAIL` **MOD-R7** reserva online del cliente: asigna mesa activa libre y queda 'activa' — status=201 mesa=Mesa 1 estado=undefined
- `PASS` **MOD-R8** reserva online con fecha pasada: rechazada — status=400 error=La fecha de la reserva ya pasó
- `PASS` **MOD-R9** grupo de 500: el sistema lo acota a 30 (no guarda una capacidad imposible) — status=201 personas=30
- `PASS` **MOD-R10** aislamiento por sede: las reservas de Principal NO aparecen en San Diego — status=200 reservasSD=0
- `PASS` **MOD-R11** todas las mesas ocupadas en la franja: el público recibe 'no queda mesa libre' — status=409 error=No queda mesa libre en ese horario. Prueba con otra hora o escríbenos por WhatsApp.
- `PASS` **MOD-R12** conversión reserva→cuenta/pedido: no existe en el esquema (NOT_APPLICABLE honesto) — columnas de vínculo=[]
- `PASS` **MOD-E1** la encuesta del pedido carga con sus aspectos y sin responder — status=200 aspectos=,,
- `PASS` **MOD-E2** responder la encuesta: 201 y la respuesta queda guardada con su sede — status=201 error=
- `PASS` **MOD-E3** la respuesta en la base tiene ratings, comentario y branch del pedido — branch=e514be79-bb39-4050-9f27-e6c10249a1cf esperado=e514be79-bb39-4050-9f27-e6c10249a1cf
- `PASS` **MOD-E4** responder DOS veces el mismo pedido: rechazado (una respuesta por pedido) — status=409
- `PASS` **MOD-E5** encuesta de un pedido inexistente: 404 — status=404
- `PASS` **MOD-E6** el dueño ve los resultados agregados de encuestas — status=200 claves=ok,responses,totalResponses,averages
- `PASS` **MOD-E7** cocina NO puede leer los resultados de encuestas — status=403
- `BLOCKED` **MOD-E8** envío de la encuesta por WhatsApp (plantilla de botones) — depende de credenciales Meta — sin resolver desde el 2026-07-24
- `PASS` **MOD-S1** el rol SOPORTE lee el panel de estado del sistema — status=200 claves=ok,access,checkedAt,environment,deploymentReadiness,business,planSettings,checks
- `PASS` **MOD-S2** cocina NO puede leer el panel de soporte — status=403
- `PASS` **MOD-S3** sin credenciales NO se puede leer el panel de soporte — status=401
- `FAIL` **MOD-S4** el panel de soporte no filtra secretos (keys JWT/service role) — bytes=35563

limpieza: 13 reservas y 1 pedidos de prueba eliminados

---
reanudado: 2026-07-29T15:56:14.173Z

- `PASS` **MOD-R0** el módulo lista las mesas activas de la sede para reservar — status=200 mesas=8
- `PASS` **MOD-R1** crear reserva (staff): creada y queda activa — status=201 estado=activa
- `PASS` **MOD-R2** editar reserva: el mismo id actualiza (6 personas) — status=200 personas=6
- `PASS` **MOD-R3** doble reserva de la MISMA mesa en franja pisada: rechazada — status=409 error=La mesa Mesa 1 ya está reservada de 19:00 a 21:00 (SIM MOD Cliente Reserva).
- `PASS` **MOD-R4** hora inválida (25:99): rechazada con 400 — status=400 error=Revisa la fecha y la franja horaria (la hora de fin debe ser mayor a la de inicio)
- `PASS` **MOD-R5** cancelar reserva: pasa a 'cancelada' — status=200 estado=cancelada
- `PASS` **MOD-R6** marcar no-show: pasa a 'no_show' (el cliente no llegó queda registrado) — status=200 estado=no_show
- `PASS` **MOD-R7** reserva online del cliente: asigna mesa activa libre, queda 'activa' y marcada [Online] — status=201 mesa=Mesa 1 estado=activa nota=[Online]
- `PASS` **MOD-R8** reserva online con fecha pasada: rechazada — status=400 error=La fecha de la reserva ya pasó
- `PASS` **MOD-R9** grupo de 500: el sistema lo acota a 30 (no guarda una capacidad imposible) — status=201 personas=30
- `PASS` **MOD-R10** aislamiento por sede: las reservas de Principal NO aparecen en San Diego — status=200 reservasSD=0
- `PASS` **MOD-R11** todas las mesas ocupadas en la franja: el público recibe 'no queda mesa libre' — status=409 error=No queda mesa libre en ese horario. Prueba con otra hora o escríbenos por WhatsApp.
- `PASS` **MOD-R12** conversión reserva→cuenta/pedido: no existe en el esquema (NOT_APPLICABLE honesto) — columnas de vínculo=[]
- `PASS` **MOD-E1** la encuesta del pedido carga con sus aspectos y sin responder — status=200 aspectos=,,
- `PASS` **MOD-E2** responder la encuesta: 201 y la respuesta queda guardada con su sede — status=201 error=
- `PASS` **MOD-E3** la respuesta en la base tiene ratings, comentario y branch del pedido — branch=e514be79-bb39-4050-9f27-e6c10249a1cf esperado=e514be79-bb39-4050-9f27-e6c10249a1cf
- `PASS` **MOD-E4** responder DOS veces el mismo pedido: rechazado (una respuesta por pedido) — status=409
- `PASS` **MOD-E5** encuesta de un pedido inexistente: 404 — status=404
- `PASS` **MOD-E6** el dueño ve los resultados agregados de encuestas — status=200 claves=ok,responses,totalResponses,averages
- `PASS` **MOD-E7** cocina NO puede leer los resultados de encuestas — status=403
- `BLOCKED` **MOD-E8** envío de la encuesta por WhatsApp (plantilla de botones) — depende de credenciales Meta — sin resolver desde el 2026-07-24
- `PASS` **MOD-S1** el rol SOPORTE lee el panel de estado del sistema — status=200 claves=ok,access,checkedAt,environment,deploymentReadiness,business,planSettings,checks
- `PASS` **MOD-S2** cocina NO puede leer el panel de soporte — status=403
- `PASS` **MOD-S3** sin credenciales NO se puede leer el panel de soporte — status=401
- `PASS` **MOD-S4** el panel de soporte no filtra secretos (ningún token JWT real en la respuesta) — bytes=35563

limpieza: 13 reservas y 1 pedidos de prueba eliminados
