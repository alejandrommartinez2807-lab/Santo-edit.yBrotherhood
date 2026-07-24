# Prompt — Rediseño experimental de la página pública (sin perder nada)

> Pega esto en la próxima sesión (o di: "lee REDISENO-PROMPT.md y arranca").

Quiero probar un par de ideas de rediseño de la página pública de Brotherhood
(D:/Santo edit, rama estable `brotherhood-publico`). REGLA DE ORO: **no se
puede perder NADA de lo que ya funciona** — si el rediseño no me gusta, se
descarta completo y volvemos exactamente a lo de hoy.

## Red de seguridad (ya preparada el 2026-07-24)
- **Punto de retorno en git**: tag `estable-pre-rediseno` (= commit estable
  desplegado en producción). Volver atrás = `git checkout brotherhood-publico`
  (el tag es solo referencia; NUNCA hacer reset sobre la rama estable).
- **Foto de la configuración/datos**: `backups/config-snapshot-2026-07-24.json`
  (business_config completo + sedes + menú). El rediseño NO debe tocar la BD;
  si algún experimento cambió config (colores del tema, textos), se restauran
  esos valores desde el snapshot vía `POST /api/business-config` con
  x-admin-password (¡es POST, no PATCH!).
- **Producción intocable**: el dueño ve los experimentos SOLO por deploys de
  PREVIEW de Vercel (`npx vercel` SIN `--prod` → URL única tipo
  brotherhood-xxxx.vercel.app). PROHIBIDO `--prod` hasta aprobación explícita.

## Cómo trabajar el rediseño
1. Crear la rama `rediseno-publico` desde `brotherhood-publico` (worktree si
   se quiere tener ambas a mano). Todo el experimento vive ahí.
2. SOLO tocar la capa visual pública: `src/components/` (Hero, Navbar,
   Products, ProductCard, FeaturedProducts, PublicPromotion, BottomInfoSections,
   PublicLocations, cartDrawerParts visual) y `globals.css`/tema. **NO tocar**:
   APIs, `lib/`, lógica del carrito/pagos (CartDrawer lógica), panel privado,
   sw.js (salvo subir versión al final si se aprueba).
3. Los FLUJOS son sagrados: pedido, mixto por patas, seguimiento, promoción,
   reseñas por sede, sedes/delivery. Después de cada idea, correr
   `AUTO-REVISION-FLUJOS.md` + `npx vitest run --dir ./src` (399+ verdes) +
   `npm run build`.
4. Por cada idea de diseño: capturas CDP (390px y 360px, secciones clave:
   hero, menú, ficha, carrito, confirmación) + deploy PREVIEW y pasar la URL
   al dueño. Iterar con su feedback.
5. **Si aprueba**: merge de `rediseno-publico` → `brotherhood-publico`, subir
   SW (`santo-*-vNN`), `npx vercel --prod --yes`, push de ambas ramas.
   **Si NO aprueba**: borrar la rama y ya — producción nunca se tocó.
6. Si algo de producción se dañara por accidente: en Vercel, "Promote to
   production" del deployment anterior (o redeploy desde brotherhood-publico
   estable); la BD no la toca el rediseño.

## Contexto de diseño actual (para no partir de cero)
- Tema oscuro negro + naranja (#f5a623 aprox) con variables `--brand-*`
  (globals.css); tipografía display para títulos; botones naranja con
  `text-black`; referencia visual en
  `C:\Users\maye2\OneDrive\Desktop\brotherhood-mockups\`.
- La página vive de config editable: textos/colores del dueño MANDAN sobre
  cualquier default nuevo (no romper las claves `public*` ni `theme*`).
- Cambios de colores en config requieren redeploy (el tema viaja horneado).

## Verificación final antes de proponer merge
tsc + vitest + build limpios; capturas de TODAS las secciones en 360/390;
matriz `AUTO-REVISION-PAGOS.md` (los flujos de pago intactos); confirmar que
la config de la BD quedó IGUAL al snapshot (diff de claves de diseño).
