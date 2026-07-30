# Super-prompt — ENTREGA FINAL de Brotherhood (probar todo, módulo por módulo)

> Pega este archivo completo como PRIMER mensaje de una sesión nueva.
> Escrito el 2026-07-30, después de una ronda que dejó **447 checks de QA en
> verde** (más 639 tests unitarios) y cerró 4 fallas reales.
> **Objetivo de esa sesión: dejar el producto listo para entregar al cliente,
> con lo único pendiente siendo el montaje de WhatsApp en Meta (que depende del
> cliente, no de nosotros).**

---

## 0 · Contexto que no hay que volver a descubrir

- Repo `D:\Santo edit`, rama **`brotherhood-publico`**. El deploy es **manual**:
  `npx vercel --prod` desde la raíz del repo (proyecto Vercel `brotherhood`,
  alias vivo **brotherhood-xi.vercel.app**). No hay CI que despliegue.
- `.env.local` apunta al Supabase **REAL de producción** de Brotherhood
  (`fpujezdaauedjvnhjzws`). El dueño ya autorizó crear datos de prueba, pero
  todo lo que se cree lleva prefijo **`ZZTEST-`** y se borra al final.
- Sedes: **San Diego** `3d8a8527-4b0b-4c81-aeb7-0c69454c63f6` y
  **Viñedo** `04fb974d-bd2d-4086-ae9e-c74653309b04` (Viñedo es la principal,
  `sort_order` 1; una sede sin menú propio hereda el de la principal).
- **Migraciones: NO falta ninguna.** Verificado el 2026-07-30 con
  `npm run qa:migraciones` (26 tablas y 45 columnas declaradas existen en la
  base). Si ese script alguna vez sale en rojo, ahí está la lista exacta de
  `.sql` que hay que pegar en Supabase — **las aplica el usuario, no tú**.
- El menú real del cliente son **62 productos activos** (144 filas contando los
  desactivados). **Nunca los toques**: crea productos `ZZTEST-` y bórralos.
- **No vacíes ni borres `.vercelignore`**: sin él el deploy sube 18 GB con el
  código de otros clientes y sus `.env`.

### Estado del personal (importante para las pruebas de acceso)

Solo hay **3 usuarios individuales reales**: `caja1` y `caja2` (rol Caja) y
`cocina1` (rol Cocina). **El dueño NO tiene usuario individual**: entra con la
clave `ORDERS_OWNER_PASSWORD`. Los roles Encargado, Mesonero, Delivery y
Promotor tampoco tienen usuario: quien los use entra por la clave de su rol.
Esto importa porque **desactivar un usuario no revoca las claves por rol**
(ver §6, hallazgo A-1).

---

## 1 · Protocolo obligatorio (en este orden, sin saltárselo)

1. **`npm run backup`** antes de la primera escritura. Anota la ruta del JSON.
2. **Reinicia el dev server ANTES de correr cualquier suite.** Un `next dev`
   que lleva días corriendo responde **500 con cuerpo vacío** en rutas
   dinámicas y fabrica fallas fantasma (18 en una ronda de julio).
   Receta: matar el proceso del 3177 → `npx next dev -p 3177` → forzar el
   primer compile con `Invoke-WebRequest -TimeoutSec 480` a la raíz (tarda
   varios minutos en `D:`) → confirmar que el `<title>` dice Brotherhood.
   **Regla de oro: un 500 con `json: null` es el server; un 500 con
   `{error: …}` sí es del código.**
3. `npx tsc --noEmit` con el dev server **apagado** (si no, deja
   `.next/dev/types/*` corruptos; si pasa, borra esa carpeta).
4. Corre las suites **en serie**: comparten el freno de 10 pedidos/min por IP.
5. No verifiques por navegador salvo que el usuario lo pida: el pane se cuelga.
   Todo se prueba con scripts Node contra la API.

---

## 2 · Fase 0 — línea base de código

```bash
npx tsc --noEmit && npx vitest run && npm run lint && npm run build
```

Referencia del 2026-07-30: **tsc limpio, 639 tests en 87 archivos, lint 0
errores (31 avisos tolerados), build OK.** Cualquier número por debajo es una
regresión que se arregla antes de seguir.

---

## 3 · Fase 1 — batería automática completa (con los números de referencia)

Corre TODAS. Entre paréntesis, el resultado que dieron el 2026-07-30: si sale
menos, es regresión; si sale más, alguien añadió checks (actualiza este archivo).

| Comando | Referencia | Qué cubre |
|---|---|---|
| `npm run qa:migraciones` | TODO APLICADO | que la base tenga cada tabla/columna de las migraciones |
| `npm run qa:open-accounts` | 43/43 | ataque a cuentas abiertas de mesa |
| `npm run qa:payments` | 28/28 | comprobantes y reporte de pago del cliente |
| `npm run qa:day-close` | 21/21 | cierre del día real, con restauración |
| `npm run qa:branches` | 15/16 | sedes, QR, correlativo por sede (la falla S1 es conocida, ver §6) |
| `npm run qa:metodos-cobro` | 49/49 | los 10 métodos + mixto + parcial + desglose en el cierre |
| `npm run qa:cobros-origen` | 16/16 | cobro de cuenta de mesa vs cobro directo, separados |
| `npm run qa:dia-completo` | 40/40 | un día entero: insumos, recetas, rush, compra, anulación, cierre |
| `npm run qa:roles` | 18/18 | suplantación de sede y de rol a través del proxy |
| `npm run qa:usuarios` | 63/63 | matriz de 12 puertas × 6 roles, estados, cobros, permisos custom (U6b) y sedes obligatorias (U1b) |
| `npm run qa:desactivacion` | 25/25 | que desactivar/eliminar un usuario le cierre el acceso de verdad |
| `npm run qa:mesa-prefill` | 7/7 | precarga del cobro en pedidos de mesa |
| `npm run qa:isolation` | 28/28 | aislamiento entre sedes + desglose por sede del consolidado |
| `npm run qa:inventory` | 20/20 | alertas de inventario y transferencias |
| `npm run qa:inventory-deduct` | 19/19 | descuento de stock al vender |
| `npm run qa:training` | 21/21 | modo entrenamiento (los pedidos de práctica no cuentan) |
| `npm run qa:db-state` | informativo | fotografía de la base |
| `npm run e2e:purchase-inventory` | 9/9 | compra → inventario |
| `npm run e2e:supplier-payables` | 8/8 | cuentas por pagar |
| `npm run e2e:reports-2e` | 7/7 | reportes punta a punta |
| `npm run e2e:business-complexity` | 3/3 | perfiles de complejidad del negocio |
| `npm run e2e:order-idempotency` | 7/7 | que un pedido reenviado no se duplique |

**Total de referencia del 2026-07-30: 447 checks en verde**, con una sola falla
conocida (S1 de `qa:branches`, que es configuración del dueño — ver §6).
Suma los números de la tabla al terminar: si no llegas a 447, falta algo.

### Playwright (navegador) — receta aparte, y OJO con el `.env.local`

Playwright corre **solo contra la base de simulación**, nunca producción:

```bash
cp .env.local .env.local.produccion.bak && cp .env.simulacion .env.local && npx next build && npx next start -p 3181 && npx playwright test
```

Referencia: **15/15** (accesibilidad, PWA/offline, formularios responsive,
sesión y roles). **Al terminar hay que restaurar `.env.local` desde
`.env.local.produccion.bak`** — si te olvidas, todas las suites `qa:*` quedan
apuntando a la base de prueba y vas a "verificar" el sistema equivocado.
Comprobación rápida de en qué base estás:
`node -e "console.log(require('fs').readFileSync('.env.local','utf8').match(/SUPABASE_URL=(.*)/)[1])"`
→ producción es `fpujezdaauedjvnhjzws`, simulación es `gnyvdlxlrjwbsdctincy`.

⚠️ **Nunca corras dos lotes de suites a la vez ni cambies el `.env.local`
mientras corre uno**: cada script lee el archivo al arrancar, así que el
siguiente del lote leería la base equivocada.

---

## 4 · Fase 2 — módulo por módulo, en vivo

El guion completo está en **[`CHECKLIST-MODULOS-ENTREGA.md`](CHECKLIST-MODULOS-ENTREGA.md)**:
**61 módulos** con **369 pruebas** concretas (qué hacer y qué debe pasar),
levantadas leyendo el código el 2026-07-30. Ábrelo y trabájalo de arriba hacia abajo,
marcando cada casilla solo cuando la compruebes de verdad.

Los módulos que cubre, en el orden en que conviene probarlos:

1. Menú público (carta digital)
2. Sede del cliente y QR por sucursal
3. QR por mesa (pedido desde la mesa)
4. Carrito y checkout (Comer aquí / Pick up)
5. Delivery con mapa GPS y cobro por kilómetro
6. Cuenta abierta de mesa desde el teléfono + 'Pedir la cuenta'
7. Seguimiento del pedido y 'Tus pedidos'
8. Reportar mi pago (comprobantes del cliente)
9. Cancelar mi pedido (desde el cliente)
10. Reservas online
11. Encuesta post-venta
12. App instalable (PWA) y funcionamiento sin internet
13. Avisos al cliente cuando su pedido está listo
14. Caja (confirmar y cobrar)
15. Cocina
16. Cocina por producto
17. Mesonero (mesas y cuentas)
18. Delivery (ruta y WhatsApp)
19. Pantalla de despacho (TV del mostrador)
20. Tickets e impresión 80 mm
21. Comprobantes de pago
22. Panel general de pedidos
23. Cuentas abiertas de mesa (abrir, asociar pedidos, pedir la cuenta, separar)
24. Cobro de la cuenta completa y cierre / cancelacion de la cuenta
25. Caja: cobro de un pedido (metodos, mixto, parcial)
26. Comprobantes de pago (revision en caja)
27. Cierre de caja del dia
28. Historial de cierres
29. Gastos del dia
30. Control de gastos (tablero de egresos)
31. Reportes de ventas
32. Tablero del dueno
33. Atribucion de ventas por vendedor / por quien registro
34. Modo evento y comparativo de eventos
35. Politica de anulaciones (que pasa con el dinero y los insumos)
36. Inventario (insumos, movimientos y conteo físico)
37. Recetas de inventario (qué insumo gasta cada producto)
38. Descuento automático de stock al vender
39. Transferencias de inventario entre sedes
40. Alertas de inventario y reposición
41. Subrecetas (preparaciones base)
42. Proveedores
43. Compras a proveedores
44. Cuentas por pagar (deuda a proveedores y abonos)
45. Usuarios del personal (roles, permisos y sedes)
46. Acceso del personal (login y candado por módulo)
47. Auditoría (bitácora de quién hizo qué)
48. Soporte y planes (control del proveedor)
49. Modo entrenamiento
50. Avisos push al personal (alertas de anulación)
51. Respaldos y restauración de la base
52. Suite de pruebas de navegador (Playwright)
53. Editor de menú (productos)
54. Opciones avanzadas del producto (variaciones, adicionales, ingredientes, combos y plantilla armable)
55. Configuración del negocio (general)
56. Mesas y QR
57. Sucursales (incluye modo evento y enlaces por sede)
58. Configuración por sede
59. Clientes
60. Envío por distancia y zonas de delivery
61. Tasa de cambio y moneda

**Regla:** una prueba que no puedas hacer (falta la impresora, falta el dato del
cliente) no se marca ni se salta en silencio — se anota en el informe final
diciendo de qué depende.

## 5 · Fase 3 — integraciones y terceros

| Integración | Estado al 2026-07-30 | Qué hacer |
|---|---|---|
| **Push (VAPID)** | ✅ probado punta a punta (7/7) | producción YA tiene sus claves VAPID: **no las pises**. En iPhone el push solo funciona si el dueño agrega la app a inicio **desde Safari** (no Chrome). |
| **WhatsApp / Meta** | ⛔ **el único pendiente de la entrega** | app, token y webhook ya montados; el Flow está en borrador. Falta la **verificación del negocio en Meta**, que la hace el cliente con sus documentos. Hasta entonces la encuesta con botones y las plantillas quedan inertes (sin romper nada). |
| **Impresión 80mm** | funcional (comanda al enviar a cocina, recibo al marcar Listo) | probar con la impresora real del local: es lo único que no se puede simular. |
| **Mapa / delivery por km** | funcional | verificar que el link de Maps abra la ubicación correcta y que el cobro por distancia cuadre con la zona. |
| **Tasa de cambio** | funcional | confirmar que la tasa del día se refleje en los montos en Bs del cliente. |
| **Respaldos** | `npm run backup` / `npm run restore` | dejar un respaldo fresco el día de la entrega y explicarle al dueño cómo pedirlo. |

---

## 6 · Hallazgos abiertos — cerrar o decidir ANTES de entregar

### A-1 · Las claves por rol siguen abriendo aunque desactives al usuario (decisión del dueño)

Desactivar un usuario **sí funciona** (probado con control de causalidad en
`qa:desactivacion`): su token muere al instante, en todas las puertas, y
tampoco puede volver a entrar haciendo login de nuevo. **Pero** el panel acepta
además las **claves por rol** del `.env` (`ORDERS_OWNER_PASSWORD`,
`ORDERS_CASHIER_PASSWORD`, …, las 7 están configuradas en producción). Esas
claves no son de nadie: son del rol. Un empleado despedido que se la aprendió
entra igual, y en la auditoría aparecerá como el rol y no como la persona.

Y no es teórico: el 2026-07-30 se comprobó que **la misma clave del `.env.local`
abre la API de producción desde internet** (`GET /api/reports?scope=all` contra
brotherhood-xi.vercel.app respondió 200 con las ventas del día). No hay
restricción por IP ni por dispositivo — es así por diseño, porque es como entra
el dueño, pero significa que quien tenga la clave ve las ventas desde donde sea.

Opciones para el dueño (hay que preguntarle, no decidirlo solo):
1. **Rotar las claves** cada vez que alguien sale (rápido, pero se repite).
2. **Crear usuario individual a cada quien** (incluido el dueño) y **quitar del
   Vercel las claves por rol** que ya no hagan falta — así desactivar sí es
   definitivo y la auditoría dice nombres. Es lo recomendado.
3. Dejarlo como está, sabiendo que la clave compartida es la llave maestra.
   Revisar además que ninguna clave sea corta: `ORDERS_SUPPORT_PASSWORD` da
   acceso a **todo** (incluido cambiar el plan).

### C-1 · Ninguna sede tiene WhatsApp de contacto configurado

Es la falla S1 de `qa:branches`, y **no es del código**: el botón "Enviar por
WhatsApp" existe pero el número está vacío en las dos sedes. Lo carga el dueño
en *Sucursales → Configuración por sede*. Sin eso, el cliente no tiene a dónde
escribir.

### Lo que YA se probó y quedó cerrado (no lo vuelvas a investigar)

Auditoría del 2026-07-30 sobre la cadena de acceso. Cada punto se comprobó
**usando el sistema**, no leyendo el código:

- ✅ **Desactivar a un empleado funciona de verdad** (`qa:desactivacion`, 25/25,
  con control de causalidad: al reactivarlo el MISMO token vuelve a servir). Le
  cierra las 5 puertas que abría, es inmediato (el proxy revalida contra la base
  en cada petición, sin caché) y aunque vuelva a hacer login desde cero el token
  nuevo no abre nada.
- ✅ **"Reset clave" TAMBIÉN lo expulsa.** Una revisión automática dijo que no
  (porque el código no llama a `signOut`), pero al probarlo el token viejo
  respondió **401** y la clave vieja dejó de servir: Supabase revoca la sesión al
  cambiar la contraseña. **No es un hueco — no pierdas tiempo ahí.**
- ✅ **Un `NULL` en `is_active` no puede revivir a un despedido**: la columna es
  `NOT NULL` en la base (probado forzándolo, la base lo rechaza).
- ✅ **ARREGLADO — los permisos personalizados eran cosméticos en 3 rutas**: al
  recortarle los módulos a un encargado, el menú los escondía pero la API seguía
  sirviéndole gastos del día, historial de cierres y comprobantes. Ahora las tres
  (más el cierre de caja y la revisión de comprobantes) verifican el permiso del
  usuario y no solo su rol. Cubierto por el caso U6b de `qa:usuarios`.
- ✅ **ARREGLADO — usuarios sin sucursal asignada**: guardar a alguien con "todas
  las sedes" desmarcado y ninguna sede tildada se aceptaba, y esa persona
  terminaba operando en la sede por defecto (sus ventas se atribuían a una
  sucursal que nadie le asignó). Ahora se rechaza con 400. Caso U1b.

- ✅ **ARREGLADO — logos de OTROS clientes descargables desde el dominio de
  Brotherhood.** En `public/` vivían 5 imágenes (Santo Perrito, Santo Cachón,
  Bambucha, 6,8 MB) sin una sola referencia en el código, servidas con **HTTP
  200** en `brotherhood-xi.vercel.app/logo-santo-perrito.png`. Cualquiera que
  probara esa URL veía que el sistema es una plantilla compartida — y exponía
  también a los otros tres negocios. Quitadas del repo (siguen en el historial
  de git si alguna vez se necesitan). **Al revisar: comprueba que esas URLs
  ahora den 404 y busca si quedó alguna otra imagen ajena en `public/`.**
- ⚠️ **Pendiente de decidir: las páginas `/previa`, `/previa/idea-3`, `idea-4` e
  `idea-5`** son borradores internos de diseño y están públicas en el dominio del
  cliente. No filtran marcas ajenas, pero son trabajo interno a la vista. Se
  pueden borrar o dejar; decidirlo antes de entregar.

### Endurecimiento recomendado (hoy no abre puertas, pero conviene)

Sale de la misma auditoría, a nivel de código. **Ninguno de estos se logró
explotar**; se listan para decidirlos con calma, no para alarmarse:

1. **La sesión del panel no caduca por inactividad.** La tablet de caja queda
   logueada con el último que entró, así que cualquiera que la agarre opera con
   ese rol sin escribir clave. Es el riesgo más real del día a día y se resuelve
   con un cierre automático a los 30-60 minutos sin uso.
2. **Al desactivar no se revoca la sesión en Supabase Auth.** Hoy da igual
   (cada petición revalida la base), pero si algún día alguien le pone caché a
   esa validación para "ahorrar viajes", el desactivado recuperaría acceso
   durante la ventana del caché. Una línea (`auth.admin.signOut`) lo blinda.
3. **`is_active === false` debería ser `!== true`** (denegar por defecto), por si
   una migración futura deja la columna nullable.
4. **`getRawBusinessConfig` se traga los errores y devuelve `{}`**: si la lectura
   de configuración falla, los usuarios restringidos podrían quedar con acceso a
   todas las sedes. Conviene que falle cerrado.
5. **El login reescribe el bloque completo de permisos**, así que un cambio de
   permisos hecho justo mientras alguien entra podría revertirse.
6. **Los permisos personalizados de un segundo "dueño" no se aplican** (para
   owner/support el sistema siempre da todo). Si se le pone un socio o el
   contador como dueño acotado, la pantalla lo guarda pero no lo limita.
7. **Bajar de rol conserva la lista de módulos vieja**: un ex-dueño degradado a
   cajero puede quedarse con los módulos que tenía.

> Dos de las revisiones automáticas (la de las claves compartidas y la de
> cliente-vs-servidor) se cayeron por sobrecarga del servicio y **quedan por
> repetir**. El análisis de las claves compartidas se hizo a mano y está en A-1.

### Otros pendientes que dependen del cliente
- Precios definitivos de las hamburguesas (los confirma el dueño).
- Datos reales de Zelle y transferencia (hoy hay datos de relleno en el
  checkout que el dueño tiene que reemplazar por los suyos).
- Los +15 de la cuenta de Mesa 1 (ajuste puntual que pidió el dueño).

---

## 7 · Fase 4 — datos con los que se entrega

Confirmar que al momento de entregar esté cargado y visible:

- **Menú real**: 62 productos activos con foto y descripción, en Viñedo
  (San Diego lo hereda), con la plantilla armable en las 68 hamburguesas.
- **Mesas y QR** por sede, descargables e imprimibles.
- **Insumos precargados** para que el dueño practique el módulo de compras
  (creados el 2026-07-30 en Viñedo, **son datos reales: no los borres**):
  FAC-00612 La Espiga $56 *Pagada* · FAC-04178 Beef Center $180 *Parcial*
  (abono Zelle $100, vence 06/08) · ND-0295 El Bodegón $95.50 *Pendiente*
  (vence 14/08) · REC-1188 El Trigal **Bs 6.500** *Pendiente* (vence 01/08).
- **Usuarios del personal**: caja1, caja2, cocina1 activos (ver §0 y A-1).
- **Guías para el cliente** que ya existen en el repo y hay que repasar antes de
  entregar: `GUIA-DUENO.md`, `GUIA-DEL-SISTEMA.md`, `GUIA-MULTISEDE.md`,
  `GUIA-ENCUESTA-Y-IMPRESION.md`, `CHECKLIST-CLIENTE-NUEVO.md`.

---

## 8 · Checklist de entrega (lo que se le muestra al cliente)

- [ ] Fase 0 en verde (tsc, tests, lint, build).
- [ ] Batería completa corrida, con la tabla de §3 actualizada y sin fallas
      nuevas (solo las conocidas de §6).
- [ ] Todos los módulos de §4 probados en vivo y anotados.
- [ ] Deploy hecho con `npx vercel --prod` y **verificado en
      brotherhood-xi.vercel.app** (no confundir "está en la rama" con "está en
      vivo": el vivo suele ir atrasado).
- [ ] Versión del service worker subida si cambió algo del cliente (si no, el
      dueño sigue viendo lo viejo por la caché de la PWA).
- [ ] Respaldo fresco del día guardado.
- [ ] Los datos de §7 cargados y a la vista.
- [ ] Los puntos de §6 conversados con el dueño y decididos.
- [ ] Informe final con números: checks OK, qué se arregló, qué queda pendiente
      y **de quién depende cada pendiente**.

---

## 9 · Reglas que no se negocian

- Las migraciones **las aplica el usuario**: tú escribes el `.sql` y avisas.
- Prefijo `ZZTEST-` en todo lo creado; cada suite limpia y **verifica** su
  limpieza (0 filas al final, en tablas y en Supabase Auth).
- No toques los 62 productos del menú real ni las 4 compras precargadas.
- No borres ni vacíes `.vercelignore`.
- No verifiques por navegador salvo pedido explícito.
- Al terminar: commit por fases y actualizar la memoria del proyecto.
