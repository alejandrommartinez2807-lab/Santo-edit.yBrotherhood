# Resumen final — semana real simulada de Brotherhood

**Entorno**: proyecto Supabase de PRUEBA `gnyvdlxlrjwbsdctincy` (producción
jamás tocada; el guard verificó identidad de base en cada corrida).
**Run**: brotherhood-week-v1 · zona horaria America/Caracas.

## Lo que se ejecutó

| Concepto | Cantidad |
| --- | ---: |
| Días comerciales simulados | 7 (+ Día 0 de fundación) |
| Pedidos del guion ejecutados | 573 |
| Pedidos en la base al final | 672 |
| Dinero cobrado (libro esperado) | $6308.00 |
| Cierres comerciales | 16 |
| Registros de auditoría | 2555 |
| Usuarios reales del elenco | 17 |
| Insumos con stock propio por sede | 36 |
| Comprobaciones con evidencia | 230 PASS · 17 FAIL · 3 BLOCKED |

## Estrategia del "día comercial" (regla de honestidad temporal)

La base estampa `created_at = now()` real: los 7 días simulados caen en la
misma fecha de calendario. En vez de falsear timestamps (prohibido por el
Prompt Maestro §9), el **día comercial lo marcan los CIERRES de caja por
sede**: cada día simulado termina con su `day-close` y la contabilidad se
valida contra el cierre y contra el libro esperado, no contra la fecha. Esto
quedó documentado en `SIM-SEMANA/config.json` antes del Día 1.

## Bugs encontrados y corregidos

Ver `SIM-SEMANA/bugs.md`. Los dos son CRÍTICOS y nacieron del mismo hueco:
el endpoint público confiaba en datos del navegador.

1. **BH-SIM-001** — el cliente fabricaba su precio ($9.50 → $0.01). Corregido:
   el servidor re-precia desde el menú real de la sede.
2. **BH-SIM-002** — el cliente fabricaba la tasa de cambio (pagar Bs a tasa 4
   en vez de 40). Corregido: la tasa manual del negocio pisa la del cliente.

Ambos con test de regresión (`src/lib/__tests__/publicOrderGuards.test.ts`,
12 casos) y verificación empírica contra el servidor.

## Documentos de la corrida

- `SIM-SEMANA/dia-0.md` … `dia-7.md` — bitácora por día con cada check.
- `SIM-SEMANA/reconciliacion-final.md` — tabla semanal libro vs sistema.
- `SIM-SEMANA/contabilidad-esperada.json` — libro contable independiente.
- `SIM-SEMANA/inventario-esperado.json` — inventario teórico por insumo/sede.
- `SIM-SEMANA/seguridad.md`, `concurrencia.md`, `rendimiento.json`.
- `SIM-SEMANA/bugs.md`, `pendientes.md`.
- `SIM-SEMANA/estado.json` — checkpoint reanudable (IDs, cuotas, días hechos).

## Reproducibilidad

```bash
node scripts/sim/check-guard.mjs        # guard (debe salir en verde)
node scripts/sim/dia-0.mjs --seed=brotherhood-week-v1
node scripts/sim/dia-1.mjs
node scripts/sim/dia-1-repaso.mjs
node scripts/sim/dias-2-7.mjs           # o --day=N
node scripts/sim/reconciliacion-final.mjs
node scripts/sim/informes.mjs
```
