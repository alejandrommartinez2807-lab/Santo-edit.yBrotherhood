# Día 2 — 2026-08-04

run: brotherhood-week-001 · inicio real: 2026-07-29T04:21:55.130Z

Fecha de negocio simulada: 2026-08-04 · run=brotherhood-week-001

## Turno del día: {"P":{"cashier":"kelvin","kitchen":"dubraska","waiter":"yorgelis","manager":"genesis"},"SD":{"cashier":"roxana","kitchen":"carlosalberto","waiter":"gustavo","manager":"luis"}}
Cuentas abiertas heredadas al abrir: 2
- `PASS` **D2-CX-total** las 5 cancelaciones del plan se ejecutaron con motivo y autor — plan=5 real=5
- `PASS` **D2-SEC-1** la cajera de SD con header de Principal NO recibe pedidos de Principal — filtrados=0
- `PASS` **D2-SEC-2** el mesonero sigue sin poder crear usuarios — status=403
- `PASS` **D2-SEC-3** manipular el ID de un pedido de otra sede NO lo anula — status=500 estado=Entregado
- `PASS` **D2-SEC-4** precio fabricado por el público se corrige al del menú ($9.5) — guardado=$9.5
- `PASS` **D2-SEC-5** una sesión inválida no abre reportes — status=401
- `PASS` **D2-STOCK-1** un insumo llega EXACTAMENTE a cero con un ajuste auditado — 48→0 status=200
- `PASS` **D2-STOCK-2** el agotamiento de una sede NO toca el stock de la otra — Principal=80
- `PASS` **D2-CONC-1** dos cocineros marcando LISTO a la vez dejan UN solo estado coherente — respuestas=409/200 estado=Listo
- `BLOCKED` **D2-NOTIF-1** entrega real de push al mesonero (VAPID no configurado en simulación) — VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY vacíos: el evento interno se genera pero no hay entrega externa
- `BLOCKED` **D2-PRINT-1** impresión física de comanda y recibo 80mm — no hay impresora conectada al entorno de simulación
- `PASS` **D2-GASTO** gastos del día registrados en ambas sedes
- `PASS` **dia-2-CIERRE-Principal** cierre de Principal registrado — status=200
- `PASS` **dia-2-CIERRE-Principal-centavo** el cierre de Principal cuadra AL CENTAVO con el libro esperado — esperado: $484 efectivo=$168 Bs=10140 · real: $484 efectivo=$168 Bs=10140
- `PASS` **dia-2-CIERRE-San Diego** cierre de San Diego registrado — status=200
- `PASS` **dia-2-CIERRE-San Diego-centavo** el cierre de San Diego cuadra AL CENTAVO con el libro esperado — esperado: $303.5 efectivo=$62 Bs=7740 · real: $303.5 efectivo=$62 Bs=7740
- `PASS` **dia-2-NOCHE-integridad** sin huérfanos, sin registros sin sede, sin auditoría sin actor — limpio
- `PASS` **dia-2-NOCHE-sedes** ningún pedido del día cruzó de sede — cruzados=0
- `PASS` **dia-2-NOCHE-pagos** ningún pedido 'Pagado' recibió menos que su total — subpagados=0
- `PASS` **dia-2-NOCHE-inventario** el inventario REAL cuadra con el libro esperado (36 insumos) — exacto
- `FAIL` **D2-PLAN** el día ejecutó los 70 pedidos del plan — real=71 (P=45 SD=26) canales={"mesa-cuenta":14,"mesa":18,"pickup":10,"delivery":10,"qr":16,"staff":2}

### dia-2 · Principal: 45 pedidos · $484 cobrados · $0 pendientes · 4 anulados
### dia-2 · San Diego: 26 pedidos · $303.5 cobrados · $0 pendientes · 1 anulados
### canales: {"mesa-cuenta":14,"mesa":18,"pickup":10,"delivery":10,"qr":16,"staff":2}
