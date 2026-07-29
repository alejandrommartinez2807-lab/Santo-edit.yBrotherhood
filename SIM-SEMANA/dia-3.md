# Día 3 — 2026-08-05

run: brotherhood-week-001 · inicio real: 2026-07-29T04:40:09.364Z

Fecha de negocio simulada: 2026-08-05 · run=brotherhood-week-001

## Turno del día: {"P":{"cashier":"mariafernanda","kitchen":"jesus","waiter":"anthony","manager":"genesis"},"SD":{"cashier":"roxana","kitchen":"carlosalberto","waiter":"daniela","manager":"luis"}}
Cuentas abiertas heredadas al abrir: 2
- `PASS` **D3-CX-total** las 4 cancelaciones del plan se ejecutaron con motivo y autor — plan=4 real=4
- `PASS` **D3-SEC-1** la cajera de SD con header de Principal NO recibe pedidos de Principal — filtrados=0
- `PASS` **D3-SEC-2** el mesonero sigue sin poder crear usuarios — status=403
- `PASS` **D3-SEC-3** manipular el ID de un pedido de otra sede NO lo anula — status=500 estado=Entregado
- `PASS` **D3-SEC-4** precio fabricado por el público se corrige al del menú ($9.5) — guardado=$9.5
- `PASS` **D3-SEC-5** una sesión inválida no abre reportes — status=401
- `PASS` **D3-DUP-1** el mismo pago reportado 3 veces (misma pestaña, otra pestaña) no crea 3 comprobantes — creados=1 respuestas=201/409/409
- `PASS` **D3-QR-1** un producto exclusivo de San Diego NO se puede pedir desde el QR de Principal — status=400 El menú cambió mientras armabas tu pedido. Actualiza la página e intenta de nuevo.
- `PASS` **D3-QR-2** un pedido de MESA con teléfono sigue siendo 'Comer aquí' (no se reclasifica a delivery) — tipo=Comer aquí
- `PASS` **D3-GASTO** gastos del día registrados en ambas sedes
- `PASS` **dia-3-CIERRE-Principal** cierre de Principal registrado — status=200
- `PASS` **dia-3-CIERRE-Principal-centavo** el cierre de Principal cuadra AL CENTAVO con el libro esperado — esperado: $459 efectivo=$263.5 Bs=6320 · real: $459 efectivo=$263.5 Bs=6320
- `PASS` **dia-3-CIERRE-San Diego** cierre de San Diego registrado — status=200
- `PASS` **dia-3-CIERRE-San Diego-centavo** el cierre de San Diego cuadra AL CENTAVO con el libro esperado — esperado: $353 efectivo=$123.5 Bs=6720 · real: $353 efectivo=$123.5 Bs=6720
- `PASS` **dia-3-NOCHE-integridad** sin huérfanos, sin registros sin sede, sin auditoría sin actor — limpio
- `PASS` **dia-3-NOCHE-sedes** ningún pedido del día cruzó de sede — cruzados=0
- `PASS` **dia-3-NOCHE-pagos** ningún pedido 'Pagado' recibió menos que su total — subpagados=0
- `PASS` **dia-3-NOCHE-inventario** el inventario REAL cuadra con el libro esperado (36 insumos) — exacto
- `PASS` **D3-PLAN** el día ejecutó los 78 pedidos del plan (+2 pedidos-evidencia de escenarios adversariales) — real=80 evidencia=2 (P=44 SD=36) canales={"mesa-cuenta":8,"mesa":10,"pickup":22,"delivery":22,"qr":14,"staff":2}

### dia-3 · Principal: 44 pedidos · $459 cobrados · $0 pendientes · 3 anulados
### dia-3 · San Diego: 36 pedidos · $353 cobrados · $0 pendientes · 1 anulados
### canales: {"mesa-cuenta":8,"mesa":10,"pickup":22,"delivery":22,"qr":14,"staff":2}
