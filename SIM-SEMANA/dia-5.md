# Día 5 — 2026-08-07

run: brotherhood-week-001 · inicio real: 2026-07-29T05:18:18.741Z

Fecha de negocio simulada: 2026-08-07 · run=brotherhood-week-001

## Turno del día: {"P":{"cashier":"mariafernanda","kitchen":"dubraska","waiter":"anthony","manager":"genesis"},"SD":{"cashier":"roxana","kitchen":"carlosalberto","waiter":"daniela","manager":"luis"}}
Cuentas abiertas heredadas al abrir: 2
- `PASS` **D5-CX-total** las 8 cancelaciones del plan se ejecutaron con motivo y autor — plan=8 real=8
- `PASS` **D5-SEC-1** la cajera de SD con header de Principal NO recibe pedidos de Principal — filtrados=0
- `PASS` **D5-SEC-2** el mesonero sigue sin poder crear usuarios — status=403
- `PASS` **D5-SEC-3** manipular el ID de un pedido de otra sede NO lo anula — status=500 estado=Entregado
- `PASS` **D5-SEC-4** precio fabricado por el público se corrige al del menú ($9.5) — guardado=$9.5
- `PASS` **D5-SEC-5** una sesión inválida no abre reportes — status=401
- `PASS` **D5-EVT-1** el modo evento se activa en Principal — status=200
- `PASS` **D5-EVT-2** la promotora registra y cobra sus propias ventas — ventas=4
- `PASS` **D5-EVT-3** la venta queda ATRIBUIDA a la promotora (registró y cobró) — registró=undefined cobró=Vanessa
- `FAIL` **D5-EVT-4** el reporte por vendedor existe y no está vacío — claves=ok,scope,supplierPayables,supplierPurchases,productMargins,inventoryHealth,managerAlerts,range,comparison,delivery,colle
- `FAIL` **D5-CONC-1** dos cajeros cobrando el MISMO pedido: solo uno gana y el pedido no cobra doble — ganadores=2 recibido=$9.5 total=$9.5
- `PASS` **D5-RRHH-1** el dueño desactiva a Gustavo — status=200
- `PASS` **D5-RRHH-2** el despedido NO puede volver a iniciar sesión ni anular con su token viejo — login=true anular=401
- `PASS` **D5-RRHH-3** el historial y la auditoría de Gustavo permanecen intactos — pedidos suyos en base=0
- `PASS` **D5-RRHH-4** el pedido creado con el token del despedido NO queda atribuido a él — registrado_por=(público)
- `PASS` **D5-STOCK-1** el insumo queda al borde del agotamiento (0.02) — stock=0.02
- `PASS` **D5-GASTO** gastos del día registrados en ambas sedes
- `PASS` **dia-5-CIERRE-Principal** cierre de Principal registrado — status=200
- `PASS` **dia-5-CIERRE-Principal-centavo** el cierre de Principal cuadra AL CENTAVO con el libro esperado — esperado: $889.5 efectivo=$419.5 Bs=16240 · real: $889.5 efectivo=$419.5 Bs=16240
- `PASS` **dia-5-CIERRE-San Diego** cierre de San Diego registrado — status=200
- `PASS` **dia-5-CIERRE-San Diego-centavo** el cierre de San Diego cuadra AL CENTAVO con el libro esperado — esperado: $465.5 efectivo=$144 Bs=12280 · real: $465.5 efectivo=$144 Bs=12280
- `PASS` **dia-5-NOCHE-integridad** sin huérfanos, sin registros sin sede, sin auditoría sin actor — limpio
- `PASS` **dia-5-NOCHE-sedes** ningún pedido del día cruzó de sede — cruzados=0
- `PASS` **dia-5-NOCHE-pagos** ningún pedido 'Pagado' recibió menos que su total — subpagados=0
- `PASS` **dia-5-NOCHE-inventario** el inventario REAL cuadra con el libro esperado (36 insumos) — exacto
- `FAIL` **D5-PLAN** el día ejecutó los 115 pedidos del plan (+3 pedidos-evidencia de escenarios adversariales) — real=122 evidencia=3 (P=78 SD=44) canales={"mesa-cuenta":28,"mesa":22,"pickup":20,"delivery":18,"qr":25,"staff":2}

### dia-5 · Principal: 78 pedidos · $889.5 cobrados · $15.5 pendientes · 5 anulados
### dia-5 · San Diego: 44 pedidos · $465.5 cobrados · $0 pendientes · 3 anulados
### canales: {"mesa-cuenta":28,"mesa":22,"pickup":20,"delivery":18,"qr":25,"staff":2}
