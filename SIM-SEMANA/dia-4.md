# Día 4 — 2026-08-06

run: brotherhood-week-001 · inicio real: 2026-07-29T04:59:19.548Z

Fecha de negocio simulada: 2026-08-06 · run=brotherhood-week-001

## Turno del día: {"P":{"cashier":"kelvin","kitchen":"jesus","waiter":"yorgelis","manager":"genesis"},"SD":{"cashier":"roxana","kitchen":"carlosalberto","waiter":"gustavo","manager":"luis"}}
Cuentas abiertas heredadas al abrir: 2
- `PASS` **D4-CX-total** las 3 cancelaciones del plan se ejecutaron con motivo y autor — plan=3 real=3
- `PASS` **D4-SEC-1** la cajera de SD con header de Principal NO recibe pedidos de Principal — filtrados=0
- `PASS` **D4-SEC-2** el mesonero sigue sin poder crear usuarios — status=403
- `PASS` **D4-SEC-3** manipular el ID de un pedido de otra sede NO lo anula — status=500 estado=Entregado
- `PASS` **D4-SEC-4** precio fabricado por el público se corrige al del menú ($9.5) — guardado=$9.5
- `PASS` **D4-SEC-5** una sesión inválida no abre reportes — status=401
- `PASS` **D4-COMPRA-PE-D4-1** factura PE-D4-1 suma stock (441→681) y crea la cuenta por pagar — status=201 stock=681
- `PASS` **D4-COMPRA-FT-D4-2** factura FT-D4-2 suma stock (373→573) y crea la cuenta por pagar — status=201 stock=573
- `PASS` **D4-COMPRA-BC-D4-3** factura BC-D4-3 suma stock (102→172) y crea la cuenta por pagar — status=201 stock=172
- `PASS` **D4-ABONO-1** dos abonos simultáneos de $100 no sobrepasan el saldo ni se pierden ($260 total) — pagado=$100 respuestas=201/403
- `PASS` **D4-ABONO-2** un SOBREABONO de $5.000 sobre una factura de $260 se rechaza o se acota — status=400 pagado=$100
- `PASS` **D4-PRECIO-1** el precio de Burger Clásica sube de $6.5 a $8 — status=200
- `PASS` **D4-PRECIO-2** un pedido ANTERIOR conserva su total histórico tras el cambio de precio — guardado=$19 original=$19
- `PASS` **D4-PRECIO-3** el menú público muestra el precio NUEVO de inmediato — público=$8
- `PASS` **D4-PRECIO-4** un cliente con el menú viejo en caché paga el precio NUEVO (no el que tenía guardado) — guardado=$8 enviado=$6.5
- `PASS` **D4-RRHH-1** antes de ser creado, el usuario nuevo no entra — status=401
- `PASS` **D4-RRHH-2** el dueño contrata a Wilmer (mesonero de Principal) a mitad del día — status=201 
- `PASS` **D4-RRHH-3** Wilmer inicia sesión el mismo día
- `PASS` **D4-RRHH-4** Wilmer registra un pedido REAL su primera tarde — status=undefined
- `PASS` **D4-RRHH-5** la contratación queda en auditoría — filas=5
- `PASS` **D4-RRHH-6** Wilmer (mesonero) no ve reportes financieros — status=403
- `PASS` **D4-PROD-1** producto nuevo creado con receta y publicado — status=200
- `PASS` **dia-4-stock-74** el pedido descuenta la receta (insumo inv-17…) — esperado=677 real=677
- `PASS` **D4-PROD-2** el producto nuevo se vende y descuenta su receta — pedido=ord-ms5mv7si-6nijpjb9px
- `PASS` **D4-GASTO** gastos del día registrados en ambas sedes
- `PASS` **dia-4-CIERRE-Principal** cierre de Principal registrado — status=200
- `PASS` **dia-4-CIERRE-Principal-centavo** el cierre de Principal cuadra AL CENTAVO con el libro esperado — esperado: $593.5 efectivo=$211.5 Bs=12780 · real: $593.5 efectivo=$211.5 Bs=12780
- `PASS` **dia-4-CIERRE-San Diego** cierre de San Diego registrado — status=200
- `PASS` **dia-4-CIERRE-San Diego-centavo** el cierre de San Diego cuadra AL CENTAVO con el libro esperado — esperado: $318.5 efectivo=$220.5 Bs=2920 · real: $318.5 efectivo=$220.5 Bs=2920
- `PASS` **dia-4-NOCHE-integridad** sin huérfanos, sin registros sin sede, sin auditoría sin actor — limpio
- `PASS` **dia-4-NOCHE-sedes** ningún pedido del día cruzó de sede — cruzados=0
- `PASS` **dia-4-NOCHE-pagos** ningún pedido 'Pagado' recibió menos que su total — subpagados=0
- `PASS` **dia-4-NOCHE-inventario** el inventario REAL cuadra con el libro esperado (36 insumos) — exacto
- `PASS` **D4-PLAN** el día ejecutó los 72 pedidos del plan (+4 pedidos-evidencia de escenarios adversariales) — real=76 evidencia=4 (P=49 SD=27) canales={"mesa-cuenta":14,"mesa":14,"pickup":14,"delivery":12,"qr":16,"staff":2}

### dia-4 · Principal: 49 pedidos · $593.5 cobrados · $0 pendientes · 2 anulados
### dia-4 · San Diego: 27 pedidos · $318.5 cobrados · $0 pendientes · 1 anulados
### canales: {"mesa-cuenta":14,"mesa":14,"pickup":14,"delivery":12,"qr":16,"staff":2}
