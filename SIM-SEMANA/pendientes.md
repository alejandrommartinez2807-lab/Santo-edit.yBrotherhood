# Pendientes y bloqueos

## BLOCKED (dependen de terceros o de hardware — nunca marcados PASS)

- **D2-NOTIF-1** (dia-2) — entrega real de push al mesonero (VAPID no configurado en simulación) — VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY vacíos: el evento interno se genera pero no hay entrega externa
- **D2-PRINT-1** (dia-2) — impresión física de comanda y recibo 80mm — no hay impresora conectada al entorno de simulación
- **D6-FALLO-2** (dia-6) — caída real de la base / impresora / servicio de push — no se puede tumbar el servicio gestionado de Supabase ni hay hardware físico en el entorno de simulación

## FAIL abiertos al cierre de la semana

- **ninguno**

## FAIL detectados durante la semana y su resolución

Los 17 fallos que quedaron grabados en las bitácoras, con lo que
pasó con cada uno. **Tres eran bugs REALES del sistema** (corregidos, blindados
con test y re-verificados); el resto fueron defectos de mi propio guion de
pruebas — se listan igual porque esconderlos sería tan deshonesto como
dejarlos pasar por buenos.

- **D0-MENU-2** (dia-0)
  - lo que se vio: San Diego SIN menú propio hereda el menú de Principal (público) — hereda 15 productos
  - resolución: Verificado en la primera pasada; en las reanudaciones San Diego ya tenía menú propio y la herencia no se podía re-observar. Evidencia en la bitácora del Día 0.
- **D1-ADV-5** (dia-1)
  - lo que se vio: el público NO puede fabricar su precio (Doble Brutal $9.5) — status=200 total_guardado=$0.01
  - resolución: BUG REAL BH-SIM-001 → corregido (re-precio desde el menú) + 12 tests. Re-probado en verde cada día como Dn-SEC-4.
- **D1-ADV-7** (dia-1)
  - lo que se vio: comprobante reportado con monto venezolano 9.648,99 entra a revisión — status=400
  - resolución: FALSO POSITIVO: la referencia que envié tenía menos de 6 dígitos y el escudo P-1 la rechaza bien. Con referencia válida: D1R-ADV-7 en verde.
- **D1-CX-1** (dia-1)
  - lo que se vio: cancelación ANTES de cocina: estado Cancelado + motivo + insumos devueltos — estado=Nuevo
  - resolución: FALSO POSITIVO: el mesonero NO puede anular (diseño correcto de canRoleUpdateStatus). Rehecho con la encargada: D1R-CX-1 en verde.
- **D1-PLAN-1** (dia-1)
  - lo que se vio: se ejecutaron EXACTAMENTE 55 pedidos del plan (+1 evidencia adversarial si el precio se coló) — creados=50 (cancelados=1)
  - resolución: Los 5 delivery fallaban por falta de paymentMethod (contrato de la API). Rehechos en dia-1-repaso: el Día 1 cierra con sus 55 pedidos.
- **D1-AUDIT-1** (dia-1)
  - lo que se vio: los cobros del día quedaron auditados con autor real — filas=32 conActor=32 ejemplo=María Fernanda
  - resolución: Umbral mal puesto (esperaba 40 filas cuando los cobros por cuenta usan otra acción). Re-verificado: D1R-AUDIT-1, 37/37 con actor real.
- **D1R-PLAN-1** (dia-1)
  - lo que se vio: el Día 1 completo suma los 55 pedidos del plan — P=36 SD=20
  - resolución: Resuelto: 56 = 55 del plan + 1 pedido-evidencia del bug del precio.
- **D2-PLAN** (dia-2)
  - lo que se vio: el día ejecutó los 70 pedidos del plan — real=71 (P=45 SD=26) canales={"mesa-cuenta":14,"mesa":18,"pickup":10,"delivery":10,"qr":16,"staff":2}
  - resolución: 71 = 70 del plan + 1 pedido-evidencia del escenario adversarial de precio. Desde el Día 3 se cuentan aparte.
- **D5-EVT-4** (dia-5)
  - lo que se vio: el reporte por vendedor existe y no está vacío — claves=ok,scope,supplierPayables,supplierPurchases,productMargins,inventoryHealth,managerAlerts,range,comparison,delivery,colle
  - resolución: FALSO POSITIVO: la atribución por vendedor vive en el CIERRE (salesBySeller), no en /api/reports. Verificada aparte: se guarda y se relee intacta.
- **D5-CONC-1** (dia-5)
  - lo que se vio: dos cajeros cobrando el MISMO pedido: solo uno gana y el pedido no cobra doble — ganadores=2 recibido=$9.5 total=$9.5
  - resolución: BUG REAL BH-SIM-003 → corregido (candado optimista propagado, 409 al perdedor) + 5 tests. Re-probado: Q-7 en verde, 5/5 carreras con un solo ganador.
- **D5-PLAN** (dia-5)
  - lo que se vio: el día ejecutó los 115 pedidos del plan (+3 pedidos-evidencia de escenarios adversariales) — real=122 evidencia=3 (P=78 SD=44) canales={"mesa-cuenta":28,"mesa":22,"pickup":20,"delivery":18,"qr":25,"staff":2}
  - resolución: 122 = 115 del plan + 3 evidencia + 4 ventas de la promotora que exige el propio guion (§17 modo evento).
- **D6-CX-total** (dia-6)
  - lo que se vio: las 12 cancelaciones del plan se ejecutaron con motivo y autor — plan=12 real=11
  - resolución: 11 de 12: una anulación no encontró pedido libre en el pool. Registrado como cobertura incompleta de ESE día; el total semanal de anulaciones del guion cierra en 37/37 (REC-4).
- **D6-HUM-1** (dia-6)
  - lo que se vio: cambio de mesa aplicado — status=400 mesa=Mesa 2
  - resolución: Mi prueba usaba un contrato equivocado (PATCH solo con tableNumber). El cambio de mesa real va por el módulo de mesas; queda como cobertura no ejecutada, no como defecto observado.
- **dia-6-NOCHE-inventario** (dia-6)
  - lo que se vio: el inventario REAL cuadra con el libro esperado (36 insumos) — Refresco 1.5L@SD: esperado=-15 real=0
  - resolución: BUG REAL BH-SIM-004 → corregido (la venta con stock 0 deja rastro del faltante) + 5 tests. El libro se alineó al suelo en cero; REC-8 cierra con 36/36 exactos.
- **D7-CIERRE-1** (dia-7)
  - lo que se vio: hay 14 cierres comerciales (7 días × 2 sedes) + 2 técnicos de fundación, sin mezclarse — comerciales=12 técnicos=4
  - resolución: Error de secuencia MÍO: el check corría ANTES de los cierres del propio Día 7. La cuenta correcta la da REC-6: 16 cierres comerciales + 2 etiquetas técnicas.
- **dia-7-NOCHE-integridad** (dia-7)
  - lo que se vio: sin huérfanos, sin registros sin sede, sin auditoría sin actor — pedido sin detalles: ord-ms5p4xdy-vxv8csqh2d (SIM Héctor Rodríguez dia-7#57) · pedido sin detalles: ord-ms5p56hb-pzya0jfq1r (SIM Valeria García dia-7#58) · pedido sin detalles: ord-ms5oyw6z-ckjc7yubjd (SIM Camila Mora dia-7#39) · pedido sin detalles: ord-ms5oz4wz-lnixxzbebp (SIM Diego Aponte dia-7#40) · pedido sin detalles: ord-ms5p05ev-3sihrdvkwn (SIM Ana García dia-7#44)
  - resolución: FALSO POSITIVO de mi verificador: PostgREST corta en 1000 filas y la consulta de order_items venía truncada. Los 5 pedidos SÍ tienen sus líneas. Corregido con paginación; la barrida real da 0 problemas (REC-11).
- **dia-7-NOCHE-inventario** (dia-7)
  - lo que se vio: el inventario REAL cuadra con el libro esperado (36 insumos) — Refresco 1.5L@SD: esperado=-26 real=0
  - resolución: Mismo BH-SIM-004. Resuelto: REC-8 en verde.

## No cubierto por decisión explícita

- **Pruebas de navegador (Playwright)**: NO instalado en el repo. Por la regla
  del Prompt Maestro (§11.4) las pruebas de PWA/Service Worker/multipestaña
  quedan `BLOCKED`, no `PASS`. Lo verificable por API (multi-sesión, doble
  pestaña con dos tokens, idempotencia del reenvío offline) SÍ se probó.
- **Entrega real de notificaciones push**: sin VAPID en el entorno de
  simulación. Se verificó que el evento interno se genera; la entrega externa
  queda `BLOCKED`.
- **Impresión física (comanda y recibo 80mm)**: sin hardware. El modo de
  impresión se configuró (`printFlowMode`), el disparo no se puede observar.
- **WhatsApp / Meta**: sin credenciales de simulación (y prohibido usar las de
  producción). `BLOCKED`.
- **Caída real de la base**: no se puede tumbar el Supabase gestionado. Los
  fallos parciales se probaron por la vía observable (timeout + reintento con
  clave de idempotencia, cobro doble simultáneo, corrección de método).
