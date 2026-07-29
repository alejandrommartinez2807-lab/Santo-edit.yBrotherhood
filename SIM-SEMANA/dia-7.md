# Día 7 — 2026-08-09

run: brotherhood-week-001 · inicio real: 2026-07-29T06:07:46.236Z

Fecha de negocio simulada: 2026-08-09 · run=brotherhood-week-001

## Turno del día: {"P":{"cashier":"mariafernanda","kitchen":"jesus","waiter":"anthony","manager":"genesis"},"SD":{"cashier":"roxana","kitchen":"carlosalberto","waiter":"daniela","manager":"luis"}}
Cuentas abiertas heredadas al abrir: 2
- `PASS` **D7-CX-total** las 3 cancelaciones del plan se ejecutaron con motivo y autor — plan=3 real=3
- `PASS` **D7-SEC-1** la cajera de SD con header de Principal NO recibe pedidos de Principal — filtrados=0
- `PASS` **D7-SEC-2** el mesonero sigue sin poder crear usuarios — status=403
- `PASS` **D7-SEC-3** manipular el ID de un pedido de otra sede NO lo anula — status=500 estado=Entregado
- `PASS` **D7-SEC-4** precio fabricado por el público se corrige al del menú ($9.5) — guardado=$9.5
- `PASS` **D7-SEC-5** una sesión inválida no abre reportes — status=401
- `PASS` **D7-REP-1** el consolidado del dueño = Principal + San Diego (al centavo) — consolidado=$5840 P=$3761 SD=$2079
- `PASS` **D7-REP-2** un manager NO obtiene el consolidado de las dos sedes (queda en la suya) — manager=$0 consolidado real=$5840
- `FAIL` **D7-CIERRE-1** hay 14 cierres comerciales (7 días × 2 sedes) + 2 técnicos de fundación, sin mezclarse — comerciales=12 técnicos=4
- `PASS` **D7-GASTO** gastos del día registrados en ambas sedes
- `PASS` **dia-7-CIERRE-Principal** cierre de Principal registrado — status=200
- `PASS` **dia-7-CIERRE-Principal-centavo** el cierre de Principal cuadra AL CENTAVO con el libro esperado — esperado: $516 efectivo=$163 Bs=13320 · real: $516 efectivo=$163 Bs=13320
- `PASS` **dia-7-CIERRE-San Diego** cierre de San Diego registrado — status=200
- `PASS` **dia-7-CIERRE-San Diego-centavo** el cierre de San Diego cuadra AL CENTAVO con el libro esperado — esperado: $241 efectivo=$130 Bs=3840 · real: $241 efectivo=$130 Bs=3840
- `FAIL` **dia-7-NOCHE-integridad** sin huérfanos, sin registros sin sede, sin auditoría sin actor — pedido sin detalles: ord-ms5p4xdy-vxv8csqh2d (SIM Héctor Rodríguez dia-7#57) · pedido sin detalles: ord-ms5p56hb-pzya0jfq1r (SIM Valeria García dia-7#58) · pedido sin detalles: ord-ms5oyw6z-ckjc7yubjd (SIM Camila Mora dia-7#39) · pedido sin detalles: ord-ms5oz4wz-lnixxzbebp (SIM Diego Aponte dia-7#40) · pedido sin detalles: ord-ms5p05ev-3sihrdvkwn (SIM Ana García dia-7#44)
- `PASS` **dia-7-NOCHE-sedes** ningún pedido del día cruzó de sede — cruzados=0
- `PASS` **dia-7-NOCHE-pagos** ningún pedido 'Pagado' recibió menos que su total — subpagados=0
- `FAIL` **dia-7-NOCHE-inventario** el inventario REAL cuadra con el libro esperado (36 insumos) — Refresco 1.5L@SD: esperado=-26 real=0
- `PASS` **D7-PLAN** el día ejecutó los 60 pedidos del plan (+1 pedidos-evidencia de escenarios adversariales) — real=61 evidencia=1 (P=37 SD=24) canales={"mesa-cuenta":14,"mesa":14,"pickup":10,"delivery":8,"qr":12,"staff":2}

### dia-7 · Principal: 37 pedidos · $516 cobrados · $0 pendientes · 2 anulados
### dia-7 · San Diego: 24 pedidos · $241 cobrados · $0 pendientes · 1 anulados
### canales: {"mesa-cuenta":14,"mesa":14,"pickup":10,"delivery":8,"qr":12,"staff":2}
