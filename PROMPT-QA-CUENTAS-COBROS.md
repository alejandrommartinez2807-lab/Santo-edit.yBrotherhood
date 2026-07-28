# Auto-prompt — QA de CUENTAS ABIERTAS + MÉTODOS DE COBRO + CAJA/COCINA/MESONERO

> Pega este archivo completo como primer mensaje de una sesión nueva cuando quieras
> repetir estas pruebas. Escrito el 2026-07-28. Objetivo: **probar el sistema usándolo**,
> con dinero y pedidos reales, no leyendo el código.

## Contexto

Repo `D:\Santo edit`, rama `brotherhood-publico`. `.env.local` apunta al Supabase REAL de
Brotherhood (el mismo de brotherhood-xi.vercel.app). El dueño ya autorizó crear datos de
prueba; el sistema está en fase de pruebas. Sedes: San Diego `3d8a8527-…` y Viñedo `04fb974d-…`.

## Protocolo (en este orden)

1. **`npm run backup`** antes de la primera escritura. Anota la ruta del JSON.
2. **⚠️ REINICIA el dev server ANTES de correr nada** (lección del 2026-07-28): un
   `next dev` que lleva días corriendo a través de commits responde **500 con cuerpo
   vacío** en las rutas dinámicas (`PATCH /api/orders/[id]`, `[accountId]`, etc.) y
   fabrica fallas fantasma — ese día salieron 18 "fallas" que eran solo el server viejo.
   Receta: matar el proceso del puerto 3177 → `npx next dev -p 3177` → forzar el primer
   compile con `Invoke-WebRequest -TimeoutSec 480` a la raíz. Si aun fresco persisten
   500s vacíos, borrar `.next` y volver a arrancar.
   **Regla de oro: un 500 con `json: null` es el server, no el código. Un 500 con
   `{error: …}` sí es del código.**
3. Corre la batería en serie (comparten el freno de 10 pedidos/min):
   - `npm run qa:open-accounts` — ataque a cuentas abiertas (43 checks)
   - `npm run qa:payments` — lote de pagos/comprobantes (28)
   - `npm run qa:day-close` — cierre del día real con restauración (21)
   - `npm run qa:branches` — sedes, QR, correlativos, historial (16)
   - `npm run qa:metodos-cobro` — **métodos de cobro uno a uno + cuenta abierta
     completa (cocina → entregado por producto → cobro FIFO) + desglose por método
     en el cierre y en el historial** (~35)
   - `npm run qa:dia-completo` — **un día entero de operación** (40): insumos nuevos +
     recetas, ventas que descuentan inventario (incl. decimales), rush que deja un
     insumo bajo mínimo, compra a proveedor a mitad del día (movimiento "Compra" +
     abono parcial), anulación que devuelve stock, pedido pendiente con comprobante,
     gasto, cierre real al centavo con desglose, historial/consolidado/auditoría y
     restauración total. Ojo: `POST /api/orders` exige `tableNumber` aunque sea
     "Para llevar" (400 «Falta la mesa o ubicación» si va vacío).
4. `npx tsc --noEmit` + `npx vitest run` + `npm run lint` como línea base de código.

## Qué cubre `qa:metodos-cobro` (scripts/qa-metodos-cobro-cierre.mjs)

- **M1**: un pedido cobrado por CADA método del catálogo (`src/lib/paymentOptions.ts`):
  Efectivo divisas, Zelle, Binance, USDT, Transferencia internacional / Pago móvil,
  Punto, Transferencia, Efectivo Bs, Biopago + mixto en caja + pago parcial +
  variantes mal escritas ("zelle ", "PAGOMOVIL", inventadas → deben normalizar a la
  etiqueta canónica o a "Otro", nunca crear métodos nuevos).
- **M2**: ciclo completo de cuenta abierta: abrir → 2 pedidos asociados (por
  `openAccountId` y por `attachToTableOpenAccount`) → cocina (`Preparando` estampa
  `kitchen_started_at`, `Listo`) → marcar/desmarcar productos entregados uno a uno
  (`setItemDelivered` → `order_items.delivered_at/by`) → `Entregado` desde la cuenta
  estampa todos los productos → cobro FIFO en dos tandas con métodos distintos →
  cierre automático con `closeIfPaid` → propagación a `orders.open_account_status`.
- **M3**: cierre del día con `paymentByUSDMethod`/`paymentByVESMethod` y verificación
  de que el desglose sobrevive en `day_closes.data` Y en `GET /api/day-closes` (el
  historial), método por método y al centavo. Si llega vacío: la compuerta
  `canIncludeCashierAudit` (módulo caja del plan) lo está filtrando —
  `src/app/api/day-close/route.ts:379-384`.

## Fallas CONOCIDAS que van a salir (no las reportes como nuevas)

- `qa:open-accounts` A3: staff que escribe la nota puede fingir "cuenta pedida" (B-2, riesgo bajo, decisión pendiente).
- `qa:branches` S1: ninguna sede tiene WhatsApp configurado (C-1, configuración del dueño, no código).
- ~~`qa:payments` P3~~: **ARREGLADA 2026-07-28** — la regla de los 6 dígitos ya vive
  también en el servidor (`payment-proofs/route.ts` usa `MIN_REFERENCE_DIGITS`);
  el check ahora debe salir en verde.

## Reglas que no se negocian

- Las migraciones las aplica el usuario. No borres ni vacíes `.vercelignore`. No toques
  los 62 productos del menú real (crea `ZZTEST-…` y bórralos al final).
- Prefijo `ZZTEST-` en todo lo creado; cada script limpia y verifica su limpieza.
- El navegador in-app se cuelga: pruebas por scripts Node contra la API, no por UI.
- Al terminar: informe con números (ids, montos antes→después), 0 filas ZZTEST,
  y commit de los scripts/arreglos por fases.
