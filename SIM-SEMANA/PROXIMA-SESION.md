# Encargo — estado tras la sesión del 2026-07-29 (tarde)

La sesión anterior dejó aquí 8 bloques. **Esta sesión ejecutó los 8.** Lo que
sigue es el estado real y lo poco que queda, para que la próxima sesión no
re-investigue nada.

**Cómo arrancar**: leer este archivo, `barrido-secciones.md`, `bugs.md` y
`estado.json`. Entorno de simulación: proyecto `gnyvdlxlrjwbsdctincy`,
`.env.simulacion` en la raíz, server en `http://localhost:3181`
(⚠️ al terminar la sesión anterior `.env.local` quedó devuelto a PRODUCCIÓN —
verificar antes de levantar nada).

---

## Lo que quedó HECHO (commits en brotherhood-publico)

1. **Política de anulaciones implementada** (`87214bd`) — migración 0036
   (origen/quién/insumos/destino del dinero), 2ª pregunta en caja/panel,
   default DEVUELTO en `CANCEL_REFUND_DEFAULT` (UNA línea para invertirlo),
   anulados explicándose solos en notificación/caja/cierre/historial/export,
   el cierre ya no parsea `customerNote` con regex. 19 tests.
2. **Scripts §4** (`dfe5e48`) — `run-week` / `resume-week` /
   `reset-simulation` (5 candados, simulacro por defecto) + candado de
   proceso único. Probados los caminos de rechazo y el simulacro real.
3. **`plan-semanal.json`** (`dfe5e48`) — calendario §5/§10 volcado.
4. **Reservas/Encuestas/Soporte** (`dfe5e48`) — `probar-modulos.mjs`:
   **24 PASS · 0 FAIL · 1 BLOCKED** (WhatsApp/Meta). La conversión
   reserva→pedido NO existe en el esquema (probado, no asumido). "Soporte"
   es el panel de estado del rol soporte — no hay sistema de tickets.
5. **Barrido §26 completo** (`fdc3b7d`, `3751493`) — ver
   `barrido-secciones.md`: reloj §9 (10 tests, con OBSERVACIÓN del filtro por
   `createdAt`), dinero §15 (fix real: "Bs 9.648,99" copiado con símbolo daba
   0 — corregido en las TRES copias de la regla), fallos parciales §18 (2
   fixes reales: compensación de compras a medias + cierre duplicado al
   reintentar el reinicio), rendimiento §11.5 (`rendimiento-vs-umbrales.md`:
   6 de 8 operaciones NO cumplen contra el dev server; producción sin medir).
6. **main / Santo Perrito** — BH-SIM-001/002 PORTADOS en la rama
   `main-guard-precios` (worktree `.claude/worktrees/main-guard`): guard de
   precios + tasa del servidor + 8 tests con la forma del menú de Santo
   (armable colapsado " · " incluido — la lección de BH-SIM-006). tsc + 385
   tests en verde. Ver "Qué falta" abajo para el merge.

**Hallazgo que corrige el encargo anterior**: "el dinero del anulado sigue
contando en el cierre" era un artefacto del MOTOR de la simulación (armaba
sus cierres desde el libro). La UI real (`billableToday`) ya lo excluía — lo
que faltaba y ahora existe es la línea aparte del dinero que "se quedó".

## Qué falta (poco y concreto)

1. ~~Aplicar 0036 en la base de PRUEBA~~ — **HECHO 2026-07-29**: el usuario
   la aplicó y `probar-anulaciones.mjs` dio **ANU-1…ANU-10 en 10 PASS · 0
   FAIL** (los tres orígenes con detalle estructurado completo, default
   devuelto, NULL donde no aplica, automática incluida). Bitácora en
   `SIM-SEMANA/anulaciones.md`.
2. **Deploy de Brotherhood** (`npx vercel --prod` desde `D:/Santo edit`, lo
   corre el usuario) — los 4 commits de esta sesión no están en el vivo.
3. **Merge del porte a main**: la rama `main-guard-precios` está lista
   (1 commit sobre main, build verificado). Fusionar y desplegar Santo
   Perrito cuando el usuario quiera. Su Supabase NO necesita migración para
   esto (el guard es solo código).
4. **El default de anulación sigue siendo SUPUESTO** ("devuelto") — cuando
   el dueño confirme, es una línea en `orderCancellationInfo.ts`
   (`CANCEL_REFUND_DEFAULT`) + actualizar su test.
5. **Bloqueos de terceros, sin cambios**: Playwright (accesibilidad/PWA),
   VAPID (push real), WhatsApp/Meta de prueba, impresora 80mm. Y medir
   rendimiento contra producción Vercel (hoy solo dev server).
6. **Observación §9 a decidir** (producto, no bug): el filtro por fechas del
   historial usa `createdAt` del cierre — un cierre del sábado guardado el
   domingo 00:05 no aparece filtrando "solo sábado" (detalle y test en
   `businessClockCaracas.test.ts`).
