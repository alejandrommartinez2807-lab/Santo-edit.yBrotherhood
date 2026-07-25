# SUPER PROMPT — Revisión total, blindaje y mejoras del sistema

## OBJETIVO GENERAL
Hacer una revisión COMPLETA de absolutamente todo el sistema (POS multi-sede
Santo/Brotherhood, Next.js + Supabase, 2 sedes activas), sin dejar puntos
ciegos. Por cada módulo: (1) cazar todos los errores posibles, (2) blindarlo
en seguridad y aislamiento por sede, y (3) aplicar mejoras completas y bien
hechas. Al terminar, el sistema debe quedar a un nivel de negocio
profesional, completamente funcional y a prueba de fallas.

## REGLAS DE TRABAJO (obligatorias)
- Trabaja por FASES de bajo riesgo. Al final de CADA fase: `tsc` + tests
  (vitest) + build. NO uses navegador/localhost (se cuelgan); verifica con
  tsc + tests + build.
- Commitea cada fase por separado (git es la red de seguridad).
- Las MIGRACIONES las escribes tú en .sql; yo las aplico en Supabase. Nunca
  asumas que una migración fue aplicada.
- Respeta y REFUERZA el aislamiento por sede (`x-branch-id`) y los fitness
  guards existentes. Agrega tests que fallen si una sede filtra datos de otra.
- No dañes las apps hermanas (Santo Perrito / demos / hotel / clínica). Trabaja
  solo lo pedido.
- Prioriza la ROBUSTEZ sobre la velocidad. No importa cuántas migraciones,
  cambios o iteraciones hagan falta.

---

## PARTE A — REVISIÓN MÓDULO POR MÓDULO
Para CADA módulo de abajo, entrega estas 3 cosas:
  (E) ERRORES: lista de fallas posibles + las que encuentres, con su fix.
  (S) BLINDAJE/SEGURIDAD: aislamiento por sede, validación de entrada,
      permisos por rol, manejo de errores, columnas/tablas que existan de
      verdad (nada de 500 silenciosos por columnas inexistentes).
  (M) MEJORAS: aplicadas completas y bien hechas, no a medias.

### A1. Caja / Cobros
- Verifica que TODO en la caja esté bien conectado y funcione: cuentas
  abiertas, cobro que reparte por pedido, cierre que resta gastos, pagos,
  reporte de pago, número por sede, multi-pestaña.
- Revisa que todos los ÚLTIMOS cambios implementados sigan funcionando y
  estén bien integrados (nada roto por lotes anteriores).

### A2. Cierres e Historiales de caja  (incluye lote previo)
- El dueño, al abrir el historial de cierre, debe ver los pedidos CANCELADOS
  del día: cuáles y el MOTIVO — SIN dañar ni alterar el resto del historial.
- Funciona en vista DIARIA y GENERAL.
- Exportación: agregar PDF bien formateado + mejorar el Excel (columnas
  claras, totales, por sede). Diario o general.
- CRÍTICO: diferencia de forma inequívoca los historiales y cierres entre las
  2 sedes para que NUNCA se mezclen ni fallen. Tests que lo blinden.

### A3. Inventario + Insumos
- Sistema de inventario e insumos perfectamente funcional.
- VISTA RÁPIDA y fácil del inventario (de un vistazo: qué hay, qué falta).
- Descuento de inventario correcto al vender (por variación/adicional/insumo).
- Conexión con GASTOS/egresos funcionando (compras que suman stock y gasto).

### A4. Proveedores
- Que sea algo COMPLETO y MÁS FÁCIL de usar, comparable a lo que usan las
  empresas y sistemas grandes: historial de compras, precios, saldos/cuentas
  por pagar, comparación, búsqueda rápida, flujo simple.
- Mejóralo todo lo que puedas manteniéndolo simple a la vista.

### A5. Gastos / Egresos
- Módulo unificado de egresos (gastos + compras + proveedores + alertas) bien
  conectado; que el contador y los totales cuadren.

### A6. Mesonero
- Revisa que los módulos de mesonero estén BIEN conectados con caja/cocina/
  pedidos y que todo el flujo funcione punta a punta.

### A7. Configuración  (ver también PARTE B)
- Optimizada, más agradable y MENOS complicada a la vista. Con tantas cosas
  nuevas puede haber quedado recargada: reorganiza, agrupa, simplifica.

### A8. Resto de módulos (sin dejar ninguno)
Pedidos, Menú / menu-avanzado, Reservas, Encuestas, Reportes, Eventos,
Delivery, Pagos, Sedes/Auth, Auditoría, y CUALQUIER otro módulo presente.
Aplica (E)(S)(M) a cada uno. Si descubres un módulo no listado, inclúyelo.

---

## PARTE B — CONFIGURACIÓN: optimización + UX
- Deja la sección de Configuración perfectamente optimizada.
- Más agradable a la vista y menos complicada: agrupa por temas, reduce ruido,
  nombres claros, orden lógico, menos clics.
- No pierdas ninguna opción existente; solo ordénalas mejor.

---

## PARTE C — REGLA ANTI-INCOMPLETO / BLINDAJE (MUY IMPORTANTE)
No dejes NADA a medias. Antes de decir que terminaste:
- Repasa este prompt PUNTO POR PUNTO y confirma cada uno con EVIDENCIA
  concreta (archivo tocado, test que lo cubre, resultado de tsc/tests/build).
  Nada "de memoria".
- Prohibido declarar algo hecho si no está verificado. Si no lo probaste, dilo.
- Lo pendiente va en una lista PENDIENTE con el motivo. Nunca lo ocultes.
- Si no cabe en una respuesta/sesión, NO cierres a medias: deja el estado de
  dónde quedaste y CONTINÚA hasta completar TODO. Yo diré "sigue" las veces
  que haga falta; no te detengas por tu cuenta con puntos sin terminar.
- Cierre válido = checklist final 100% en verde, O explícito y justificado lo
  que falta y por qué.

---

## PARTE D — PÁGINAS DE VISTA PREVIA (rediseño público)
- REFERENCIAS: las 2 ideas están en `docs/idea-brother/` (dentro del repo):
    · `idea-1-oscura-mayusculas.png`
    · `idea-2-elegante-serif.png`
  Ábrelas y úsalas de guía de MARCA y dirección. Son mockups del home público
  (móvil) de Brotherhood:
    · Idea 1: tema muy oscuro, titular condensado en MAYÚSCULAS ("SMASH BURGERS
      QUE SÍ PROVOCAN"), foto de hamburguesa a sangre, CTA ámbar "Ver menú y
      pedir", botones secundarios (Cómo llegar / Reseñas), barra inferior.
    · Idea 2: más elegante, titular SERIF ("Burgers que se ganan tu lealtad"),
      hamburguesa con banderín Brotherhood, chips de categorías (Smash/Chicken/
      Combos), fila de estado (Abierto ahora / ubicación / 4.8 reseñas), tarjeta
      de Combos, barra inferior.
- LENGUAJE DE MARCA A MANTENER en todas: fondo OSCURO, acento ÁMBAR/NARANJA,
  el LOGO SCRIPT REAL de Brotherhood, fotografía de hamburguesa apetitosa,
  mobile-first, barra de navegación inferior, estado "Abierto ahora".
- Genera 3 vistas previas MÁS, completamente ORIGINALES y DIFERENTES entre sí
  y de las 2 referencias (distinto layout, personalidad y ANIMACIONES) — para
  que junto con las 2 ideas tengamos ~5 opciones y elijamos la final entre
  todas.
- REGLA DURA DE AISLAMIENTO: estas previas NO deben tocar ni dañar la PÁGINA
  NORMAL (la pública real) en NADA. Son rutas/páginas aparte, aisladas, solo
  para comparar opciones. Cero riesgo para producción ni para los worktrees.
- LOGO: usa el LOGO REAL del negocio (Brotherhood, el script). NUNCA una
  tipografía común y corriente como sustituto del logo.
- Cada previa debe verse a nivel profesional y ser navegable para decidir.

---

## ENTREGABLES
- Resumen por módulo con (E)(S)(M): qué se encontró, qué se blindó, qué se
  mejoró.
- Cada fase commiteada por separado.
- Los .sql de migración (si hacen falta) para que yo los aplique.
- CHECKLIST FINAL por módulo (OK / hallazgo / corregido) — 100% en verde o con
  lo pendiente justificado.
- Repaso punto por punto de este prompt confirmando cada uno.
- Las 3 vistas previas nuevas + cómo verlas, con la garantía de que la página
  normal quedó intacta.
- Lista de lo que quedó verificado y lo que requiere mi acción (migraciones,
  deploy).
