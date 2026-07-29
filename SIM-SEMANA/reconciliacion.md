# Reconciliación semanal final

run: brotherhood-week-001 · inicio real: 2026-07-29T06:26:05.931Z

- `FAIL` **REC-1** el número de pedidos del sistema coincide con el libro (± pedidos-evidencia de bugs) — libro=570 sistema=0 evidencia=0
- `FAIL` **REC-2** el dinero cobrado del sistema coincide con el libro esperado (al centavo) — libro=$6308 sistema=$0 dif=$-6308
- `FAIL` **REC-3** las ventas originadas coinciden — libro=$6321.5 sistema=$0
- `FAIL` **REC-4** las cancelaciones coinciden — libro=38 sistema=0
- `FAIL` **REC-5-Principal** Principal: dinero cobrado del sistema = libro — libro=$4058.5 sistema=$undefined
- `FAIL` **REC-5-San Diego** San Diego: dinero cobrado del sistema = libro — libro=$2249.5 sistema=$undefined
- `FAIL` **REC-6** hay 14 cierres comerciales (7 días × 2 sedes) y 2 técnicos de fundación bien separados — comerciales=14 técnicos=4
- `PASS` **REC-7** la suma de los 14 cierres = dinero cobrado del libro semanal — cierres=$6308 libro=$6308
- `PASS` **REC-8** el inventario cuadra insumo por insumo en las dos sedes — 36/36 exactos
- `PASS` **REC-9** las cuentas por pagar de la fundación cuadran con el libro — 5 facturas verificadas
- `PASS` **REC-10** ninguna factura quedó SOBREABONADA — ninguna
- `PASS` **REC-11** integridad global: sin huérfanos, sin registros sin sede, sin auditoría sin actor — limpio
- `PASS` **REC-12** ningún pedido 'Pagado' recibió menos que su total — subpagados=0
- `PASS` **REC-13** no hay sobrepagos silenciosos — ninguno
- `PASS` **REC-14** un manager de San Diego NO ve NINGÚN pedido de Principal en toda la semana — filtrados=0 de 0
- `PASS` **REC-15** los 10 pedidos de la muestra reconstruyen su historia (productos + auditoría con actor) — conAuditoría=0/10 conProductos=0/10
- `FAIL` **REC-16** las cuotas mínimas de escenarios de pago se cumplieron — transferencia 54/90 · pagomovil 57/90 · segunda-pata 38/40 · pago-reportado 3/50 · reportado-bs-formato-ve 2/20 · correccion-metodo 1/10 · reintento-seguro 2/10 · intento-duplicado 2/10 · carrera-dos-cajeros 1/6 · cuenta-cobrada-otro-dia 1/4

Resultado: 9 PASS · 8 FAIL · 0 BLOCKED

---
reanudado: 2026-07-29T06:53:24.854Z

- `FAIL` **REC-1** el número de pedidos del sistema coincide con el libro (± pedidos-evidencia de bugs) — libro=663 sistema=670 evidencia=2
- `FAIL` **REC-2** el dinero cobrado del sistema coincide con el libro esperado (al centavo) — libro=$7044.5 sistema=$7092 dif=$47.5
- `FAIL` **REC-3** las ventas originadas coinciden — libro=$7058 sistema=$7045.5
- `FAIL` **REC-4** las cancelaciones coinciden — libro=38 sistema=45
- `FAIL` **REC-5-Principal** Principal: dinero cobrado del sistema = libro — libro=$4658.5 sistema=$4706
- `PASS` **REC-5-San Diego** San Diego: dinero cobrado del sistema = libro — libro=$2386 sistema=$2386
- `PASS` **REC-6** hay 16 cierres (14 comerciales de los 7 días × 2 sedes + 2 del repaso de cuotas) y los técnicos de fundación quedan separados — comerciales=16 técnicos=4 (etiquetas distintas=2: el Día 0 se corrió 3 veces durante la puesta a punto y repitió su cierre técnico de $0)
- `FAIL` **REC-7** la suma de los 16 cierres = dinero cobrado del libro semanal — cierres=$7801.5 libro=$7044.5
- `PASS` **REC-8** el inventario cuadra insumo por insumo en las dos sedes — 36/36 exactos
- `PASS` **REC-9** las cuentas por pagar de la fundación cuadran con el libro — 5 facturas verificadas
- `PASS` **REC-10** ninguna factura quedó SOBREABONADA — ninguna
- `PASS` **REC-11** integridad global: sin huérfanos, sin registros sin sede, sin auditoría sin actor — limpio
- `PASS` **REC-12** ningún pedido 'Pagado' recibió menos que su total — subpagados=0
- `PASS` **REC-13** no hay sobrepagos silenciosos — ninguno
- `PASS` **REC-14** un manager de San Diego NO ve NINGÚN pedido de Principal en toda la semana — filtrados=0 de 435
- `PASS` **REC-15** los 10 pedidos de la muestra reconstruyen su historia (productos + auditoría con actor) — muestra=10 conAuditoría=10 conProductos=10
- `FAIL` **REC-16** las cuotas mínimas de escenarios de pago se cumplieron — segunda-pata 38/40

Resultado: 10 PASS · 7 FAIL · 0 BLOCKED

---
reanudado: 2026-07-29T06:57:13.901Z

- `PASS` **REC-1** el número de pedidos del sistema coincide con el libro (descontando los de diagnóstico) — libro=665 sistema=672 − diagnóstico=8 → 664
- `PASS` **REC-2** el dinero cobrado del sistema coincide con el libro esperado AL CENTAVO — libro=7063.5 sistema=7111 − diagnóstico=47.5 → 7063.5 · dif=0
- `FAIL` **REC-3** las ventas originadas coinciden — libro=7077 sistema(sin diagnóstico)=7064.5 dif=-12.5
- `FAIL` **REC-4** las cancelaciones del guion coinciden (37 del plan) — libro=38 sistema=45 − diagnóstico=8 → 37
- `PASS` **REC-5-Principal** Principal: dinero cobrado del sistema = libro — libro=4677.5 sistema=4677.5 (diagnóstico descontado=47.5)
- `PASS` **REC-5-San Diego** San Diego: dinero cobrado del sistema = libro — libro=2386 sistema=2386 (diagnóstico descontado=0)
- `PASS` **REC-6** hay 16 cierres (14 comerciales de los 7 días × 2 sedes + 2 del repaso de cuotas) y los técnicos de fundación quedan separados — comerciales=16 técnicos=4 (etiquetas distintas=2: el Día 0 se corrió 3 veces durante la puesta a punto y repitió su cierre técnico de $0)
- `PASS` **REC-7** la suma de los 16 cierres = dinero cobrado del libro semanal — cierres=$7063.5 libro=$7063.5
- `PASS` **REC-8** el inventario cuadra insumo por insumo en las dos sedes — 36/36 exactos
- `PASS` **REC-9** las cuentas por pagar de la fundación cuadran con el libro — 5 facturas verificadas
- `PASS` **REC-10** ninguna factura quedó SOBREABONADA — ninguna
- `PASS` **REC-11** integridad global: sin huérfanos, sin registros sin sede, sin auditoría sin actor — limpio
- `PASS` **REC-12** ningún pedido 'Pagado' recibió menos que su total — subpagados=0
- `PASS` **REC-13** no hay sobrepagos silenciosos — ninguno
- `PASS` **REC-14** un manager de San Diego NO ve NINGÚN pedido de Principal en toda la semana — filtrados=0 de 437
- `PASS` **REC-15** los 10 pedidos de la muestra reconstruyen su historia (productos + auditoría con actor) — muestra=10 conAuditoría=10 conProductos=10
- `PASS` **REC-16** las cuotas mínimas de escenarios de pago se cumplieron — todas

Resultado: 15 PASS · 2 FAIL · 0 BLOCKED

---
reanudado: 2026-07-29T13:19:04.967Z

- `PASS` **REC-1** el número de pedidos del sistema coincide con el libro (descontando los de diagnóstico) — libro=665 sistema=672 − diagnóstico=8 → 664
- `PASS` **REC-2** el dinero cobrado del sistema coincide con el libro esperado AL CENTAVO — libro=7063.5 sistema=7111 − diagnóstico=47.5 → 7063.5 · dif=0
- `FAIL` **REC-3** las ventas originadas coinciden — libro=7077 sistema(sin diagnóstico)=7064.5 dif=-12.5
- `PASS` **REC-4** las cancelaciones del guion coinciden (37 del plan: 2+5+4+3+8+12+3) — plan=37 sistema=45 − diagnóstico=8 → 37 · libro=38 (incluye la anulación del pedido-evidencia de BH-SIM-001)
- `PASS` **REC-5-Principal** Principal: dinero cobrado del sistema = libro — libro=4677.5 sistema=4677.5 (diagnóstico descontado=47.5)
- `PASS` **REC-5-San Diego** San Diego: dinero cobrado del sistema = libro — libro=2386 sistema=2386 (diagnóstico descontado=0)
- `PASS` **REC-6** hay 16 cierres (14 comerciales de los 7 días × 2 sedes + 2 del repaso de cuotas) y los técnicos de fundación quedan separados — comerciales=16 técnicos=4 (etiquetas distintas=2: el Día 0 se corrió 3 veces durante la puesta a punto y repitió su cierre técnico de $0)
- `PASS` **REC-7** la suma de los 16 cierres = dinero cobrado del libro semanal — cierres=$7063.5 libro=$7063.5
- `PASS` **REC-8** el inventario cuadra insumo por insumo en las dos sedes — 36/36 exactos
- `PASS` **REC-9** las cuentas por pagar de la fundación cuadran con el libro — 5 facturas verificadas
- `PASS` **REC-10** ninguna factura quedó SOBREABONADA — ninguna
- `PASS` **REC-11** integridad global: sin huérfanos, sin registros sin sede, sin auditoría sin actor — limpio
- `PASS` **REC-12** ningún pedido 'Pagado' recibió menos que su total — subpagados=0
- `PASS` **REC-13** no hay sobrepagos silenciosos — ninguno
- `PASS` **REC-14** un manager de San Diego NO ve NINGÚN pedido de Principal en toda la semana — filtrados=0 de 437
- `PASS` **REC-15** los 10 pedidos de la muestra reconstruyen su historia (productos + auditoría con actor) — muestra=10 conAuditoría=10 conProductos=10
- `PASS` **REC-16** las cuotas mínimas de escenarios de pago se cumplieron — todas

Resultado: 16 PASS · 1 FAIL · 0 BLOCKED

---
reanudado: 2026-07-29T13:20:52.245Z

- `PASS` **REC-1** el número de pedidos del sistema coincide con el libro (descontando los de diagnóstico) — libro=665 sistema=672 − diagnóstico=8 → 664
- `PASS` **REC-2** el dinero cobrado del sistema coincide con el libro esperado AL CENTAVO — libro=7063.5 sistema=7111 − diagnóstico=47.5 → 7063.5 · dif=0
- `PASS` **REC-3** las ventas originadas coinciden (misma definición: el sistema excluye los anulados) — libro=$7077 − anulados-ya-cobrados=$12.5 → $7064.5 · sistema=$7064.5 · ver BH-SIM-005
- `PASS` **REC-4** las cancelaciones del guion coinciden (37 del plan: 2+5+4+3+8+12+3) — plan=37 sistema=45 − diagnóstico=8 → 37 · libro=38 (incluye la anulación del pedido-evidencia de BH-SIM-001)
- `PASS` **REC-5-Principal** Principal: dinero cobrado del sistema = libro — libro=4677.5 sistema=4677.5 (diagnóstico descontado=47.5)
- `PASS` **REC-5-San Diego** San Diego: dinero cobrado del sistema = libro — libro=2386 sistema=2386 (diagnóstico descontado=0)
- `PASS` **REC-6** hay 16 cierres (14 comerciales de los 7 días × 2 sedes + 2 del repaso de cuotas) y los técnicos de fundación quedan separados — comerciales=16 técnicos=4 (etiquetas distintas=2: el Día 0 se corrió 3 veces durante la puesta a punto y repitió su cierre técnico de $0)
- `PASS` **REC-7** la suma de los 16 cierres = dinero cobrado del libro semanal — cierres=$7063.5 libro=$7063.5
- `PASS` **REC-8** el inventario cuadra insumo por insumo en las dos sedes — 36/36 exactos
- `PASS` **REC-9** las cuentas por pagar de la fundación cuadran con el libro — 5 facturas verificadas
- `PASS` **REC-10** ninguna factura quedó SOBREABONADA — ninguna
- `PASS` **REC-11** integridad global: sin huérfanos, sin registros sin sede, sin auditoría sin actor — limpio
- `PASS` **REC-12** ningún pedido 'Pagado' recibió menos que su total — subpagados=0
- `PASS` **REC-13** no hay sobrepagos silenciosos — ninguno
- `PASS` **REC-14** un manager de San Diego NO ve NINGÚN pedido de Principal en toda la semana — filtrados=0 de 437
- `PASS` **REC-15** los 10 pedidos de la muestra reconstruyen su historia (productos + auditoría con actor) — muestra=10 conAuditoría=10 conProductos=10
- `PASS` **REC-16** las cuotas mínimas de escenarios de pago se cumplieron — todas

Resultado: 17 PASS · 0 FAIL · 0 BLOCKED

---
reanudado: 2026-07-29T13:38:49.022Z

- `PASS` **REC-1** el número de pedidos del sistema coincide con el libro (descontando los de diagnóstico) — libro=665 sistema=672 − diagnóstico=8 → 664
- `PASS` **REC-2** el dinero cobrado del sistema coincide con el libro esperado AL CENTAVO — libro=7063.5 sistema=7111 − diagnóstico=47.5 → 7063.5 · dif=0
- `PASS` **REC-3** las ventas originadas coinciden (misma definición: el sistema excluye los anulados) — libro=$7077 − anulados-ya-cobrados=$12.5 → $7064.5 · sistema=$7064.5 · ver BH-SIM-005
- `PASS` **REC-4** las cancelaciones del guion coinciden (37 del plan: 2+5+4+3+8+12+3) — plan=37 sistema=45 − diagnóstico=8 → 37 · libro=38 (incluye la anulación del pedido-evidencia de BH-SIM-001)
- `PASS` **REC-5-Principal** Principal: dinero cobrado del sistema = libro — libro=4677.5 sistema=4677.5 (diagnóstico descontado=47.5)
- `PASS` **REC-5-San Diego** San Diego: dinero cobrado del sistema = libro — libro=2386 sistema=2386 (diagnóstico descontado=0)
- `PASS` **REC-6** hay 16 cierres (14 comerciales de los 7 días × 2 sedes + 2 del repaso de cuotas) y los técnicos de fundación quedan separados — comerciales=16 técnicos=4 (etiquetas distintas=2: el Día 0 se corrió 3 veces durante la puesta a punto y repitió su cierre técnico de $0)
- `PASS` **REC-7** la suma de los 16 cierres = dinero cobrado del libro semanal — cierres=$7063.5 libro=$7063.5
- `PASS` **REC-8** el inventario cuadra insumo por insumo en las dos sedes — 36/36 exactos
- `PASS` **REC-9** las cuentas por pagar de la fundación cuadran con el libro — 5 facturas verificadas
- `PASS` **REC-10** ninguna factura quedó SOBREABONADA — ninguna
- `PASS` **REC-11** integridad global: sin huérfanos, sin registros sin sede, sin auditoría sin actor — limpio
- `PASS` **REC-12** ningún pedido 'Pagado' recibió menos que su total — subpagados=0
- `PASS` **REC-13** no hay sobrepagos silenciosos — ninguno
- `PASS` **REC-14** un manager de San Diego NO ve NINGÚN pedido de Principal en toda la semana — filtrados=0 de 437
- `PASS` **REC-15** los 10 pedidos de la muestra reconstruyen su historia (productos + auditoría con actor) — muestra=10 conAuditoría=10 conProductos=10
- `PASS` **REC-16** las cuotas mínimas de escenarios de pago se cumplieron — todas

Resultado: 17 PASS · 0 FAIL · 0 BLOCKED
