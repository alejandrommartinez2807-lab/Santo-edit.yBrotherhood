# Traspaso técnico — POS multi-sede (Santo Perrito / Brotherhood)

Documento para un **segundo desarrollador o un comprador**: qué es, cómo está armado, cómo correrlo, cómo desplegarlo, cómo sumar un cliente nuevo y qué riesgos/roadmap quedan. Pensado para que alguien que nunca vio el proyecto sea productivo en un día.

> Guías complementarias en la raíz: [`GUIA-DEL-SISTEMA.md`](../GUIA-DEL-SISTEMA.md) (uso del sistema), [`GUIA-MULTISEDE.md`](../GUIA-MULTISEDE.md) (multi-sucursal), [`CHECKLIST-CLIENTE-NUEVO.md`](../CHECKLIST-CLIENTE-NUEVO.md) (alta de cliente), [`docs/separacion-brotherhood-santo-perrito.md`](separacion-brotherhood-santo-perrito.md).

---

## 1. Qué es

POS (punto de venta) web para restaurantes en Venezuela, **multi-sucursal** y **white-label**. Cubre menú público con QR por mesa, pedidos (comer aquí / pick up / delivery), caja con cobros en **USD y Bs** (pago móvil, Zelle, Binance, mixto), cocina, inventario con recetas, proveedores/compras/cuentas por pagar, cierres de caja, reportes, reservas, auditoría, y fiscal venezolano (**IVA + IGTF**, tasa BCV).

Se opera como **una sola base de código** que se despliega como **marcas distintas** (Santo Perrito, Brotherhood, y demos), cada una en su propio proyecto de Vercel + Supabase.

## 2. Stack

| Capa | Tecnología |
|---|---|
| Framework | **Next.js 16** (App Router, React 19, Server Components + rutas API) |
| Lenguaje | **TypeScript** (estricto) |
| Estilos | **Tailwind CSS** con variables de marca (`--brand-*`) |
| Datos/Auth/Storage | **Supabase** (Postgres + Auth + Storage) |
| Pagos online (opcional) | **Stripe** (`/api/payments/*`) |
| Monitoreo | **Sentry** (opcional, por env) |
| Tests | **Vitest** (~349 tests, incluye *fitness guards* de arquitectura) |
| Lint | **ESLint** |
| Hosting | **Vercel** (un proyecto por marca) |

## 3. Mapa del repositorio

```
src/
  app/                 Rutas (App Router)
    (público)          /  ·  /pedidos (panel staff)  ·  /mesa/[mesa]  ·  /pedido/[orderId]
    local-santo/       Panel privado: caja, cocina, delivery, inventario, cierres,
                       reportes, configuracion, sucursales, auditoria, usuarios, …
    api/               Endpoints (orders, payments, inventory, branches, public/*, …)
  lib/                 Lógica de dominio (89 módulos). Núcleo:
                       orders*.ts (pedidos), ordersInventory, inventoryConsumption,
                       localPlans (planes/módulos), localAccess (roles/permisos),
                       branch*.ts (multi-sede), paymentOptions, audit, monitoring,
                       rateLimit, requestGuards, supabaseServer/Browser.
  components/          UI (CartDrawer, AuthBridge, LocalStaffShell, LocalModuleNav, …)
  types/               Tipos compartidos (localOrders, …)
  utils/, hooks/, config/, data/
supabase/migrations/   ~25 migraciones SQL (0001 → 0025)
scripts/               smoke, backup/restore, e2e-*
docs/ + *.md           Guías de uso, operación y este traspaso
.github/workflows/     ci.yml (typecheck+lint+test+build) · claude.yml
```

**Regla mental:** la UI (`app/`, `components/`) casi no tiene lógica de negocio; todo lo importante vive en `lib/` y se testea ahí. Al extender, sigue ese patrón.

## 4. Modelo de datos (Supabase)

Tablas operativas principales: `orders`, `order_items`, `open_accounts`, `inventory_items`, `inventory_movements`, `inventory_recipes`, `day_closes`, `day_expenses`, `delivery_zones`, `payment_proofs`, `suppliers`, `supplier_purchases`, `reservations`, `subrecipes`, `staff_users`, `audit_logs`, `push_subscriptions`, y `branches`. `business_config` (JSONB) guarda marca, tema, módulos y reglas del negocio (compartida entre sedes).

- **Multi-sede:** casi todas las tablas operativas tienen `branch_id` (migración 0009). El backend resuelve la sede con `resolveBranchId` / `resolveScopedBranchId` y **filtra por `branch_id`** en cada consulta. Hay *fitness guards* que fallan el test si alguien olvida el aislamiento por sede.
- **Numeración de pedidos:** correlativo por sede (`branch_seq` + `branch_code`) vía trigger (migración 0025), con *fallback* al `seq` global.
- **Migraciones:** se aplican **manualmente** en el SQL Editor de Supabase (no hay `supabase db push` automatizado). Cada `.sql` es idempotente. **Al desplegar un cambio con migración, aplícala en Supabase ANTES o junto al deploy.**

## 5. Autenticación y permisos (importante)

Dos mecanismos conviven:

1. **Contraseña por rol** (modo `.env`, compatible hacia atrás): `ORDERS_OWNER_PASSWORD`, `ORDERS_CASHIER_PASSWORD`, etc. Se guarda en el navegador y viaja como `x-admin-password`.
2. **Usuario propio (Supabase Auth)**: cada persona con su cuenta. `AuthBridge` (`components/AuthBridge.tsx`) adjunta el token `Authorization: Bearer` y el `x-branch-id` de la sede elegida a **todas** las llamadas `/api/*`.

- **Roles:** `owner, manager, cashier, kitchen, delivery, waiter, promoter, support` (`lib/localAccess.ts`). `ROLE_ACCESS[rol]` define a qué módulos entra cada rol.
- **Planes / módulos:** `lib/localPlans.ts` decide qué módulos están incluidos por plan (`getModulePlanAccess` → `includedInPlan && enabledByOwner`). Plan por defecto: `complete`.
- **Cierre de sesión:** `lib/staffSession.ts` (`signOutLocalStaff`) cierra Supabase, borra tokens `sb-*-auth-token` y va al login.

## 6. Dinero y fiscal

- Doble moneda: montos en **USD** con equivalente en **Bs** según **tasa BCV** (dólar o euro, o manual por sede).
- Catálogo único de métodos de pago en `lib/paymentOptions.ts`; `isVesPaymentMethod` clasifica la moneda (pago móvil/punto/transferencia/efectivo Bs/biopago = Bs; Zelle/Binance/USDT/internacional = $).
- Fiscal: **IVA** e **IGTF** configurables por sede (`branchConfigSchema.ts`), snapshot fiscal por pedido.

## 7. Correr en local

```bash
npm ci
cp .env.example .env.local   # y completar (ver §9)
npm run dev                  # http://localhost:3000
```

Comandos útiles:

```bash
npm run lint       # ESLint
npx tsc --noEmit   # typecheck
npm test           # Vitest (349 tests)
npm run build      # build de producción
npm run smoke      # smoke test contra el server
npm run backup / npm run restore   # respaldo de datos
```

## 8. Despliegue

Cada marca es **un proyecto de Vercel + un proyecto de Supabase** separados. La carpeta enlazada guarda `.vercel/project.json`.

- **Santo Perrito** → rama `main`. (Confirmar en Vercel si está en auto-deploy por git; hoy el push a `main` dispara el deploy.)
- **Brotherhood** → rama `brotherhood-publico`, **deploy MANUAL**:
  ```bash
  cd "D:/Santo edit"      # carpeta enlazada al proyecto Vercel "brotherhood"
  npx vercel --prod
  ```
  El push a la rama **no** publica solo; hay que correr ese comando. (Ver [`docs/DESPLIEGUE.md`](DESPLIEGUE.md).)

**Antes de cada deploy:** aplicar migraciones pendientes en Supabase, y correr `npm run lint && npx tsc --noEmit && npm test && npm run build`. El CI (`.github/workflows/ci.yml`) lo hace en cada push a `main`, `brotherhood-publico` y `claude/**`, y en cada PR.

## 9. Variables de entorno (resumen)

Obligatorias: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, y las `ORDERS_*_PASSWORD` de cada rol.
Opcionales: `STRIPE_*` (pagos online), `SENTRY_*` / `NEXT_PUBLIC_SENTRY_DSN` (monitoreo), `VAPID_*` (push), `NEXT_PUBLIC_SITE_URL`, `ALLOWED_API_ORIGINS`, y varios `*_MAX_BYTES` / `RATE_LIMIT_*` (límites anti-abuso). Lista completa y comentada en [`.env.example`](../.env.example).

## 10. Sumar un cliente/marca nueva (white-label)

Resumen (detalle operativo en [`CHECKLIST-CLIENTE-NUEVO.md`](../CHECKLIST-CLIENTE-NUEVO.md) y [`docs/separacion-brotherhood-santo-perrito.md`](separacion-brotherhood-santo-perrito.md)):

1. Crear **proyecto Supabase** nuevo y aplicar **todas** las migraciones `supabase/migrations/*` en orden.
2. Crear rama de la marca (ej. `demo-cliente`) y ajustar la marca (`lib/brand.ts`, colores, logo, textos).
3. Crear **proyecto Vercel** nuevo, enlazarlo a la carpeta/rama, y cargar las env (§9) con las claves de ESE Supabase.
4. `npx vercel --prod` y verificar con el checklist del cliente.

## 11. Riesgos conocidos y roadmap de robustez (para el comprador)

Priorizado por impacto en valor de venta:

1. **Auth: unificar en usuarios propios.** Hoy conviven contraseñas por rol (`.env`) y usuarios Supabase. Meta: cada persona con su cuenta, retirar contraseñas compartidas, y RLS en Supabase por `branch_id`/negocio para aislamiento multi-tenant fuerte.
2. **Migraciones automatizadas.** Pasar de aplicar `.sql` a mano a un flujo versionado (`supabase db push` / CI). Reduce el riesgo de "deploy sin migración".
3. **Deploy de Brotherhood a un clic.** Añadir un workflow `workflow_dispatch` (o auto-deploy por git) para no depender de `npx vercel --prod` manual. Ver [`docs/DESPLIEGUE.md`](DESPLIEGUE.md).
4. **Onboarding de cliente "solo".** Script/asistente que cree Supabase+Vercel+env y siembre `business_config` con la marca, para no hacerlo a mano.
5. **Observabilidad.** Sentry ya está cableado; falta activarlo/monitorearlo de forma consistente en todas las marcas.

Ninguno bloquea la operación actual; son lo que un comprador querrá ver como plan.

## 12. Contactos y convenciones

- Commits en español, formato `tipo(scope): resumen` (ej. `feat(caja): …`).
- No romper el aislamiento por sede (hay tests que lo vigilan).
- Toda migración nueva: archivo `.sql` idempotente en `supabase/migrations/`, y avisar que **el dueño la aplica** en Supabase.
