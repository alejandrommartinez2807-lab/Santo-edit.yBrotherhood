# Auto-verificación — Aislamiento por sede (multi-sede)

> Pega esto en una sesión nueva (o di: "lee AUTO-VERIF-MULTISEDE.md y ejecútalo").
> Objetivo: probar que NADA de una sede se cuenta, lee o edita en otra. Sedes:
> San Diego `3d8a8527-4b0b-4c81-aeb7-0c69454c63f6`, Viñedo `04fb974d-bd2d-4086-ae9e-c74653309b04`.
> BD por `.env.local` (service key para lecturas de verificación; NUNCA escribir en prod sin avisar).

## Cómo verificar (patrón)
- Lecturas de BD: script Node con `@supabase/supabase-js` + service key (solo SELECT/COUNT).
- APIs: `curl` con header `x-branch-id: <sede>` (y `x-staff-role`/`x-staff-branch-ids` si aplica). Ojo: en prod el middleware `src/proxy.ts` borra/reemite esos headers desde el Bearer; para pruebas server-side usar la BD directa.

## Pruebas (cada una: pasos → esperado → cómo comprobar)

1. **Toda tabla operativa tiene branch_id y filtra.** Recorre `orders, order_items(vía order), open_accounts, inventory_items, inventory_movements, day_closes, day_expenses, payment_proofs, reservations, suppliers, supplier_purchases, subrecipes, delivery_zones, menu_products`. Esperado: cada consulta de la API con `x-branch-id=A` NO devuelve filas de B. Blind spot: `order_items` NO tiene branch_id (depende de que los order_id vengan ya filtrados) — revisa cualquier endpoint nuevo que consulte order_items sin acotar por sede antes.

2. **Correlativo de pedido por sede.** Crea (o inspecciona) pedidos en ambas sedes; `branch_seq` debe ser independiente por sede y `branch_code` = inicial de la sede. Comprueba `order_branch_counters` (una fila por sede). Esperado: numeración no compartida.

3. **Índice de cuenta abierta por sede (fix 0033).** Verifica que existe `uq_open_account_per_table_branch on open_accounts (branch_id, table_number) where status='Abierta'` y que NO existe el viejo `uq_open_account_per_table`. Prueba conceptual: dos sedes con "Mesa 1" pueden tener cada una su cuenta abierta. `SELECT indexname,indexdef FROM pg_indexes WHERE tablename='open_accounts'`.

4. **Reportes por sede vs consolidado.** `GET /api/reports` con `x-branch-id=A` suma solo A. Con `?scope=all` (owner) suma ambas — HOY sin desglose por sede (blind spot R1: no distingue cuánto aportó cada sede en el consolidado). Verifica que los totales por sede SUMAN al consolidado (A+B == all) y anota si falta el `byBranch`.

5. **Historial de cierres etiquetado.** Cada fila de `day_closes` tiene su `branch_id`; el consolidado conserva la etiqueta. Esperado: ningún cierre de A aparece bajo B.

6. **deleteDayExpense con guard de sede (fix R4).** `DELETE /api/day-expenses?id=<gasto de A>` con contexto de sede B NO borra. Verifica que el store ahora acota por `branch_id`.

7. **business_config global vs override por sede.** Confirma: los toggles de módulos/plan son globales (fila única id=1); overrides por sede viven en `config.branchConfigs[branchId]` (textos, WhatsApp, mesas, tasa). Cambiar un override de A no afecta B.

8. **menu_products PK global (blind spot R2).** Confirma que `menu_products.id` es PK global (no compuesta con branch_id). Riesgo: un upsert con id repetido entre sedes reasigna el producto. Verifica que los ids nuevos usan timestamp y que no hay ids duplicados entre sedes: `SELECT id, count(distinct branch_id) FROM menu_products GROUP BY id HAVING count(distinct branch_id)>1`.

## Veredicto
Reporta: tablas OK / con hueco, si el índice 0033 está aplicado, si reportes suman sin mezclar, y cualquier endpoint que traiga datos sin filtrar por sede.
