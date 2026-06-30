# Fase 1 — Núcleo del POS sobre Supabase

Esta fase mueve **pedidos, pagos y cuentas abiertas** de Google Sheets a Supabase.
El resto (menú, inventario, cierres, gastos, comprobantes, configuración y zonas
de delivery) **sigue funcionando con Google Sheets** hasta sus fases. Es un híbrido
intencional y seguro: por eso `GOOGLE_SHEETS_WEB_APP_URL` debe seguir en `.env.local`.

## 1. Aplica la migración nueva (obligatorio)

En el **SQL Editor** de Supabase corre:

```
supabase/migrations/0003_orders_seq.sql
```

Añade la numeración correlativa de pedidos (`seq`), que la UI usa para mostrar
el número de pedido (#01, #02…). Sin esto, crear pedidos fallará.

> Las `0001` y `0002` ya las aplicaste. Solo falta la `0003`.

## 2. Probar en local

```
npm run dev
```

Luego prueba el ciclo completo:
1. **Cocina/Caja**: crea un pedido nuevo → debe aparecer al instante con su número.
2. **Caja**: registra un cobro (parcial y total) → el estado debe pasar a
   *Pago parcial* / *Pagado* y el pendiente recalcularse solo.
3. **Cuentas abiertas**: abre una cuenta en una mesa, asóciale un pedido y ciérrala.
   - Intenta abrir DOS cuentas en la misma mesa: la segunda debe rechazarse
     ("Esta mesa ya tiene una cuenta abierta activa").
4. **Confirmación de personal**: en un ítem que la requiera, confirma y reabre.
5. **Eliminar / reiniciar pedidos** desde el panel.

## Qué cambió en el código

- `src/lib/supabaseServer.ts` — cliente de Supabase para el servidor (service role).
- `src/lib/ordersStore.ts` — **nuevo backend** de pedidos/pagos/cuentas. Aquí vive
  la lógica que antes corría en Google (numeración, estado de pago, confirmación
  de personal, totales de cuenta).
- `src/lib/appsScriptOrders.ts` — las 13 funciones del núcleo ahora delegan en
  `ordersStore`. **Mismos nombres y firmas**, así las API routes y los 20 paneles
  no se tocaron.

## Notas importantes

- **Los pedidos históricos que tenías en Google Sheets NO aparecen** en Supabase:
  empezamos limpio en la base nueva. Si quieres migrar el histórico, lo hacemos
  como paso aparte (no suele hacer falta en un POS: los pedidos del día se reinician).
- El **realtime** (que cocina/caja se actualicen solas sin recargar) lo activo como
  paso 2 de esta fase una vez confirmes que el ciclo básico guarda bien. Lo dejé
  para después de validar el guardado, que es lo crítico.
