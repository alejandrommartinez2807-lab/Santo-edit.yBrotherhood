# Brotherhood — Coordinación de 2 sesiones (privado vs público)

Dos sesiones de Claude trabajan en paralelo, cada una en una **capa distinta**:

- **🅰️ Cuenta A → PANEL PRIVADO (admin)**
- **🅱️ Cuenta B → SITIO PÚBLICO (cliente)**

Las dos capas viven en carpetas casi separadas, así que **casi no se pisan**. Lo único
que comparten es la lógica de negocio y el tema (`src/lib`, `globals.css`, `api`): eso
NO se toca sin avisar. Así se mantienen todas las funciones y la conexión privado↔público
(ambas leen/escriben la misma base vía `src/lib` y `/api`).

> ⚠️ Antes de trabajar: `git pull` / lee el último commit + este archivo + `MEMORY.md`.
> ⚠️ Antes de CADA commit: `npm run build` y `npx vitest run` en verde.
> ⚠️ Commits chicos y seguidos, con prefijo `[A]` (privado) o `[B]` (público).

---

## Reparto por carpetas (cada cuenta SOLO toca lo suyo)

### 🅰️ Cuenta A — PANEL PRIVADO
- `src/app/local-santo/**` (todas las páginas admin: caja, cocina, inventario,
  reportes, configuracion, delivery, mesas, usuarios, etc.)
- `src/components/local/**` (paneles admin: OpenAccountsPanel, PanelPrimitiveCards,
  CloseReviewComponents, LocalTablesMap, etc.)
- Componentes "shell" del admin: `LocalStaffShell.tsx`, `LocalModuleNav.tsx`,
  `ModuleAccessGuard.tsx`, `CurrentBranchBanner` (si aplica).
- `src/app/acceso/**` (login del personal).

### 🅱️ Cuenta B — SITIO PÚBLICO
- `src/app/page.tsx` (home pública) y `src/app/mesa/**` (menú por QR).
- `src/app/pedidos/**` y `src/app/pago/**` (flujo de pedido/pago del cliente).
- Componentes públicos en `src/components/*.tsx`: `Navbar`, `Hero`, `Products`,
  `ProductCard`, `productCardHelpers`, `FeaturedProducts`, `PublicPromotion`,
  `OpenAccountInfo`, `CartDrawer`, `cartDrawerParts`, `BottomInfoSections`,
  `PublicFooter`, `MobilePublicActionBar`, y todos los `Public*.tsx`.

### 🚫 COMPARTIDOS — nadie los toca sin avisar y coordinar por commit
Aquí vive la lógica y el tema que usan LAS DOS capas. Cambiar esto afecta a ambas.
Si hay que tocarlo: lo hace UNA sola cuenta, commitea de inmediato y lo anota abajo
en "Trabajando ahora".
- `src/lib/**` (lógica de negocio + contratos que conectan público↔privado)
- `src/app/api/**` (endpoints)
- `src/app/globals.css` (variables de tema, `.font-display`)
- `src/app/layout.tsx` (fuentes / metadata)
- `src/lib/brand.ts`, `src/hooks/**`, `src/utils/**`
- Infra en `src/components`: `AuthBridge`, `ServiceWorkerRegister`, `OfflineSync`,
  `BranchSwitcher`.

---

## Reglas para NO romper funciones ni la conexión privado↔público

1. **Solo presentación** en tus archivos: clases Tailwind, layout, texto visible, tema.
   NO cambies props, nombres de campos, ni la forma de los datos.
2. **No inventes ni renombres claves** de `business_config` ni cambies el shape de
   `/api/**`. El admin (A) las escribe y el sitio (B) las lee con ese mismo nombre —
   ese es el puente entre las dos capas. Respétalo.
3. **Tema oscuro ya resuelto por variables (global):** usa `bg-[var(--brand-surface)]`,
   `bg-[var(--brand-surface-2)]`, `text-[var(--brand-ink-3)]` (claro),
   `--brand-primary`/`--brand-accent` (naranja), `--brand-border`. Botón naranja →
   `text-black`. NO metas `bg-white` ni colores fijos claros (rompen el modo oscuro).
4. **Fuente de títulos:** clase `.font-display` (Anton, ya cargada en layout).
5. **Pitfall Turbopack:** si alguien toca `globals.css` (compartido), hay que
   `rm -rf .next` y reiniciar el dev server para que tome. Cambios solo en componentes
   toman con reload normal.
6. Verifica en preview a **375px** (mobile-first) antes de dar por bueno.

---

## Git: cómo se sincronizan sin conflictos

- Cada cuenta trabaja en su **propia rama/worktree** partiendo de `brotherhood-rebrand`
  (p.ej. A en `brotherhood-privado`, B en `brotherhood-publico`).
- Como editan **carpetas distintas**, fusionar es limpio (sin conflictos):
  `git merge brotherhood-publico` (y viceversa), o ambas fusionan a `brotherhood-rebrand`.
- Fusiona seguido (varias veces al día) para enterarte de lo del otro cuanto antes.

---

## 🔒 Trabajando ahora (actualízalo y commitea ANTES de editar un archivo compartido)

- 🅰️ A (privado): _(libre)_
- 🅱️ B (público): _(libre)_
