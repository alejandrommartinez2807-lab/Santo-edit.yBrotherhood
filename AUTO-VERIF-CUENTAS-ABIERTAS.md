# Auto-verificación — Cuentas abiertas (integridad del dinero)

> "Lee AUTO-VERIF-CUENTAS-ABIERTAS.md y ejecútalo." Prioridad: que el DINERO no descuadre.
> Tablas: `open_accounts` (estados Abierta/Cerrada/Cancelada, totales cacheados
> total_estimated_usd/total_collected_usd/pending_usd) + `orders.open_account_id`.

## Pruebas (pasos → esperado → cómo comprobar)

1. **Pedido cancelado NO infla la cuenta (fix R3).** En una cuenta con 2 pedidos, cancela uno. Esperado: al recalcular (cobrar/atar/cerrar), `total_estimated_usd` y `pending_usd` EXCLUYEN el cancelado; `closeIfPaid` puede auto-cerrar. Verifica `recomputeOpenAccountTotals` filtra `status !== 'Cancelado'`. Blind spot residual: el total cacheado se refresca en la SIGUIENTE acción de la cuenta (no al instante de cancelar) — confirmar que al cobrar queda correcto.

2. **Sin doble conteo en el camino feliz.** Pedido atado NO cobrado = pendiente, no ingreso. Al cobrar (payAccount o modal de caja) se registra el ingreso UNA vez y se recalculan los totales. Verifica que el mismo cobro no aparece en el cierre Y en la cuenta como dos ingresos.

3. **Reinicio de caja con cuentas abiertas (R2 — dinero perdido).** Antes de "reiniciar el día", si hay `open_accounts` en estado `Abierta`, debe AVISAR ("hay N cuentas abiertas sin cerrar"). Hoy el reinicio (`resetDayOrders` → DELETE /api/orders → clearOrdersInStore) borra TODOS los pedidos de la sede incluidos los atados a cuentas abiertas, dejándolas huérfanas. Verifica si ya hay guard/aviso; si no, es el fallo abierto más caro. Reproduce en dev: abre cuenta, atale pedido, corre el flujo de cierre y observa si avisa.

4. **Cerrar cuenta con saldo pendiente (R5).** `close` no exige saldo 0. Esperado deseado: avisar antes de cerrar con `pending_usd>0`. Verifica el comportamiento y si el pendiente queda registrado en los pedidos.

5. **Attach/close sin validar estado (R4).** Intenta (API) atar un pedido a una cuenta `Cerrada`/`Cancelada` y re-cerrar una `Cerrada`. Esperado deseado: rechazo. Hoy el store no valida (la UI sí). Anota si sigue permitiéndolo.

6. **Concurrencia en payAccount (R6).** Dos cobros simultáneos sobre la misma cuenta: `updateOrderPaymentInStore` hace SET desde snapshot (last-writer-wins), no incremento. Verifica que no hay doble cargo en BD, pero anota el riesgo de perder un cobro si difieren montos y la doble entrada de auditoría. Falta lock optimista en `close`.

7. **Aislamiento por sede.** Un cajero de sede B no ve/cobra/cierra cuentas de A (`resolveBranchId` clampa). QR público idempotente (reusa la cuenta abierta de la mesa). Verifica que abrir cuenta por QR en una mesa reservada respeta el bloqueo.

8. **Rol mesero.** Waiter puede abrir y atar pedidos; NO puede `payAccount` ni `close` (403). Verifica los 403 en `/api/open-accounts/[accountId]`.

## Veredicto
Reporta cualquier escenario donde el dinero pueda: contarse doble, perderse (cuentas huérfanas), o descuadrar (cancelados). Marca R2 como el pendiente más importante si sigue sin aviso.
