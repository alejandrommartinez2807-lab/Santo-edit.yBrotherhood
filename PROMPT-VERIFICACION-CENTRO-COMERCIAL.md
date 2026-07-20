# Verificación exhaustiva — C.C. Concepto La Granja

Documento-prompt para blindar el sistema. Contiene: (1) los comandos de
verificación automática, (2) checklists de QA manual por función con casos
borde, (3) modos de falla a cubrir, y (4) un "self-prompt" para reauditar todo
en una sesión futura. Todo lo del centro comercial vive en el worktree
`D:\Santo edit\.claude\worktrees\concepto-la-granja` (rama `concepto-la-granja`).

---

## 1. Verificación automática (correr SIEMPRE antes de dar por bueno un cambio)

```bash
cd "D:/Santo edit/.claude/worktrees/concepto-la-granja"
npx tsc --noEmit                 # 0 errores de tipos
npx vitest run                   # toda la suite en verde (incluye mallText + parkingFee)
npx eslint --quiet <archivos>    # 0 ERRORES (warnings preexistentes de no-unused-vars, tolerados)
```

Notas del entorno:
- El disco `D:` es lento: `next dev` con Turbopack se **estanca compilando** desde
  el worktree; para ver la app en vivo, correr en local, no aquí.
- El repo padre ignora `.claude/**`; correr eslint DENTRO del worktree para que
  aplique su propia config.
- La regla `react-hooks/set-state-in-effect` está desactivada a nivel de archivo
  en `PanelApp.tsx` y `MiCuenta.tsx` (patrón mount-fetch intencional y uniforme).

---

## 2. Migración y seed necesarios

- `supabase/migrations/0017_microsites.sql` — campos de micrositio en `units`.
- `supabase/seed_microsites_demo.sql` — publica 3 micrositios de demo
  (`/tienda/capitan-grill`, `/tienda/figaro-barbiere`, `/tienda/tecnostore`).

Sin la migración, el portal degrada al directorio de ejemplo (DEFAULT_STORES) y
`/tienda/*` y el panel de micrositios dan error de columna.

---

## 3. QA por función (con casos borde)

### 3.1 Directorio público `/portal`
- [ ] Carga con locales reales (units con `commercial_name`). Sin datos → muestra DEFAULT_STORES.
- [ ] Chips de rubro filtran; "Todos" reinicia; el conteo por chip coincide.
- [ ] Buscador: encuentra sin acentos ni mayúsculas ("figaro" → Fígaro; "OPTICA" → Óptica).
- [ ] Búsqueda + chip combinados. Sin resultados → estado vacío con "Ver todo el directorio".
- [ ] Tarjeta enlaza a `/tienda/<slug>` sólo si `microsite_enabled`. Si no, no es clicable.
- [ ] Local sin logo → muestra el ícono del rubro; con logo → la imagen.

### 3.2 Micrositio `/tienda/[slug]`
- [ ] Slug publicado → renderiza; slug inexistente o `microsite_enabled=false` → 404.
- [ ] Portada vacía → gradiente de respaldo (no rota). Logo vacío → ícono de rubro.
- [ ] WhatsApp usa el del local o cae al del mall; teléfono/Instagram/web sólo si existen.
- [ ] Instagram admite `@user` o URL completa; web con o sin `https://`.
- [ ] Galería: rota si una imagen no carga (no debe tumbar la página).
- [ ] `generateMetadata` pone título/description del local.

### 3.3 Estacionamiento self-service `/estacionamiento`
- [ ] "Acabo de llegar" → genera ticket + QR; el QR apunta a `/estacionamiento?code=...`.
- [ ] Placa opcional; se normaliza a mayúsculas y se recorta a 12.
- [ ] Tipo de vehículo fuera de {carro,moto,otro} → cae a "carro" (backend).
- [ ] "Ya tengo ticket" con código válido → muestra monto en vivo; inválido → "no encontrado".
- [ ] Registrar pago: método fuera de la lista → cae a "pago_movil"; referencia se recorta a 60.
- [ ] Pagar un ticket ya `pagado`/`cortesia` → responde `alreadySettled` (no vuelve a cobrar).
- [ ] Pagar un ticket `anulado` → 409 con mensaje "acércate a la caseta".
- [ ] `?new=1` abre directo el check-in; `?code=XXX` abre directo la consulta.
- [ ] Rate limit: >8 check-ins/min o >12 pagos/min → 429 con mensaje claro.

### 3.4 Panel → Estacionamiento
- [ ] Sección "Pagos reportados por confirmar" lista los `por_pagar` con método/monto/nota.
- [ ] "Confirmar (abre barrera)" → pasa a `pagado`, sale de la lista, entra en movimientos.
- [ ] Registrar entrada / cobrar salida / cortesía / anular siguen funcionando.

### 3.5 Panel → Locales (micrositio lo crea la administración)
- [ ] Toggle "Publicar micrositio" muestra/oculta los campos; vista previa del slug.
- [ ] Guardar con slug repetido → 409 "URL amigable ya está en uso" (no 500).
- [ ] Subir logo/portada (archivo) → devuelve URL y se ve la vista previa; pegar URL también.
- [ ] "Ver micrositio ↗" abre `/tienda/<slug>` en pestaña nueva.

### 3.6 Mi cuenta (comerciante) → Mi web
- [ ] Login por teléfono + código. Sin locales → mensaje claro.
- [ ] Sólo puede editar SUS locales (endpoint valida con `unit_residents`; ajeno → 403).
- [ ] Publicar/despublicar; subir logo/portada/galería; slug con colisión → 409.
- [ ] Guardar refleja los cambios en `/tienda/<slug>` y en el directorio.
- [ ] Con varios locales, el selector cambia entre ellos sin mezclar datos.

### 3.7 Subida de imágenes (ambos endpoints)
- [ ] Archivo no-imagen → error de cliente; > 6 MB → error de cliente; payload gigante → 413/limite.
- [ ] Sin auth (panel sin clave / portal sin token) → 401.
- [ ] Rate limit por ventana de 10 min.

---

## 4. Modos de falla a blindar (checklist de robustez)

- [ ] **Sin red / Supabase caído**: las páginas públicas degradan (portal → DEFAULT_STORES;
      `/tienda` → 404 controlado; parking → mensaje de error, no crash).
- [ ] **Entrada maliciosa**: todos los `text()`/límites aplican; nada de SQL crudo (queries
      parametrizadas por supabase-js). Slug siempre pasa por `slugify`.
- [ ] **Auth**: panel exige rol admin (owner/manager/support); portal exige token válido;
      un comerciante NO edita locales ajenos; subir imagen exige auth.
- [ ] **Rate limiting** en todos los POST públicos (checkin, pay, uploads).
- [ ] **Concurrencia de slug**: índice único `uq_units_microsite_slug`; colisión → 409 amigable.
- [ ] **Idempotencia de datos**: seeds y migración son idempotentes (add column if not exists,
      update por código).
- [ ] **Imágenes rotas**: siempre hay respaldo visual (gradiente/ícono); nunca tumban la página.
- [ ] **Moneda**: USD/VES respetado (símbolo $ / Bs) en parking y micrositio.
- [ ] **Zona horaria / reloj**: `computeParkingFee` nunca da minutos negativos ni NaN.

---

## 5. Self-prompt para reauditar en una sesión futura (copiar y pegar)

> Trabaja en el worktree `D:\Santo edit\.claude\worktrees\concepto-la-granja`.
> Audita de forma exhaustiva el centro comercial C.C. Concepto La Granja SIN
> romper nada. Pasos:
> 1) Corre `npx tsc --noEmit`, `npx vitest run` y `npx eslint --quiet` sobre los
>    archivos del mall (directorio, estacionamiento, micrositios, subida de
>    imágenes, panel de locales/estacionamiento, mi-cuenta). Arregla toda
>    regresión.
> 2) Revisa uno a uno los checklists de las secciones 3 y 4 de este documento.
>    Para cada caso borde no cubierto por un test, agrega un test de vitest sobre
>    la lógica pura (`src/lib/*`) o un guard en la ruta correspondiente.
> 3) Busca fugas de autorización: ¿algún endpoint público crea/edita datos sin
>    rate limit o sin validar propiedad? ¿algún endpoint del portal permite tocar
>    recursos de otro comerciante?
> 4) Verifica degradación con Supabase inaccesible: ninguna página pública debe
>    lanzar 500 sin control.
> 5) Reporta hallazgos con archivo:línea, aplica los arreglos de bajo riesgo, y
>    deja los de mayor impacto listados para aprobación. Commit descriptivo al
>    final; sin push ni merge salvo que se pida.
> Toma el tiempo que necesites; prioriza correctitud y no introducir fallos.

---

_Última actualización: 20 jul 2026. Mantener este archivo al día cuando se
agreguen funciones al centro comercial._
