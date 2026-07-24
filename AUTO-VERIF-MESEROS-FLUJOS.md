# Auto-verificación — Meseros y flujos de completar pedidos

> "Lee AUTO-VERIF-MESEROS-FLUJOS.md y ejecútalo." Objetivo: que ningún pedido quede
> "a medias" ni con estado incoherente respecto a sus productos.
> Estados de orden: Nuevo → Preparando → Listo → Entregado (+ Cancelado).
> Dos marcados por ítem DISTINTOS: (a) confirmación de personal (staffConfirmation/
> requiresWaiterConfirmation) y (b) entrega por producto (delivered_at, migr. 0026).

## Pruebas (pasos → esperado → cómo comprobar)

1. **Entrega por producto SOLO en cuentas abiertas (P1 — fallo principal).** Crea un pedido local "Comer aquí" SIN cuenta abierta. En la pantalla del mesonero, ¿puede marcar productos entregados o marcar el pedido `Entregado`? HOY: no (la lista fuera de cuenta es solo lectura). Resultado: el pedido queda `Listo` indefinido dependiendo de caja. Verifica si ya hay forma de completar un pedido local sin cuenta; si no, es el gap operativo abierto.

2. **Sincronía estado ↔ ítems (P2).** (a) Marca TODOS los ítems entregados con el pedido en `Preparando`/`Nuevo`: ¿auto-avanza a `Entregado`? HOY solo auto-avanza si el estado ya era `Listo` (queda 3/3 entregados con estado ≠ Entregado). (b) "Reabrir" un pedido `Entregado→Listo`: ¿se des-marcan los `delivered_at`? HOY no (queda `Listo` con 3/3 entregados). Anota ambas incoherencias.

3. **Auto-cierre item-level.** Entrega el ÚLTIMO ítem de un pedido que está en `Listo`: debe pasar solo a `Entregado` (update condicionado a `.eq("status","Listo")`, seguro ante concurrencia). Verifica que funciona y no dispara desde otros estados.

4. **Flujo entre pantallas.** Cocina (`Preparando→Listo`, bloqueada si hay productos por confirmar del mesonero) → mesero/caja marca `Entregado`. Delivery solo REPORTA (`Entrega reportada`, estado sigue `Listo`) hasta que caja confirme `Entregado` (P3: si caja no confirma, queda entregado en la realidad pero `Listo` en el sistema, afectando cierre/reportes). Verifica el permiso de estado por rol (fuente única `orderStatusPermissions.ts`): kitchen solo Preparando/Listo; delivery no cambia status; waiter solo Listo/Entregado.

5. **Cocina bloqueada por confirmación del mesonero (P5).** Si el mesonero nunca confirma los productos que lo requieren, cocina no puede "Marcar listo" (pedido atascado en `Preparando`). Verifica si hay timeout/fallback; anota la dependencia cross-pantalla.

6. **Dos marcados confusos (P4).** Un producto puede estar `confirmed` (revisado) sin estar `delivered` (entregado) y viceversa. Verifica que la UI no los mezcla y que el conteo `x/y entregados` aparece donde el staff opera.

7. **Concurrencia / doble acción.** Lock optimista por estado (409 si otro usuario ya cambió) y anti-doble-acción por ítem. Simula dos PATCH del mismo estado: el segundo debe dar 409 y el polling resolverlo.

8. **Branch-scoping.** Todas las mutaciones de pedido/ítem acotan por `branch_id`; el lock optimista incluye sede. Verifica que un mesero de A no marca ítems de B.

## Veredicto
Marca P1 (completar pedido local sin cuenta) y P2 (estado↔ítems desincronizado) como los fallos principales; el resto son riesgos de operación.
