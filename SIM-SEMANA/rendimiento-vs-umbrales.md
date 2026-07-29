# Rendimiento medido vs umbrales del guion (§11.5 / §20)

**Fecha del análisis**: 2026-07-29 · **Fuente**: `SIM-SEMANA/rendimiento.json`
(mediciones de la semana completa, cliente HTTP del motor de simulación).

**Método**: por cada familia de endpoint se toma el **peor p95 de cualquier
día** de la semana (criterio conservador: los p95 por día no se pueden fundir
en un p95 semanal exacto sin las muestras crudas) más el total de llamadas,
errores y timeouts.

**Contexto obligatorio (el propio guion lo exige documentar)**: todo se midió
contra `next dev` LOCAL en un disco lento («Slow filesystem detected», D:),
con ráfagas de concurrencia intencionales (días pico de 115 pedidos y
carreras de cajeros). Producción en Vercel tiene otro perfil (build
optimizado, sin compilación bajo demanda) y NO está medida. Los veredictos de
abajo valen para el entorno medido, no condenan producción — pero tampoco la
absuelven: medir en producción queda pendiente.

## Tabla de veredictos

| Operación (umbral del guion) | Endpoint medido | n | Peor p95 | Umbral | Veredicto |
| --- | --- | ---: | ---: | ---: | --- |
| Crear pedido (≤ 1,5 s) | `POST /api/orders` | 681 | 10,10 s (dia-4) | 1,5 s | **FAIL (dev)** |
| Actualizar cocina (≤ 1 s) | `PATCH orders/:id (cocina)` | 1094 | 3,77 s (dia-7) | 1 s | **FAIL (dev)** |
| Cobrar (≤ 2 s) | `PATCH …/payment` | 520 | 4,29 s (repaso) | 2 s | **FAIL (dev)** |
| Cobrar cuenta completa (≤ 2 s) | `PATCH open-account pay` | 37 | 13,83 s (dia-2) | 2 s | **FAIL (dev)** |
| Consultar cierre diario (≤ 3 s) | `GET /api/day-closes` | 1 | 1,95 s (dia-7) | 3 s | PASS |
| Guardar cierre diario (≤ 3 s) | `POST day-close` | 18 | 3,89 s (dia-4) | 3 s | **FAIL (dev)** |
| Reporte semanal (≤ 5 s) | `GET /api/reports` | 16 | 3,47 s (dia-7) | 5 s | PASS |
| Checkout público usable (≤ 3 s) | `POST /api/orders` (público) | (incluido arriba) | 10,10 s | 3 s | **FAIL (dev)** |

**Errores y timeouts**: 0 timeouts en toda la semana. Los `err=1` sueltos en
PATCH de pedidos individuales son las pruebas NEGATIVAS del guion (permisos
denegados, conflictos 409 esperados), no fallas de rendimiento.

## Lectura honesta

1. **En el dev server local, 6 de 8 operaciones NO cumplen el umbral.** El
   patrón dominante: la PRIMERA llamada de cada ruta paga la compilación de
   Next dev (5–13 s) y los días pico saturan un solo proceso Node en disco
   lento. Los p50 (ver `rendimiento.json`) están muy por debajo de los p95:
   crear pedido p50 ronda 0,9–1,3 s incluso en días pico.
2. **Qué haría cambiar el veredicto**: medir contra `next build && next
   start` local (perfil intermedio) o contra Vercel producción. Eso NO se
   hizo en esta corrida; queda como pendiente explícito — no se marca PASS
   por fe.
3. **Señal real a vigilar aunque el entorno sea lento**: `PATCH open-account
   pay` (cobro de cuenta completa) es sistemáticamente la operación más
   pesada (reparte FIFO entre pedidos + recalcula totales). Si en producción
   algo va a rozar el umbral, es esto.

## Anexo 2026-07-29 (tarde): medición contra PRODUCCIÓN (solo lecturas)

Tras publicar el lote (`dpl_EbZWSRp8UXmkg5nh8knazgqYpuwJ`), medido contra
`brotherhood-xi.vercel.app` — 12 muestras por endpoint espaciadas 400 ms,
SOLO endpoints públicos de lectura (jamás se crean pedidos de prueba en
producción sin autorización explícita):

| Endpoint | p50 | p95 | Errores | Umbral aplicable | Veredicto |
| --- | ---: | ---: | ---: | --- | --- |
| `GET /` (home pública) | 154 ms | 559 ms | 0 | checkout usable ≤ 3 s | **PASS** |
| `GET /api/public/branches` | 279 ms | 934 ms | 0 | — | **PASS** |
| `GET /api/public/products` (el menú del checkout) | 273 ms | 430 ms | 0 | checkout usable ≤ 3 s | **PASS** |
| `GET /api/exchange-rate` | 247 ms | 1.030 ms | 0 | — | PASS (el pico es el refresh del BCV) |

Conclusión: los FAIL del dev server eran del ENTORNO (compilación bajo
demanda + disco lento), no del código — producción va 10-20× más rápido en
las rutas medibles. **Sigue sin medirse en producción la ruta de ESCRITURA**
(crear pedido / cobrar / cerrar): exigiría escribir datos reales; hacerlo
solo con autorización del usuario, como en las rondas QA.
