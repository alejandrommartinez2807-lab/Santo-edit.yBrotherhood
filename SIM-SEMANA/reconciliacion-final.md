# Reconciliación semanal final

Run: brotherhood-week-v1 · proyecto de prueba `gnyvdlxlrjwbsdctincy` · 8 días comerciales + Día 0 de fundación.
Libro contable esperado calculado de forma INDEPENDIENTE del sistema
(`scripts/sim/lib/expected-ledger.mjs`), comparado contra la base real.

## Tabla semanal

La columna "Sistema" descuenta los 8 pedidos de DIAGNÓSTICO
($47.50) que crearon los scripts de verificación de los bugs: no son
operación del negocio y se listan al final del informe.

| Concepto | Bitácora esperada | Sistema (sin diagnóstico) | Diferencia | Estado |
| --- | ---: | ---: | ---: | --- |
| Pedidos | 665 | 664 | -1 | OK |
| Clientes equivalentes | 1120 | — | — | solo bitácora |
| Ventas originadas | $7064.50 | $7064.50 | $0.00 | OK |
| **Dinero cobrado** | **$7063.50** | **$7063.50** | **$0.00** | **OK — AL CENTAVO** |
| Pendiente al cierre | $13.50 | — | — | libro |
| Cancelaciones (del guion) | 37 | 37 | 0 | OK |
| Gastos | $156.00 | — | — | libro |
| Suma de los 16 cierres | $7063.50 | $7063.50 | $0.00 | OK |
| Inventario (36 insumos) | exacto | exacto | 0 | OK |

Las dos diferencias que hubo que explicar:

- **Ventas originadas**: el libro incluye $12.50 de un pedido que se
  vendió, se cobró y luego se anuló. El sistema lo excluye de "ventas" pero
  mantiene su dinero en el cierre — es el hallazgo **BH-SIM-005**.
- **Cancelaciones**: el libro anotó 38 porque también contó la anulación del
  pedido-evidencia del bug del precio. Las del guion son 37 = 2+5+4+3+8+12+3.


### Por sede

| Sede | Pedidos | Cobrado (libro) | Cobrado (sistema) | Diferencia | Cancelaciones |
| --- | ---: | ---: | ---: | ---: | ---: |
| Principal | 430 | $4677.50 | $4677.50 | $0.00 | 25 |
| San Diego | 235 | $2386.00 | $2386.00 | $0.00 | 13 |


### Por día

| Día | Pedidos | Ventas originadas | Dinero cobrado | Cancelaciones |
| --- | ---: | ---: | ---: | ---: |
| dia-1 | 56 | $656.50 | $643.00 | 3 |
| dia-2 | 71 | $787.50 | $787.50 | 5 |
| dia-3 | 80 | $812.00 | $812.00 | 4 |
| dia-4 | 76 | $912.00 | $912.00 | 3 |
| dia-5 | 122 | $1370.50 | $1355.00 | 8 |
| dia-6 | 107 | $1071.00 | $1041.50 | 12 |
| dia-7 | 61 | $757.00 | $757.00 | 3 |
| repaso-cuotas | 92 | $710.50 | $755.50 | 0 |


### Dinero cobrado por método (libro esperado)

| Método | Moneda | Total |
| --- | --- | ---: |
| Efectivo divisas | USD | $2798.00 |
| Zelle | USD | $571.00 |
| Pago móvil | Bs | 73460.00 |
| Transferencia | Bs | 49980.00 |
| Punto | Bs | 24340.00 |


### Cuotas de escenarios de pago exigidas por el guion

| Escenario | Exigido | Ejecutado | Estado |
| --- | ---: | ---: | --- |
| efectivo | 100 | 175 | CUMPLE |
| transferencia | 90 | 90 | CUMPLE |
| pagomovil | 90 | 90 | CUMPLE |
| mixto | 70 | 93 | CUMPLE |
| segunda-pata | 40 | 40 | CUMPLE |
| pago-reportado | 50 | 50 | CUMPLE |
| reportado-bs-formato-ve | 20 | 22 | CUMPLE |
| efectivo-cambio | 20 | 54 | CUMPLE |
| correccion-metodo | 10 | 10 | CUMPLE |
| reintento-seguro | 10 | 10 | CUMPLE |
| intento-duplicado | 10 | 10 | CUMPLE |
| carrera-dos-cajeros | 6 | 6 | CUMPLE |
| cuenta-cobrada-otro-dia | 4 | 4 | CUMPLE |


### Trazabilidad de 10 pedidos (muestra determinista)

**1. ord-ms5jtwp7-xca8ybyvcx** · Principal · Comer aquí · Entregado/Pagado
- Cliente: SIM Pedro Blanco dia-1#1
- Productos: 1× Salchipapa @$4
- Registró: Anthony · Cobró: María Fernanda
- Total $4.00 · Recibido $4.00
- Auditoría: order.status.updated(Jesús) → order.status.updated(Jesús) → order.status.updated(Anthony)

**2. ord-ms5kxl03-n1grrzyx6e** · Principal · Comer aquí · Entregado/Pagado
- Cliente: SIM Carla Pérez dia-2#8
- Productos: 1× Combo Brutal @$13
- Registró: Yorgelis · Cobró: Kelvin
- Total $13.00 · Recibido $13.00
- Auditoría: order.status.updated(Dubraska) → order.status.updated(Dubraska) → order.status.updated(Yorgelis)

**3. ord-ms5ljvwd-myofknms0l** · Principal · Comer aquí · Entregado/Pagado
- Cliente: SIM Héctor Salazar dia-3#4
- Productos: 1× Burger Clásica @$6.5, 1× Refresco 1.5L @$2.5
- Registró: Anthony · Cobró: María Fernanda
- Total $9.00 · Recibido $9.00
- Auditoría: order.status.updated(Jesús) → order.status.updated(Jesús) → order.status.updated(Anthony)

**4. ord-ms5m3od4-cyrngd5jze** · San Diego · Comer aquí · Entregado/Pagado
- Cliente: SIM Andrés Torres dia-3#71
- Productos: 1× Burger Vegetariana @$6, 1× Papas Medianas @$3
- Registró: (público) · Cobró: Roxana
- Total $9.00 · Recibido $9.00
- Auditoría: order.status.updated(Carlos Alberto) → order.status.updated(Carlos Alberto) → order.status.updated(Daniela) → order.payment.updated(Roxana)

**5. ord-ms5mp4ts-cif7o0tduj** · Principal · Comer aquí · Entregado/Pagado
- Cliente: SIM Héctor Zambrano dia-4#58
- Productos: 1× Burger de Pollo @$7, 1× Agua mineral @$1.5
- Registró: (público) · Cobró: Kelvin
- Total $8.50 · Recibido $8.50
- Auditoría: order.status.updated(Jesús) → order.status.updated(Jesús) → order.status.updated(Yorgelis) → order.payment.updated(Kelvin)

**6. ord-ms5nayt8-6fflxp4v9x** · San Diego · Comer aquí · Entregado/Pagado
- Cliente: SIM Héctor Rodríguez dia-5#49
- Productos: 1× Tequeños (6) @$4, 1× Refresco 1.5L @$2.5
- Registró: Daniela · Cobró: Roxana
- Total $6.50 · Recibido $6.50
- Auditoría: order.status.updated(Carlos Alberto) → order.status.updated(Carlos Alberto) → order.status.updated(Daniela) → order.payment.updated(Roxana)

**7. ord-ms5nrzyx-uiaiolwj9j** · Principal · Comer aquí · Entregado/Pagado
- Cliente: SIM Precio dia-5
- Productos: 1× Burger Doble Brutal @$9.5
- Registró: (público) · Cobró: María Fernanda
- Total $9.50 · Recibido $9.50
- Auditoría: order.status.updated(Dubraska) → order.status.updated(Dubraska) → order.status.updated(Anthony) → order.payment.updated(María Fernanda)

**8. ord-ms5oa7xc-4mnl7m3jra** · San Diego · Para llevar · Listo/Pagado
- Cliente: SIM José López dia-6#58
- Productos: 1× Tequeños (6) @$4, 1× Refresco 1.5L @$2.5
- Registró: Daniela · Cobró: Roxana
- Total $6.50 · Recibido $6.50
- Auditoría: order.status.updated(Carlos Alberto) → order.status.updated(Carlos Alberto) → order.payment.updated(Roxana)

**9. ord-ms5ourua-gcbwvaclht** · Principal · Comer aquí · Entregado/Pagado
- Cliente: SIM Ramón Colmenares dia-7#21
- Productos: 1× Burger Clásica @$8, 1× Refresco 1.5L @$2.5
- Registró: Anthony · Cobró: María Fernanda
- Total $10.50 · Recibido $10.50
- Auditoría: order.status.updated(Jesús) → order.status.updated(Jesús) → order.status.updated(Anthony) → order.payment.updated(María Fernanda)

**10. ord-ms5ppzdl-1tlp3mgpfy** · San Diego · Comer aquí · Entregado/Pagado
- Cliente: SIM cuota reporte#27
- Productos: 1× Burger Clásica @$6.5
- Registró: Daniela · Cobró: Roxana
- Total $6.50 · Recibido $6.50
- Auditoría: order.status.updated(Carlos Alberto) → order.status.updated(Carlos Alberto) → order.status.updated(Daniela) → order.payment.updated(Roxana)


### Rendimiento (dev server local — producción en Vercel tiene otro perfil)

| Operación | Llamadas | p95 (peor día) | Máximo | Errores 5xx |
| --- | ---: | ---: | ---: | ---: |
| PATCH orders/:id (cocina) | 1094 | 3768 ms | 10450 ms | 0 |
| POST /api/orders | 681 | 10099 ms | 25147 ms | 0 |
| PATCH payment | 520 | 4289 ms | 27342 ms | 0 |
| PATCH orders/:id (entrega) | 446 | 2804 ms | 21875 ms | 0 |
| POST payment-proofs | 47 | 3502 ms | 6191 ms | 0 |
| PATCH proof review | 47 | 1363 ms | 3651 ms | 0 |
| POST /api/open-accounts | 40 | 2035 ms | 2035 ms | 0 |
| PATCH open-account pay | 37 | 13826 ms | 13826 ms | 0 |
| PATCH orders/:id (cancelar) | 37 | 9772 ms | 9772 ms | 0 |
| GET /api/public/products | 22 | 854 ms | 854 ms | 0 |
| POST day-close | 18 | 3891 ms | 3891 ms | 0 |
| GET /api/local-auth | 16 | 1615 ms | 1615 ms | 0 |
| GET /api/reports | 16 | 3470 ms | 3470 ms | 0 |
| POST day-expenses | 14 | 1549 ms | 1549 ms | 0 |
| GET /api/orders | 11 | 3647 ms | 3647 ms | 0 |
| POST /api/staff | 8 | 2073 ms | 2073 ms | 0 |
| POST /api/supplier-purchases | 8 | 3125 ms | 3125 ms | 0 |
| POST /api/supplier-purchases/:id/payments | 8 | 3169 ms | 3169 ms | 0 |
| POST /api/suppliers | 5 | 1429 ms | 1429 ms | 0 |
| POST /api/payment-proofs | 5 | 2109 ms | 2109 ms | 0 |
| POST /api/day-close | 4 | 2505 ms | 2505 ms | 0 |
| POST /api/inventory | 3 | 1817 ms | 1817 ms | 0 |
| GET /api/supplier-purchases | 3 | 1553 ms | 1553 ms | 0 |
| PATCH /api/orders/ord-ms5kvue0-1sqzxd2u0n | 3 | 2336 ms | 2336 ms | 1 |
| PATCH /api/orders/ord-ms5omhtd-xzuga5m7vx/payment | 3 | 2159 ms | 2159 ms | 0 |
| PATCH /api/orders/ord-ms5pgb84-zpxsym445n | 3 | 3295 ms | 3295 ms | 0 |
| PATCH /api/orders/ord-ms5pgxda-v0mvxiugoz | 3 | 5739 ms | 5739 ms | 0 |
| PATCH /api/orders/ord-ms5phjsc-rria5yjkxv | 3 | 2829 ms | 2829 ms | 0 |
| PATCH /api/orders/ord-ms5phxx6-e504uhkzxv | 3 | 2386 ms | 2386 ms | 0 |
| PATCH /api/orders/ord-ms5pibpw-64etrnhjbw | 3 | 2951 ms | 2951 ms | 0 |
| PATCH /api/orders/ord-ms5pitae-5xi8w5zyqd | 3 | 2319 ms | 2319 ms | 0 |
| PATCH /api/orders/ord-ms5pj5va-nzaxcz9yln | 3 | 2042 ms | 2042 ms | 0 |
| PATCH /api/orders/ord-ms5pjhav-rt7pnfn9hk | 3 | 2128 ms | 2128 ms | 0 |
| PATCH /api/orders/ord-ms5pjtmm-4oqiwvrfic | 3 | 1963 ms | 1963 ms | 0 |
| PATCH /api/orders/ord-ms5pk53z-36g6g3grfv | 3 | 1868 ms | 1868 ms | 0 |
| PATCH /api/orders/ord-ms5pkgtg-s9sfemjqys | 3 | 1825 ms | 1825 ms | 0 |
| PATCH /api/orders/ord-ms5pksvs-pjnzpqliph | 3 | 1907 ms | 1907 ms | 0 |
| PATCH /api/orders/ord-ms5pl6ok-lshmtm2zmi | 3 | 1928 ms | 1928 ms | 0 |
| PATCH /api/orders/ord-ms5plhv8-e4rsuiiwzx | 3 | 1924 ms | 1924 ms | 0 |
| PATCH /api/orders/ord-ms5pltfe-bsdecwbzln | 3 | 1901 ms | 1901 ms | 0 |
| PATCH /api/orders/ord-ms5pm5go-oc5btbx3mc | 3 | 2022 ms | 2022 ms | 0 |
| PATCH /api/orders/ord-ms5pmha5-396kk8cnfh | 3 | 1931 ms | 1931 ms | 0 |
| PATCH /api/orders/ord-ms5pmtao-sa4gqvalwo | 3 | 2055 ms | 2055 ms | 0 |
| PATCH /api/orders/ord-ms5pn5bn-7sdrqkffwt | 3 | 1864 ms | 1864 ms | 0 |
| PATCH /api/orders/ord-ms5pnm5v-rfdgiwcpib | 3 | 1915 ms | 1915 ms | 0 |
| PATCH /api/orders/ord-ms5pny3u-tnvabuin7q | 3 | 3041 ms | 3041 ms | 0 |
| PATCH /api/orders/ord-ms5pobg0-xln1lnxraw | 3 | 1970 ms | 1970 ms | 0 |
| PATCH /api/orders/ord-ms5pon81-kij9rhgzqa | 3 | 2060 ms | 2060 ms | 0 |
| PATCH /api/orders/ord-ms5pozqc-nwmof9ra0a | 3 | 1983 ms | 1983 ms | 0 |
| PATCH /api/orders/ord-ms5ppbef-hybjiluzxu | 3 | 2007 ms | 2007 ms | 0 |
| PATCH /api/orders/ord-ms5ppnl8-gdguajvgow | 3 | 2078 ms | 2078 ms | 0 |
| PATCH /api/orders/ord-ms5ppzdl-1tlp3mgpfy | 3 | 1888 ms | 1888 ms | 0 |
| PATCH /api/orders/ord-ms5pqajw-9bet2uc33s | 3 | 2062 ms | 2062 ms | 0 |
| PATCH /api/orders/ord-ms5pqm61-lcqkyah2uh | 3 | 1920 ms | 1920 ms | 0 |
| PATCH /api/orders/ord-ms5pqxd1-0fvuqx3hl7 | 3 | 2013 ms | 2013 ms | 0 |
| PATCH /api/orders/ord-ms5pr9ei-asnr7aqwyj | 3 | 1940 ms | 1940 ms | 0 |
| PATCH /api/orders/ord-ms5prleh-lnotityqyh | 3 | 2104 ms | 2104 ms | 0 |
| PATCH /api/orders/ord-ms5prxuc-dy6fpcizqf | 3 | 1940 ms | 1940 ms | 0 |
| PATCH /api/orders/ord-ms5ps99q-nkgrftlssf | 3 | 2090 ms | 2090 ms | 0 |
| PATCH /api/orders/ord-ms5pso3c-izdqukrlks | 3 | 2011 ms | 2011 ms | 0 |
| PATCH /api/orders/ord-ms5pt0dc-zh4l1xqpdo | 3 | 2020 ms | 2020 ms | 0 |
| PATCH /api/orders/ord-ms5ptc8v-vivhsryp | 3 | 1913 ms | 1913 ms | 0 |
| PATCH /api/orders/ord-ms5ptni7-hnol7di9nm | 3 | 2091 ms | 2091 ms | 0 |
| PATCH /api/orders/ord-ms5ptzhd-vmo2q2xvms | 3 | 1922 ms | 1922 ms | 0 |
| PATCH /api/orders/ord-ms5pub1f-r55xm8igri | 3 | 1992 ms | 1992 ms | 0 |
| PATCH /api/orders/ord-ms5pungb-gbhc00vkgt | 3 | 1878 ms | 1878 ms | 0 |
| PATCH /api/orders/ord-ms5puz55-ssqosylb7u | 3 | 1861 ms | 1861 ms | 0 |
| PATCH /api/orders/ord-ms5pvap4-a7vx0nmoq4 | 3 | 1918 ms | 1918 ms | 0 |
| PATCH /api/orders/ord-ms5pvmq4-cn5epjpjde | 3 | 1851 ms | 1851 ms | 0 |
| PATCH /api/orders/ord-ms5pvy1r-dy2tepzwnt | 3 | 2008 ms | 2008 ms | 0 |
| PATCH /api/orders/ord-ms5pwa01-rpngu7dy8a | 3 | 5769 ms | 5769 ms | 0 |
| PATCH /api/orders/ord-ms5pwo8c-idvlbhrmtu | 3 | 1877 ms | 1877 ms | 0 |
| PATCH /api/orders/ord-ms5pwzue-0eycwg0lk5 | 3 | 2002 ms | 2002 ms | 0 |
| PATCH /api/orders/ord-ms5pxapu-ulqzjqo2jt | 3 | 1970 ms | 1970 ms | 0 |
| PATCH /api/orders/ord-ms5pxlru-4ieul6ni7b | 3 | 4048 ms | 4048 ms | 0 |
| PATCH /api/orders/ord-ms5pxyta-ibieklshls | 3 | 1888 ms | 1888 ms | 0 |
| PATCH /api/orders/ord-ms5py9tm-mx251ng4sf | 3 | 2008 ms | 2008 ms | 0 |
| PATCH /api/orders/ord-ms5pyl3t-low0h3zxzl | 3 | 1917 ms | 1917 ms | 0 |
| PATCH /api/orders/ord-ms5pyvsr-d6k9cy074g | 3 | 1982 ms | 1982 ms | 0 |
| PATCH /api/orders/ord-ms5pz6rn-jk8bxrn7n3 | 3 | 1929 ms | 1929 ms | 0 |
| PATCH /api/orders/ord-ms5pzho9-tx0itaawe5 | 3 | 1966 ms | 1966 ms | 0 |
| PATCH /api/orders/ord-ms5q1pxv-uslfqpqfzc | 3 | 2035 ms | 2035 ms | 0 |
| PATCH /api/orders/ord-ms5q1zr3-tydl9rbgpy | 3 | 1895 ms | 1895 ms | 0 |
| PATCH /api/orders/ord-ms5q28yu-ncox5hkicf | 3 | 1944 ms | 1944 ms | 0 |
| PATCH /api/orders/ord-ms5q2ibl-cc6mzpuqd6 | 3 | 1906 ms | 1906 ms | 0 |
| PATCH /api/orders/ord-ms5q2rh5-oqnvudjr5v | 3 | 1830 ms | 1830 ms | 0 |
| PATCH /api/orders/ord-ms5q30hk-rttzzig3r8 | 3 | 1830 ms | 1830 ms | 0 |
| PATCH /api/orders/ord-ms5q39qg-4wkxbp0au8 | 3 | 1871 ms | 1871 ms | 0 |
| PATCH /api/orders/ord-ms5q3imh-riayxqoneg | 3 | 1972 ms | 1972 ms | 0 |
| PATCH /api/orders/ord-ms5q3seu-dukfgkuc70 | 3 | 1861 ms | 1861 ms | 0 |
| PATCH /api/orders/ord-ms5q41fv-avdbrtpn9o | 3 | 1929 ms | 1929 ms | 0 |
| PATCH /api/orders/ord-ms5q4ahm-kd2ehcxpuw | 3 | 1880 ms | 1880 ms | 0 |
| PATCH /api/orders/ord-ms5q4jfy-fqrotefsry | 3 | 1836 ms | 1836 ms | 0 |
| PATCH /api/orders/ord-ms5q4sck-hldwbvhvtb | 3 | 1826 ms | 1826 ms | 0 |
| PATCH /api/orders/ord-ms5q67no-xbaleynr6l | 3 | 1854 ms | 1854 ms | 0 |
| PATCH /api/orders/ord-ms5q6goh-fl165ypq4n | 3 | 2244 ms | 2244 ms | 0 |
| PATCH /api/orders/ord-ms5q6qla-o8d6cwzbpt | 3 | 1874 ms | 1874 ms | 0 |
| PATCH /api/orders/ord-ms5q6zmy-cebrprllkk | 3 | 1861 ms | 1861 ms | 0 |
| PATCH /api/orders/ord-ms5q78t5-sfyovp33kf | 3 | 1803 ms | 1803 ms | 0 |
| PATCH /api/orders/ord-ms5q7hjx-ob22scsouo | 3 | 1864 ms | 1864 ms | 0 |
| PATCH /api/orders/ord-ms5q7qic-mll52c0kdz | 3 | 1806 ms | 1806 ms | 0 |
| PATCH /api/orders/ord-ms5q7zdd-hetwwdasp2 | 3 | 1846 ms | 1846 ms | 0 |
| PATCH /api/orders/ord-ms5q87uw-qwhova0nt5 | 3 | 1857 ms | 1857 ms | 0 |
| PATCH /api/orders/ord-ms5q8gm1-4cdkweo4gl | 3 | 1894 ms | 1894 ms | 0 |
| PATCH /api/orders/ord-ms5q8pt0-k9ubx3l0b8 | 3 | 1835 ms | 1835 ms | 0 |
| PATCH /api/orders/ord-ms5q8ylt-atqgv8t6jr | 3 | 1944 ms | 1944 ms | 0 |
| PATCH /api/orders/ord-ms5q97kv-ag514byh7m | 3 | 2425 ms | 2425 ms | 0 |
| PATCH /api/branches/:id/config | 2 | 1731 ms | 1731 ms | 0 |
| GET /api/public/business-config | 2 | 385 ms | 385 ms | 0 |
| POST /api/menu-products | 2 | 1904 ms | 1904 ms | 0 |
| PATCH /api/orders/ord-ms5ntjm5-ydsuaj7ypg/payment | 2 | 2461 ms | 2461 ms | 0 |
| PATCH /api/orders/ord-ms5pzt2u-y347bf9h1l | 2 | 2085 ms | 2085 ms | 0 |
| PATCH /api/orders/ord-ms5q01fu-tl4dedfobp | 2 | 1900 ms | 1900 ms | 0 |
| PATCH /api/orders/ord-ms5q09ig-vclcmggggx | 2 | 1974 ms | 1974 ms | 0 |
| PATCH /api/orders/ord-ms5q0i3t-3rv75gw2zu | 2 | 1876 ms | 1876 ms | 0 |
| PATCH /api/orders/ord-ms5q0q5u-e4otldtanp | 2 | 1897 ms | 1897 ms | 0 |
| PATCH /api/orders/ord-ms5q0y4l-qvmikaw93s | 2 | 1835 ms | 1835 ms | 0 |
| PATCH /api/orders/ord-ms5q1695-qcxfmtuzsr | 2 | 1920 ms | 1920 ms | 0 |
| PATCH /api/orders/ord-ms5q1e7q-1enk5ukxkw | 2 | 1917 ms | 1917 ms | 0 |
| PATCH /api/orders/ord-ms5q1pxv-uslfqpqfzc/payment | 2 | 2265 ms | 2265 ms | 0 |
| PATCH /api/orders/ord-ms5q1zr3-tydl9rbgpy/payment | 2 | 2007 ms | 2007 ms | 0 |
| PATCH /api/orders/ord-ms5q28yu-ncox5hkicf/payment | 2 | 2074 ms | 2074 ms | 0 |
| PATCH /api/orders/ord-ms5q2ibl-cc6mzpuqd6/payment | 2 | 2116 ms | 2116 ms | 0 |
| PATCH /api/orders/ord-ms5q2rh5-oqnvudjr5v/payment | 2 | 2090 ms | 2090 ms | 0 |
| PATCH /api/orders/ord-ms5q30hk-rttzzig3r8/payment | 2 | 2192 ms | 2192 ms | 0 |
| PATCH /api/orders/ord-ms5q39qg-4wkxbp0au8/payment | 2 | 2131 ms | 2131 ms | 0 |
| PATCH /api/orders/ord-ms5q3imh-riayxqoneg/payment | 2 | 2498 ms | 2498 ms | 0 |
| PATCH /api/orders/ord-ms5q3seu-dukfgkuc70/payment | 2 | 2054 ms | 2054 ms | 0 |
| PATCH /api/orders/ord-ms5q41fv-avdbrtpn9o/payment | 2 | 2116 ms | 2116 ms | 0 |
| PATCH /api/orders/ord-ms5q4ahm-kd2ehcxpuw/payment | 2 | 1935 ms | 1935 ms | 0 |
| PATCH /api/orders/ord-ms5q4jfy-fqrotefsry/payment | 2 | 2096 ms | 2096 ms | 0 |
| PATCH /api/orders/ord-ms5q4sck-hldwbvhvtb/payment | 2 | 2038 ms | 2038 ms | 0 |
| PATCH /api/orders/ord-ms5q52tg-guc7fihxiw | 2 | 1977 ms | 1977 ms | 0 |
| PATCH /api/orders/ord-ms5q5h60-mse9ysjmta | 2 | 1730 ms | 1730 ms | 0 |
| PATCH /api/orders/ord-ms5q5upf-8zjvq3b9u8 | 2 | 2143 ms | 2143 ms | 0 |
| GET /api/public/branches | 1 | 252 ms | 252 ms | 0 |
| POST /api/business-config | 1 | 664 ms | 664 ms | 0 |
| POST /api/delivery-distance | 1 | 498 ms | 498 ms | 0 |
| GET /api/branches | 1 | 955 ms | 955 ms | 0 |
| PATCH /api/orders/ord-ms5k76ol-y30vsrjjdx | 1 | 972 ms | 972 ms | 1 |
| PATCH /api/orders/ord-ms5k7igt-uz0ogl9bl0 | 1 | 5283 ms | 5283 ms | 0 |
| PATCH /api/orders/ord-ms5l3uhq-iott4lgavl | 1 | 2147 ms | 2147 ms | 0 |
| PATCH /api/orders/ord-ms5ky6fz-p8ng9bjwv9 | 1 | 1395 ms | 1395 ms | 1 |
| PATCH /api/orders/ord-ms5lq8pc-s4mrvbuakz | 1 | 2170 ms | 2170 ms | 0 |
| PATCH /api/orders/ord-ms5llfdi-953f9o97w9 | 1 | 1058 ms | 1058 ms | 1 |
| PATCH /api/orders/ord-ms5mgu8x-emacf7cwpc | 1 | 1886 ms | 1886 ms | 0 |
| PATCH /api/orders/ord-ms5mace5-txxx68n9rr | 1 | 1051 ms | 1051 ms | 1 |
| POST /api/inventory-recipes | 1 | 1401 ms | 1401 ms | 0 |
| PATCH /api/orders/ord-ms5n8nv1-cvgc7qsq7w | 1 | 1822 ms | 1822 ms | 0 |
| PATCH /api/orders/ord-ms5ngnx5-axonfaulo4 | 1 | 1928 ms | 1928 ms | 0 |
| PATCH /api/orders/ord-ms5myvbl-yejf8g0el9 | 1 | 1243 ms | 1243 ms | 1 |
| PATCH /api/staff/:id | 1 | 3777 ms | 3777 ms | 0 |
| PATCH /api/orders/ord-ms5mwcpv-fy0aynw7gf | 1 | 500 ms | 500 ms | 0 |
| PATCH /api/orders/ord-ms5o564z-s3ubo1alwq | 1 | 1708 ms | 1708 ms | 0 |
| PATCH /api/orders/ord-ms5obi28-luiukht0v4 | 1 | 1890 ms | 1890 ms | 0 |
| PATCH /api/orders/ord-ms5nxlw5-evh9rb8elc | 1 | 1097 ms | 1097 ms | 1 |
| PATCH /api/open-accounts/:id | 1 | 7180 ms | 7180 ms | 0 |
| PATCH /api/orders/ord-ms5o4eye-mqy5lchf70 | 1 | 680 ms | 680 ms | 0 |
| PATCH /api/orders/ord-ms5nuvc8-rzbajynwoy | 1 | 2556 ms | 2556 ms | 0 |
| PATCH /api/orders/ord-ms5ovs4d-9zqf0sa8sk | 1 | 1839 ms | 1839 ms | 0 |
| PATCH /api/orders/ord-ms5opf5c-ubogzxrimp | 1 | 1202 ms | 1202 ms | 1 |
| GET /api/day-closes | 1 | 1945 ms | 1945 ms | 0 |
| PATCH /api/orders/ord-ms5pwzue-0eycwg0lk5/payment | 1 | 2115 ms | 2115 ms | 0 |
| PATCH /api/orders/ord-ms5pxapu-ulqzjqo2jt/payment | 1 | 2084 ms | 2084 ms | 0 |
| PATCH /api/orders/ord-ms5pxlru-4ieul6ni7b/payment | 1 | 1913 ms | 1913 ms | 0 |
| PATCH /api/orders/ord-ms5pxyta-ibieklshls/payment | 1 | 2066 ms | 2066 ms | 0 |
| PATCH /api/orders/ord-ms5py9tm-mx251ng4sf/payment | 1 | 2164 ms | 2164 ms | 0 |
| PATCH /api/orders/ord-ms5pyl3t-low0h3zxzl/payment | 1 | 2047 ms | 2047 ms | 0 |
| PATCH /api/orders/ord-ms5pyvsr-d6k9cy074g/payment | 1 | 2140 ms | 2140 ms | 0 |
| PATCH /api/orders/ord-ms5pz6rn-jk8bxrn7n3/payment | 1 | 2038 ms | 2038 ms | 0 |
| PATCH /api/orders/ord-ms5pzho9-tx0itaawe5/payment | 1 | 2174 ms | 2174 ms | 0 |
| PATCH /api/orders/ord-ms5pzt2u-y347bf9h1l/payment | 1 | 2063 ms | 2063 ms | 0 |
| PATCH /api/orders/ord-ms5q01fu-tl4dedfobp/payment | 1 | 2148 ms | 2148 ms | 0 |
| PATCH /api/orders/ord-ms5q09ig-vclcmggggx/payment | 1 | 2094 ms | 2094 ms | 0 |
| PATCH /api/orders/ord-ms5q0i3t-3rv75gw2zu/payment | 1 | 2003 ms | 2003 ms | 0 |
| PATCH /api/orders/ord-ms5q0q5u-e4otldtanp/payment | 1 | 2059 ms | 2059 ms | 0 |
| PATCH /api/orders/ord-ms5q0y4l-qvmikaw93s/payment | 1 | 1861 ms | 1861 ms | 0 |
| PATCH /api/orders/ord-ms5q1695-qcxfmtuzsr/payment | 1 | 1986 ms | 1986 ms | 0 |
| PATCH /api/orders/ord-ms5q1e7q-1enk5ukxkw/payment | 1 | 6988 ms | 6988 ms | 0 |


## Integridad
- Registros huérfanos / sin sede / auditoría sin actor: ninguno
- Pedidos 'Pagado' con menos dinero del total: 0
- Sobrepagos silenciosos: 0
- Filtración entre sedes (manager SD viendo Principal): 0 pedidos
- Diferencias de inventario: ninguna (36 insumos exactos)
- Facturas sobreabonadas: 0

## Pedidos-evidencia (no son operación normal)
- `ord-ms5k7igt-uz0ogl9bl0` SIM Manipulador dia-1 · Cancelado · $0.01
- `ord-ms5kjnc6-wrdzxgwsrj` SIM Tasa Fabricada · Cancelado · $6.50
- `ord-ms5kjup2-njzumetpun` SIM Item Manual Staff · Cancelado · $3.33
- `ord-ms5kjk4o-8zimdvujsx` SIM Manipulador v2 · Cancelado · $9.50
- `ord-ms5kjr5s-bgv05rrsfl` SIM Cliente Honesto v2 · Cancelado · $6.50
- `ord-ms5o48n3-qamhpriqll` SIM Candado FIX A · Cancelado · $19.00
- `ord-ms5o13ee-pcwx8plyvq` SIM Candado Optimista · Cancelado · $19.00
- `ord-ms5o4gx0-9ttidhvpbv` SIM Candado FIX C · Cancelado · $9.50
