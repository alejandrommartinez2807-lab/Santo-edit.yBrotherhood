# Día 1 — Lunes suave y nacimiento de la operación

run: brotherhood-week-001 · inicio real: 2026-07-29T03:52:27.109Z

Fecha de negocio simulada: 2026-08-03 · run=brotherhood-week-001

## Apertura: fondo inicial declarado en bitácora (el sistema no tiene módulo de fondo de caja: se documenta como NOT_APPLICABLE y el efectivo del cierre se valida contra el libro).
Fondo inicial declarado: Principal $100 · San Diego $60 (solo bitácora)
- `PASS` **D1-CTA-1** cuenta abierta #1 creada por el mesonero en Mesa 3 — status=201
- `PASS` **D1-CTA-2** la cuenta #1 acumula 4 pedidos asociados — pedidos=4
- `PASS` **D1-CTA-3** la cuenta #2 se cobra por pedido (pagos separados: efectivo con cambio + pago móvil) — 1=true 2=true
- `PASS` **D1-CTA-4** cuenta #3 (SD) queda con 1 pedido entregado SIN cobrar (cruza al Día 2) — {"accountId":"5e486912-1443-4ae1-bd77-6f3e6a5e953b","orderId":"ord-ms5jvpnv-uar0uorrxt","total":13.5,"branchId":"395e3b33-cda3-4111-8dd5-a5ee52d43cd6"}
- `PASS` **D1-CTA-5** la cuenta #1 (4 pedidos) se cobra completa en efectivo y el reparto cae por pedido — status=200 total=$42.5
- `PASS` **D1-CTA-6** un pedido de la cuenta #1 quedó Pagado en base tras el reparto — payment_status=Pagado
- `PASS` **D1-CTA-7** la cuenta #4 (6 pedidos, cumpleaños) se cobra completa en MIXTO — status=200 total=$75
- `PASS` **D1-CTA-8** la cuenta #5 (SD, 5 pedidos) se cobra completa por transferencia — status=200 total=$69
- `PASS` **dia-1-stock-19** el pedido descuenta la receta (insumo inv-17…) — esperado=586 real=586
- `PASS` **dia-1-stock-27** el pedido descuenta la receta (insumo inv-17…) — esperado=231 real=231
- `PASS` **D1-PICKUP-1** pick up pagado AL RETIRAR (cocina → Listo → cobro) — status=true
- `PASS` **D1-QR-1** 5 pedidos QR públicos creados (3 P + 2 SD) sin credenciales — qr=5
- `PASS` **D1-ADV-1** doble clic con la misma clave de idempotencia NO duplica el pedido — id1=ord-ms5k6wq9-gpgkmpaj1k id2=ord-ms5k6wq9-gpgkmpaj1k idempotent=true
- `PASS` **D1-ADV-2** mesonero NO puede entregar un pedido que no está Listo (compuerta de LISTO) — status=500 estado=Nuevo
- `PASS` **D1-ADV-3** Roxana (cajera SD) con x-branch-id de Principal recibe SOLO datos de SD (clamp con datos reales) — status=200 filtrados=0 de 31
- `PASS` **D1-ADV-4** kitchen sigue sin poder ver reportes financieros — status=403
- `FAIL` **D1-ADV-5** el público NO puede fabricar su precio (Doble Brutal $9.5) — status=200 total_guardado=$0.01
- `PASS` **D1-ADV-6** pedido vacío y cantidad cero se rechazan (o quedan en $0 sin colar dinero) — vacío=400 cero=400 ceroTotal=undefined
- `FAIL` **D1-ADV-7** comprobante reportado con monto venezolano 9.648,99 entra a revisión — status=400
- `PASS` **D1-ADV-8** un Bearer inventado NO abre el panel (401) — status=401
- `FAIL` **D1-CX-1** cancelación ANTES de cocina: estado Cancelado + motivo + insumos devueltos — estado=Nuevo
- `PASS` **D1-CX-2** cancelación ANTES del cobro (pedido listo): ingredientes consumidos NO vuelven — estado=Cancelado
- `FAIL` **D1-PLAN-1** se ejecutaron EXACTAMENTE 55 pedidos del plan (+1 evidencia adversarial si el precio se coló) — creados=50 (cancelados=1)

Distribución real por canal: {"mesa-cuenta":18,"mesa":18,"pickup":7,"qr":5,"staff":2}
Por sede: {"P":32,"SD":18}
- `PASS` **D1-GASTO-1** gastos del día registrados (P $14, SD $10)
- `FAIL` **dia-1-CIERRE-Principal** cierre de Principal registrado — status=403
- `FAIL` **dia-1-CIERRE-San Diego** cierre de San Diego registrado — status=403
- `FAIL` **D1-AUDIT-1** los cobros del día quedaron auditados con autor real — filas=32 conActor=32 ejemplo=María Fernanda
- `PASS` **dia-1-NOCHE-integridad** sin huérfanos, sin registros sin sede, sin auditoría sin actor — limpio
- `PASS` **dia-1-NOCHE-sedes** ningún pedido del día cruzó de sede — cruzados=0
- `PASS` **dia-1-NOCHE-pagos** ningún pedido 'Pagado' recibió menos que su total — subpagados=0
- `PASS` **dia-1-NOCHE-inventario** el inventario REAL cuadra con el libro esperado (36 insumos) — exacto

---
reanudado: 2026-07-29T04:15:17.032Z

Fecha de negocio simulada: 2026-08-03 · run=brotherhood-week-001

## Repaso del Día 1 (reanudación)
- `PASS` **D1R-DELIV-1** delivery con GPS: el SERVER cotiza el envío por km ($2, tier ≤3km) — delivery_cost=2 total=14
- `PASS` **D1R-DELIV-2** los 5 delivery del plan existen (3 P + 2 SD) — P=3 SD=2
- `PASS` **D1R-CX-1** cancelación ANTES de cocina por la manager: Cancelado + motivo + stock devuelto — estado=Cancelado
- `PASS` **D1R-ADV-7** comprobante con referencia válida y monto 9.648,99 entra a revisión — status=201 
- `PASS` **D1R-PERM-1** la cajera NO puede cerrar el día (solo dueño/manager) — status=403
- `PASS` **dia-1-CIERRE-Principal** cierre de Principal registrado — status=200
- `PASS` **dia-1-CIERRE-Principal-centavo** el cierre de Principal cuadra AL CENTAVO con el libro esperado — esperado: $420.5 efectivo=$214 Bs=6720 · real: $420.5 efectivo=$214 Bs=6720
- `PASS` **dia-1-CIERRE-San Diego** cierre de San Diego registrado — status=200
- `PASS` **dia-1-CIERRE-San Diego-centavo** el cierre de San Diego cuadra AL CENTAVO con el libro esperado — esperado: $222.5 efectivo=$80 Bs=5100 · real: $222.5 efectivo=$80 Bs=5100
- `PASS` **D1R-CIERRE-CTA** la cuenta abierta (SD) quedó FUERA del dinero cobrado y DENTRO del pendiente — pendiente del libro=$13.5 cuenta=$13.5
- `PASS` **D1R-AUDIT-1** los cobros del día quedaron auditados con autor real — filas=37 conActor=37
- `PASS` **dia-1-NOCHE-integridad** sin huérfanos, sin registros sin sede, sin auditoría sin actor — limpio
- `PASS` **dia-1-NOCHE-sedes** ningún pedido del día cruzó de sede — cruzados=0
- `PASS` **dia-1-NOCHE-pagos** ningún pedido 'Pagado' recibió menos que su total — subpagados=0
- `PASS` **dia-1-NOCHE-inventario** el inventario REAL cuadra con el libro esperado (36 insumos) — exacto

### Día 1 cerrado · Principal: 36 pedidos, $420.5 cobrados, $0 pendientes, 2 cancelados
### Día 1 cerrado · San Diego: 20 pedidos, $222.5 cobrados, $13.5 pendientes, 1 cancelados
- `FAIL` **D1R-PLAN-1** el Día 1 completo suma los 55 pedidos del plan — P=36 SD=20
