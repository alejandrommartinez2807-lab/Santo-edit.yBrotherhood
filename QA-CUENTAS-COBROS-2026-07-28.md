# QA — Cuentas abiertas + métodos de cobro + cierre (2026-07-28)

Rama `brotherhood-publico`. Encargo del dueño: revisar si las **cuentas abiertas** están
funcionando, si los **métodos de cobro** ("están como raros") se guardan de verdad, y si
todo queda bien conectado con **caja, cocina, mesonero, cierre del día e historial de
cierres** — probándolo con pedidos y dinero reales.

**Respaldo previo:** `backups/santo-backup-2026-07-28T13-55-37.json` (909 filas, 19 tablas).

## Resultado en una línea

**Todo el circuito del dinero funciona y cuadra al centavo.** 154 comprobaciones
automatizadas: **149 pasan**; las 5 que no, son 3 hallazgos ya conocidos de la ronda de
ayer (ninguno pierde dinero) y 2 falsas alarmas de mi propio script que quedaron
corregidas. **No apareció ningún bug nuevo en el código.**

El único "bug" grande del día no estaba en el código: ver §1.

---

## 1. El hallazgo más importante: el dev server viejo fabricaba fallas fantasma

La primera corrida salió con **18 fallas** que daban miedo: cobros directos con 500,
cerrar cuentas con 500, "Atendida" sin efecto, cambios de estado que no aplicaban, el
cierre del día con cobrado=$0. Parecía el sistema entero roto.

**Era el servidor, no el código.** El `next dev` del puerto 3177 llevaba corriendo desde
ayer a través de varios commits y respondía **500 con cuerpo VACÍO** (ni siquiera JSON)
en todas las rutas dinámicas (`PATCH /api/orders/[id]`, `[accountId]`, …), de forma
intermitente. Con el servidor reiniciado, **las mismas 18 pruebas pasaron**.

**Regla para el futuro** (quedó en `PROMPT-QA-CUENTAS-COBROS.md`): un 500 con `json:
null` es el server dañado; un 500 con `{error: …}` sí es del código. Reiniciar el dev
server ANTES de cualquier ronda de QA.

---

## 2. Cuentas abiertas — 42/43 ✓ (server fresco)

`npm run qa:open-accounts` — el ataque completo de ayer, repetido hoy:

- Dos cobros **concurrentes** sobre la misma cuenta → la suma exacta, sin pisar dinero.
- Pedir la cuenta: idempotente, con freno **por mesa** (la mesa que martilla recibe 429
  y la de al lado sigue en 200), aislado por sede (QR de B no toca cuentas de A → 404).
- El marcador `[CUENTA_PEDIDA:…]` convive con notas con corchetes, se limpia al cobrar/
  cerrar/"Atendida", y no se imprime en ningún ticket (fitness test lo vigila).
- "Agregar pedido": nace en la sede y mesa correctas, ya asociado; cuenta de otra sede → 404.
- Cuenta cerrada: cobrarla → 409, cerrarla dos veces → 409, pedir la cuenta → 404.
- 12 cuentas a la vez: totales exactos; `table_id` con config divergida no rompe.

La única falla es la **conocida A3/B-2**: un staff que escriba el marcador a mano en la
nota al abrir la cuenta puede fingir que el cliente pidió la cuenta (requiere credenciales
de staff; riesgo bajo; pendiente de decisión).

## 3. Métodos de cobro — el corazón del encargo — 49/49 ✓

Script **nuevo** `npm run qa:metodos-cobro` (`scripts/qa-metodos-cobro-cierre.mjs`):

### M1 · El catálogo completo, un cobro real por método

| Método | Cobrado | Quedó en la BD |
|---|---|---|
| Efectivo divisas | $10 | ✓ con su etiqueta, Pagado |
| Zelle | $10 | ✓ |
| Binance | $10 | ✓ |
| USDT | $10 | ✓ |
| Transferencia internacional | $10 | ✓ |
| Pago móvil (Bs) | Bs 200 | ✓ equiv $5 exacto |
| Punto (Bs) | Bs 200 | ✓ |
| Transferencia (Bs) | Bs 200 | ✓ |
| Efectivo Bs | Bs 200 | ✓ |
| Biopago (Bs) | Bs 200 | ✓ |
| **Mixto en caja** ($12 Zelle + Bs 320 Pago móvil) | $20 | ✓ las dos columnas, Pagado |
| **Pago parcial** ($5 de $15, Efectivo divisas) | $5 | ✓ "Pago parcial", pendiente $10 |

**Sobre "los métodos raros":** una variante mal escrita **no crea un método nuevo** —
`"  zelle  "` se guarda como `Zelle`, `"PAGOMOVIL"` como `Pago móvil`, y un método
inventado (`"CryptoInventado X"`) cae en `Otro`. El cierre nunca va a mostrar etiquetas
duplicadas tipo "zelle" y "Zelle" por separado: los normalizadores de
`src/lib/localOrderMoney.ts:108-172` lo impiden en la entrada.

### M2 · La cuenta abierta conectada con cocina, mesonero y caja

Ciclo completo verificado: abrir cuenta → 2 pedidos que **nacen asociados** (por
`openAccountId` y por `attachToTableOpenAccount`) → totales recalculados solos ($30) →
**cocina**: "Preparando" arranca el cronómetro (`kitchen_started_at`), "Listo" aplica →
**entrega por producto**: la burger se marca entregada (con quién), el refresco queda
pendiente, desmarcar limpia → "Entregado" desde la cuenta estampa **todos** los productos
→ **cobro FIFO en dos tandas con métodos distintos**: $18 Efectivo divisas caen en el
pedido más viejo, Bs 480 por Punto en el segundo, cada uno con SU método en SU columna →
con pendiente $0 y `closeIfPaid` la cuenta **se cierra sola** y el cierre se propaga a
los pedidos.

### M3 · El cierre de caja y el historial guardan el desglose por método

- El cierre (`day_closes.data`) conserva `paymentByUSDMethod` y `paymentByVESMethod`
  **método por método y al centavo**: los 6 métodos USD y los 5 VES con sus montos
  exactos ($33 Efectivo divisas, $26 Zelle, … Bs 680 Pago móvil, Bs 680 Punto, …).
- El **historial** (`GET /api/day-closes`, lo que ve el dueño en `local-santo/cierres`)
  devuelve el desglose completo al releer; el Zelle del historial cuadra con lo cobrado.
- **La suma del desglose == lo cobrado total** (ni un método se pierde): $110 = $110.
- Restauración verificada: el cierre de prueba se borró, los 23 comprobantes y los 5
  cierres reales quedaron intactos.

Nota técnica: el desglose por método solo se guarda si el módulo **caja** está activo en
el plan (`canIncludeCashierAudit`, `src/app/api/day-close/route.ts:379-384`). Hoy está
activo — si algún día el desglose sale vacío en el historial, mirar ahí primero.

## 4. Lote de pagos y cierre del día — re-verificados

- `npm run qa:payments` — **27/28** ✓: dos comprobantes a la vez suman sin pisarse, la 2ª
  pata del mixto suma sola, el techo del total se respeta, método único sigue aceptando
  captura o referencia. La falla es la **conocida P3/P-1**: la API acepta referencia de 4
  dígitos (la regla de 6 vive solo en el navegador; caja revisa a ojo, sin pérdida de dinero).
- `npm run qa:day-close` — **21/21** ✓: cierre real por sede, aislamiento (cerrar San
  Diego no toca Viñedo), gasto marcado Cerrado sin doble descuento, efectivo+Bs == cobrado,
  y el cierre es fotografía (no altera reportes).
- `npm run qa:branches` — **15/16** ✓: correlativos por sede, QR, historial. La falla es
  la **conocida S1/C-1**: ninguna sede tiene WhatsApp configurado (tarea del dueño, no código).

## 5. Falsa alarma corregida en mi propio script

`setItemDelivered` daba 500 en mi primera versión porque yo mandaba **solo** `lineId`, y
mis ítems sintéticos (creados por API sin ese campo) lo tenían null. El panel real
(`OpenAccountsPanel.tsx:524-530`) manda la cadena completa `lineId + productId +
itemName` y **funciona siempre** — verificado. El script quedó calcado al panel: 49/49.

(Anotación menor, misma familia que lo ya reportado ayer: cuando la API no identifica el
producto responde 500 con `{error}`, sería más limpio un 400. Cosmético.)

## 6. Verificación de código y limpieza

- `npm run lint` → **0 problemas** (con los scripts nuevos incluidos).
- Sin cambios en `src/` — solo scripts de prueba, prompt y este informe (tsc/vitest/build
  sin motivo para moverse; la línea base de ayer fue 543 tests en verde).
- Residuos: **0 filas ZZTEST** en orders, open_accounts, inventory_items, suppliers y
  menu_products; comprobantes 23→23; historial de cierres 5→5. El menú real (62
  productos) intacto.

## 7. Qué queda pendiente (igual que ayer, nada nuevo)

1. **WhatsApp de las sedes vacío** (C-1) — configuración del dueño.
2. **Subir al servidor** la regla de 6 dígitos de referencia y la foto del billete (P-1).
3. Decidir qué hacer con el **marcador falsificable por staff** (B-2, riesgo bajo).
4. Cruces entre sedes responden 500/`ok:true` en vez de 403/404 (bloquean bien; cosmético).

## 8. Herramientas que deja esta ronda

- `npm run qa:metodos-cobro` — el script nuevo (49 checks), enganchado en `package.json`.
- `PROMPT-QA-CUENTAS-COBROS.md` — el auto-prompt para repetir toda esta ronda en una
  sesión nueva, con la lección del server viejo incluida.
