# Plataforma de Pedidos & POS para Restaurantes

Sistema completo de menú digital, pedidos y panel de gestión para restaurantes,
pensado como **plantilla re-marcable** (servicio llave en mano): se monta y
personaliza una instancia por cliente.

## Qué incluye

- **Menú público** con personalización de productos (incluidos + adicionales con costo).
- **Pedidos** desde mesa (QR), para llevar y delivery.
- **Cuentas abiertas por mesa** abiertas escaneando el QR.
- **Imagen adjunta al pedido** (llega a Caja y al panel de Pedidos).
- **Paneles por rol**: caja, cocina, delivery, mesonero, dueño, inventario,
  cierres de caja, gastos, comprobantes, configuración, soporte, proveedores, compras
  y cuentas por pagar.
- **Doble moneda** (USD / Bs) con tasa automática o manual.
- **Reportes 2e**: ventas, compras, cuentas por pagar, vencimientos, stock bajo y margen aproximado por recetas.

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript + Tailwind 4.
- **Supabase** (Postgres + Storage) como backend único.
- **Vitest** para tests.

## Puesta en marcha rápida

```bash
npm install
cp .env.example .env.local      # rellena las claves de Supabase + contraseñas
# Aplica las migraciones de supabase/migrations/ en el SQL Editor de Supabase
npm run dev
```

Guía completa para montar un cliente nuevo: **[CHECKLIST-CLIENTE-NUEVO.md](./CHECKLIST-CLIENTE-NUEVO.md)**.

## Scripts

| Comando | Para qué |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm test` | Tests (Vitest) |
| `node scripts/rebrand-colors.mjs` | Re-marca los colores (edita `brand-colors.json`) |
| `node scripts/seed-demo.mjs` | Carga menú/mesas demo |
| `/local-santo/usuarios` | Crea usuarios internos por nombre de usuario, clave, rol, sedes y módulos |
| `npm run e2e:reports-2e` | Verifica que `/api/reports` entregue ventas, proveedores, márgenes y alertas |
| `npm run e2e:business-complexity` | Verifica perfiles Simple/Avanzado y permisos públicos del carrito |
| `npm run e2e:purchase-inventory` | Prueba real Compra → Inventario contra Supabase local/dev |
| `npm run e2e:supplier-payables` | Prueba real de cuentas por pagar, abonos parciales y vencimientos |

## White-label (re-marcar un cliente)

1. **Textos / contacto**: `src/lib/brand.ts`.
2. **Logo**: archivo en `public/` + `BRAND.logoUrl`.
3. **Colores**: edita `brand-colors.json` y corre `node scripts/rebrand-colors.mjs`.

## Autenticación

Dos modos (compatibles entre sí):

- **Usuarios internos por nombre de usuario** (recomendado): el dueño administra el personal en `/local-santo/usuarios` con usuario, clave, nombre visible, rol, sedes permitidas y módulos permitidos. La pantalla `/acceso` acepta usuario simple (`maria`) y también conserva compatibilidad con correos existentes.
- **Supabase Auth** sigue funcionando por debajo cuando existe; para usuarios sin correo visible se usa un correo interno técnico tipo `maria@santo.local`.
- **Contraseñas por rol** en `.env.local` (`ORDERS_*_PASSWORD`): modo simple/compatible mientras se migra.

## Base de datos

Las migraciones SQL están en `supabase/migrations/` (numeradas). Aplícalas en orden
en el **SQL Editor** de Supabase. Buckets de Storage públicos necesarios:
`menu-images`, `payment-proofs`, `order-attachments`.

## Despliegue

Vercel. Carga todas las variables de `.env.local` en el proyecto de Vercel.
Detalles en el checklist.

## Tests

```bash
npm test          # una pasada
npm run test:watch
```

Cubren la lógica crítica de dinero (totales, pagos, combos, doble moneda) y de pedidos.


## Soporte y verificación

El panel `/local-santo/soporte` revisa el estado operativo sin mostrar secretos:
variables críticas, módulos del plan, conexión a Supabase, buckets públicos, productos, inventario, proveedores, compras, cuentas por pagar, comprobantes, cuentas abiertas, cierres y gastos.

Buckets públicos esperados en Supabase Storage:

- `menu-images`
- `payment-proofs`
- `order-attachments`

Para cerrar las pruebas de proveedores, inicia `npm run dev` y en otra terminal ejecuta `npm run e2e:purchase-inventory` y `npm run e2e:supplier-payables`.


## Cuentas por pagar de proveedores

Las compras a proveedores pueden quedar pendientes, parciales o pagadas. Cada compra acepta fecha de vencimiento, pago inicial, abonos parciales e historial de pagos. Si la compra también suma inventario, ese movimiento sigue siendo aditivo: editar o borrar la compra no descuenta stock automáticamente. Para corregir inventario se usa un ajuste desde Inventario.

Migración requerida: `supabase/migrations/0014_supplier_payables.sql`.

## Reportes 2e

El panel `/local-santo/reportes` combina ventas, compras del período, cuentas por pagar a proveedores, vencimientos, últimos abonos, stock bajo y margen aproximado por producto usando recetas de inventario. El margen es una estimación operativa: depende de que los productos tengan receta activa y que cada insumo tenga `equivalentCostUSD` o `costUSD` actualizado.

## Fase 2f — Complejidad configurable por el dueño

La pantalla `/local-santo/configuracion` incluye perfiles de complejidad:

- **Simple**: menos acciones públicas, ideal para venta rápida o catálogo con retiro.
- **Estándar**: balance recomendado para caja, cocina, delivery, cuentas y comprobantes.
- **Avanzado**: más controles para negocios con mesas, personal, cuentas abiertas y reportes.
- **Personalizado**: se activa automáticamente cuando el dueño ajusta un permiso manualmente.

Desde esa sección el dueño controla qué puede hacer el cliente: pedir en la página pública, comer aquí, para llevar, delivery, abrir/usar cuenta de mesa, subir comprobante, elegir ingredientes/adicionales, escribir notas, adjuntar imágenes y si el teléfono es obligatorio. También deja preparados controles internos para cancelaciones, reapertura de pagos, revisión de cierre, inventario automático y reportes avanzados.

Migración recomendada: `supabase/migrations/0015_business_complexity_controls.sql`.
Prueba E2E: `npm run e2e:business-complexity` con `npm run dev` activo.
