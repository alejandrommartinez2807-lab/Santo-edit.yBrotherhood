# Día 6 — 2026-08-08

run: brotherhood-week-001 · inicio real: 2026-07-29T05:45:08.534Z

Fecha de negocio simulada: 2026-08-08 · run=brotherhood-week-001

## Turno del día: {"P":{"cashier":"kelvin","kitchen":"dubraska","waiter":"yorgelis","manager":"genesis"},"SD":{"cashier":"roxana","kitchen":"carlosalberto","waiter":"daniela","manager":"luis"}}
Cuentas abiertas heredadas al abrir: 3
- `FAIL` **D6-CX-total** las 12 cancelaciones del plan se ejecutaron con motivo y autor — plan=12 real=11
- `PASS` **D6-SEC-1** la cajera de SD con header de Principal NO recibe pedidos de Principal — filtrados=0
- `PASS` **D6-SEC-2** el mesonero sigue sin poder crear usuarios — status=403
- `PASS` **D6-SEC-3** manipular el ID de un pedido de otra sede NO lo anula — status=500 estado=Entregado
- `PASS` **D6-SEC-4** precio fabricado por el público se corrige al del menú ($9.5) — guardado=$9.5
- `PASS` **D6-SEC-5** una sesión inválida no abre reportes — status=401
- `PASS` **D6-CTA-1** la cuenta abierta del Día 5 se cobra el Día 6 — status=200 total=$15.5
- `PASS` **D6-CTA-2** el pedido conserva su ORIGEN del Día 5 y solo el cobro es del Día 6 — creado=2026-07-29T05:24:31 pago=Pagado
- `PASS` **D6-CTA-3** el dinero de esa cuenta NO estaba en el cierre del Día 5 — pendiente d5 tras cobrar=$0
- `FAIL` **D6-HUM-1** cambio de mesa aplicado — status=400 mesa=Mesa 2
- `PASS` **D6-HUM-2** doble clic en COBRAR no cobra dos veces (el monto guardado es UNO) — recibido=$5.5 total=$5.5 respuestas=200/200
- `PASS` **D6-HUM-3** corregir el método deja el pedido pagado por el mismo total y con trazabilidad — status=200 recibido=$5.5
- `PASS` **D6-SEC-XSS** nombre con XSS y nota con SQL injection se guardan como TEXTO (la tabla sigue viva) — pedidos en base=515 nombre guardado=<script>alert('xss')</script> 
- `PASS` **D6-FALLO-1** reintento tras timeout con la misma clave devuelve el MISMO pedido — id1=ord-ms5on0p1-egok1anwiy id2=ord-ms5on0p1-egok1anwiy idempotente=true
- `PASS` **D6-CX-PAGADO** anular un pedido YA PAGADO deja rastro claro (anulado con motivo, pago visible) — status=200 estado=Cancelado pagado=$12.5
- `BLOCKED` **D6-FALLO-2** caída real de la base / impresora / servicio de push — no se puede tumbar el servicio gestionado de Supabase ni hay hardware físico en el entorno de simulación
- `PASS` **D6-GASTO** gastos del día registrados en ambas sedes
- `PASS` **dia-6-CIERRE-Principal** cierre de Principal registrado — status=200
- `PASS` **dia-6-CIERRE-Principal-centavo** el cierre de Principal cuadra AL CENTAVO con el libro esperado — esperado: $696 efectivo=$253.5 Bs=14140 · real: $696 efectivo=$253.5 Bs=14140
- `PASS` **dia-6-CIERRE-San Diego** cierre de San Diego registrado — status=200
- `PASS` **dia-6-CIERRE-San Diego-centavo** el cierre de San Diego cuadra AL CENTAVO con el libro esperado — esperado: $345.5 efectivo=$130 Bs=8220 · real: $345.5 efectivo=$130 Bs=8220
- `PASS` **dia-6-NOCHE-integridad** sin huérfanos, sin registros sin sede, sin auditoría sin actor — limpio
- `PASS` **dia-6-NOCHE-sedes** ningún pedido del día cruzó de sede — cruzados=0
- `PASS` **dia-6-NOCHE-pagos** ningún pedido 'Pagado' recibió menos que su total — subpagados=0
- `FAIL` **dia-6-NOCHE-inventario** el inventario REAL cuadra con el libro esperado (36 insumos) — Refresco 1.5L@SD: esperado=-15 real=0
- `PASS` **D6-PLAN** el día ejecutó los 100 pedidos del plan (+4 pedidos-evidencia de escenarios adversariales) — real=104 evidencia=4 (P=66 SD=38) canales={"mesa-cuenta":24,"mesa":18,"pickup":18,"delivery":16,"qr":22,"staff":2}

### dia-6 · Principal: 66 pedidos · $696 cobrados · $0 pendientes · 7 anulados
### dia-6 · San Diego: 38 pedidos · $345.5 cobrados · $0 pendientes · 5 anulados
### canales: {"mesa-cuenta":24,"mesa":18,"pickup":18,"delivery":16,"qr":22,"staff":2}
