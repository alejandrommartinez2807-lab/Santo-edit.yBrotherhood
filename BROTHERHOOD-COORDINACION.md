# Brotherhood — Coordinación de 2 sesiones en el sitio público

Dos sesiones de Claude (cuenta A y cuenta B) trabajan **el sitio público** a la vez.
Para NO pisarse: cada una edita **solo sus archivos**. Los contratos de datos y los
archivos compartidos NO se tocan sin avisar. Así se mantienen todas las funciones y
la conexión con el panel privado (que escribe la config y el menú en la misma base).

> ⚠️ Antes de trabajar: `git pull` / lee el último commit + este archivo + `MEMORY.md`.
> ⚠️ Antes de CADA commit: `npm run build` y `npx vitest run` en verde.
> ⚠️ Commits chicos y seguidos, con prefijo `[A]` o `[B]` en el mensaje.

---

## Reparto de archivos (cada cuenta SOLO toca los suyos)

### 🅰️ Cuenta A — Cabecera + Menú + Producto
- `src/components/Navbar.tsx`
- `src/components/Hero.tsx`
- `src/components/Products.tsx`
- `src/components/ProductCard.tsx`
- `src/components/productCardHelpers.ts`
- `src/components/FeaturedProducts.tsx`
- `src/components/PublicPromotion.tsx`
- `src/components/PublicMenuCollections.tsx`
- `src/components/PublicMenuDecisionHelp.tsx`

### 🅱️ Cuenta B — Cuenta por mesa + Carrito + Info + Guías
- `src/components/OpenAccountInfo.tsx`
- `src/components/CartDrawer.tsx`
- `src/components/cartDrawerParts.tsx`
- `src/components/BottomInfoSections.tsx`
- `src/components/PublicFooter.tsx`
- `src/components/MobilePublicActionBar.tsx`
- `src/components/PublicFloatingCartSummary.tsx`
- `src/components/PublicSectionNavigator.tsx`
- `src/components/PublicQuickInfoStrip.tsx`
- `src/components/PublicBranchPicker.tsx`
- `src/components/PublicBranchSelector.tsx`
- `src/components/PublicDeliveryZones.tsx`
- `src/components/PublicCustomerConfidence.tsx`
- `src/components/PublicFinalOrderCta.tsx`
- `src/components/PublicOrderFaq.tsx`
- `src/components/PublicOrderModeGuide.tsx`
- `src/components/PublicOrderReadinessPanel.tsx`
- `src/components/PublicSavedFavoritesGuide.tsx`

### 🚫 COMPARTIDOS — nadie los toca sin avisar y coordinar por commit
Aquí vive el tema global y la **conexión con el panel privado**. Cambiar esto afecta
a las dos cuentas y al admin. Si hay que tocarlo: lo hace UNA sola cuenta, commitea de
inmediato y lo anota abajo en "Trabajando ahora".
- `src/app/page.tsx` (shell del sitio)
- `src/app/layout.tsx` (fuentes / metadata)
- `src/app/globals.css` (variables de tema, `.font-display`)
- `src/lib/theme.ts`, `src/lib/brand.ts`
- `src/lib/ordersBusinessConfig.ts` (defaults canónicos del servidor)
- `src/lib/publicBusinessConfigResponse.ts`, `src/lib/publicPageConfig.ts`
- `src/app/api/public/**` (contratos que consume el sitio y produce el admin)

---

## Reglas para NO romper funciones ni la conexión con el panel privado

1. **Solo presentación** en tus componentes: clases Tailwind, layout, texto visible,
   tema oscuro/naranja. NO cambies props, nombres de campos, ni la forma de los datos.
2. **No inventes ni renombres claves** de `business_config` ni cambies el shape de
   `/api/public/*`. Eso es lo que mantiene el sitio sincronizado con el admin. Si el
   admin guarda un campo, el sitio lo lee con ese mismo nombre — respétalo.
3. **Tema oscuro ya resuelto por variables:** usa `bg-[var(--brand-surface)]`,
   `text-[var(--brand-ink-3)]` (claro), `--brand-primary`/`--brand-accent` (naranja),
   `--brand-border`. Botón naranja → `text-black`. No metas `bg-white` ni colores fijos claros.
4. **Fuente de títulos:** clase `.font-display` (Anton, ya cargada en layout).
5. **Pitfall Turbopack:** si tocas `globals.css` (compartido), hay que `rm -rf .next` y
   reiniciar el dev server para que tome. Cambios solo en componentes toman con reload.
6. Verifica en preview a **375px** (mobile-first) antes de dar por bueno.

---

## Git: cómo se sincronizan sin conflictos

- Cada cuenta trabaja en su **propia rama/worktree** partiendo de `brotherhood-rebrand`
  (p.ej. `brotherhood-public-a` y `brotherhood-public-b`).
- Como editan **archivos distintos**, fusionar es limpio (sin conflictos):
  `git merge brotherhood-public-b` (y viceversa), o ambas fusionan a `brotherhood-rebrand`.
- Fusiona seguido (varias veces al día) para enterarte de lo del otro cuanto antes.

---

## 🔒 Trabajando ahora (actualízalo y commitea ANTES de editar)

Escribe aquí el archivo que vas a tocar, commitea este cambio primero, y bórralo al terminar.
Si ves el archivo que ibas a tocar reclamado por la otra cuenta, elige otro.

- 🅰️ A: _(libre)_
- 🅱️ B: _(libre)_
