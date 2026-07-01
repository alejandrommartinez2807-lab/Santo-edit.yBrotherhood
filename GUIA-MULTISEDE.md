# Guía completa: cómo funciona el multi‑sede (sucursales)

Esta guía explica **cómo se separan los datos por sucursal**, qué es compartido y qué
es independiente, y **cómo preparar cada sede** (inventario, cocina, menú, caja, etc.)
cuando tienes más de un local.

> Resumen en una frase: **una sola cuenta del negocio, pero cada sucursal tiene su
> propia operación.** El sistema separa la información con una etiqueta interna
> (`branch_id`) en cada registro. Tú eliges la sede en el panel y todo lo que ves y
> guardas queda dentro de esa sede.

---

## 1. El concepto clave: la sede "activa"

Arriba en el **Panel de pedidos** aparece el banner **"Estás viendo la sede…"**.
Ese selector define la **sede activa** de tu navegador. A partir de ahí:

- Todo lo que **veas** (pedidos, inventario, caja, reportes) es **solo de esa sede**.
- Todo lo que **guardes** (un pedido nuevo, un insumo, una compra) se guarda **en esa sede**.
- Si cambias la sede en el banner, la página se recarga y verás la otra operación.

La sede elegida se recuerda en tu navegador y se envía automáticamente en cada
operación (cabecera `x-branch-id`). No hay que hacer nada manual.

### ¿Quién puede cambiar de sede?

- **Dueño / Soporte:** ven y cambian entre **todas** las sedes.
- **Personal asignado a sedes** (encargado, caja, mesonero, cocina, delivery): solo
  ven y operan en **las sedes que tienen asignadas**. Aunque manipulen el selector,
  el sistema los "amarra" a su sede permitida (nunca leen ni escriben en otra).

---

## 2. Qué es **independiente por sede** y qué es **compartido**

### 🔵 Independiente por sede (cada sucursal tiene lo suyo)

Estos módulos guardan y leen datos **filtrados por la sede activa**. Sede A y Sede B
no se mezclan:

| Módulo | Qué se separa por sede |
|---|---|
| **Pedidos** | Cada sede tiene su propia lista de pedidos, estados y números. |
| **Inventario e insumos** | Stock, unidades y **movimientos** son propios de cada sede. |
| **Recetas de inventario** | El descuento de stock por producto se calcula con el inventario de esa sede. |
| **Productos del menú** | Cada sede tiene su propio menú (precios/disponibilidad pueden variar). |
| **Proveedores** | La lista de proveedores es por sede. |
| **Compras a proveedores** | Compras, pagos y vencimientos por sede. |
| **Cuentas abiertas / mesas** | Las cuentas y las mesas son de cada sede. |
| **Comprobantes de pago** | Se revisan dentro de la sede que los recibió. |
| **Gastos del día** | Cada sede lleva sus gastos. |
| **Cierres de caja** | El cierre es por sede (cada caja cuadra por separado). |
| **Zonas de delivery** | Cada sede define sus zonas y costos. |
| **Cocina** | La pantalla de cocina muestra **solo los pedidos de esa sede**. |

### 🟢 Compartido para todo el negocio (una sola vez)

Estos ajustes son **globales**: se configuran una vez y aplican a **todas** las sedes:

- **Módulos activados/desactivados** (Configuración → módulos). Si activas "Compras",
  se activa para el negocio completo.
- **Plan** contratado y sus límites.
- **Promociones, productos destacados y nombre del negocio.**
- **Personal (staff):** la lista de usuarios existe a nivel negocio; lo que se define
  por sede es **a qué sedes tiene acceso** cada persona.

### 🟡 Configuración pública **por sede** (sección Sucursales)

Además del menú/inventario, cada sede puede tener su propia **ficha pública**:

- Nombre público de la sede, dirección y zona.
- Tiempo estimado de entrega.
- WhatsApp principal y de delivery.
- Pausar pedidos / cierre temporal (solo esa sede).
- **Mesas del local** (lista de mesas de esa sede).

Esto se edita en **Local → Sucursales → (elegir sede) → Configuración de la sede**.
Ahí también puedes **copiar la configuración de otra sede** para no empezar de cero.

---

## 3. Cómo **preparar una sede nueva** (paso a paso)

Cuando creas una segunda sucursal, empieza **vacía**: no hereda automáticamente el
inventario ni el menú de la otra. Prepárala así:

1. **Crear la sede**
   Local → Sucursales → *Agregar sucursal* → ponle nombre → Guardar.

2. **Configurar su ficha pública** (opcional pero recomendado)
   En Sucursales elige la sede → *Configuración de la sede* → nombre público,
   dirección, WhatsApp, tiempo estimado, **mesas**.
   Truco: usa **"Copiar configuración de otra sede"** si es parecida.

3. **Seleccionar la sede en el banner del panel de pedidos**
   Vuelve al Panel → en el banner **"Estás viendo la sede"** elige la sede nueva.
   ⚠️ **Todo lo que hagas a partir de aquí se guarda en esa sede.** Verifica siempre
   que el banner muestre la sede correcta antes de cargar datos.

4. **Cargar el menú de esa sede**
   Menú / Menú avanzado → crea o ajusta los productos. Recuerda: el menú es por sede.

5. **Cargar el inventario e insumos de esa sede**
   Inventario básico → agrega insumos, unidades y stock inicial.
   Si usas recetas (descuento de stock), configúralas también aquí.

6. **Proveedores y compras** (si usas esos módulos)
   Proveedores → agrega los de esta sede. Luego Compras registra entradas/pagos.

7. **Zonas de delivery, mesas y caja**
   Delivery → zonas y costos de esta sede. Caja/cierres funcionarán por separado.

8. **Asignar al personal de esa sede**
   Usuarios → edita cada persona → asígnale la(s) sede(s) donde trabaja.
   El dueño y soporte no necesitan asignación (ven todo).

---

## 4. Errores frecuentes y cómo evitarlos

- **"No veo mi inventario / menú / pedidos después de crear sucursales."**
  Los datos creados **antes** de tener sucursales pueden haber quedado **sin sede**
  (`branch_id` vacío). Al activar el multi‑sede, cada pantalla se filtra por la sede
  activa, así que esos registros "sin sede" no aparecen.
  **Solución:** vuelve a crear/asignar esos datos con la sede correcta seleccionada en
  el banner, o pide que se migren asignándoles la sede que corresponda.

- **"Cargué todo pero apareció en la sede equivocada."**
  Casi siempre es porque el banner tenía otra sede activa. **Revisa siempre el banner**
  antes de cargar inventario, menú o pedidos.

- **"Activé un módulo pero no lo veo en la otra sede."**
  Los módulos se activan **para todo el negocio**, no por sede. Si no aparece, revisa
  el rol del usuario y que su plan lo incluya.

- **"Un cajero ve pedidos de otra sede."**
  No debería. Verifica en Usuarios que tenga asignada **solo** su sede. Owner/soporte
  sí ven todas por diseño.

---

## 5. Cómo comprobar rápido que una sede está "bien conectada"

1. Selecciona la sede en el banner del panel.
2. Crea un **pedido de prueba** → debe aparecer solo en esa sede.
3. Cambia a la otra sede en el banner → ese pedido **no** debe aparecer.
4. Repite con un **insumo de inventario** y un **producto del menú**.
5. Entra a **Reportes** y usa "Comparación por sucursal": cada sede debe mostrar sus
   propios totales.

Si en los 5 pasos cada sede muestra **solo lo suyo**, la separación está correcta.

---

## 6. Referencia técnica (para el equipo de desarrollo)

- La sede activa viaja en la cabecera `x-branch-id` (la adjunta `AuthBridge` desde la
  sede elegida en `branchClient`).
- En el backend, cada ruta privada resuelve la sede con `resolveBranchId(request)`
  (`src/lib/branch.ts`) y **filtra/estampa** `branch_id` en cada consulta del store.
- El personal restringido se "clampa" a sus `allowedBranchIds`; owner/support pasan
  sin restricción.
- La configuración pública por sede vive en `businessConfig.branchConfigs[branchId]`
  y se edita vía `PATCH /api/branches/[id]/config` (con opción `copyFromBranchId`).
- Los módulos on/off viven en el `businessConfig` **global** (no por sede).

---

*Última actualización de esta guía: preparación multi‑sede con 2 sucursales activas.*
