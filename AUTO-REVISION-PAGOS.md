# Auto-revisión Brotherhood — matriz de escenarios de pago/estado

> Prompt de auto-revisión (pedido del dueño 2026-07-23). Antes de dar por
> bueno cualquier cambio que toque checkout, caja, estados o delivery, correr
> mentalmente (y en preview cuando aplique) TODOS estos escenarios. La regla
> madre: **nada se marca pagado ni reportado si falta una pata**, y **el
> cliente nunca ve un paso/CTA que ya no aplica**.

## Cómo usarla en una sesión
Di: "lee AUTO-REVISION-PAGOS.md y corre la matriz" — se revisa cada fila
contra el código actual y se marca ✅/❌ con evidencia (archivo:línea o
captura del preview). Prohibido crear pedidos de prueba en la BD real.

## Matriz principal: método de pago × qué debe pasar

| # | Escenario | Al registrar | Seguimiento (/pedido) | Caja |
|---|---|---|---|---|
| 1 | Pick up · Pago móvil (electrónico puro) | Exige método; sin captura si el modo "antes" está apagado | "Esperando pago" + CTA reportar; reportado→"Comprobante recibido/revisando"; caja cobra→"Pagado" | Cobrar precarga Bs+monto; aviso ámbar si no hay comprobante electrónico |
| 2 | Pick up · Efectivo en divisas | Foto de billetes si el flag está prendido; billete elegido viaja | "Esperando pago" (sí aplica a efectivo); SIN CTA de captura (efectivo se paga en mano) | Precarga "Efectivo divisas"+monto; billete/vuelto visible; sin aviso ámbar |
| 3 | Delivery · Mixto Pago móvil + Efectivo divisas | Ambos métodos y AMBOS montos obligatorios (si falta: error rojo EN la sección mixto + scroll); foto de billetes solo cubre la pata efectivo | Con solo la foto: **"falta la parte electrónica (Pago móvil: Bs X)"** — NO se da por reportado; con las dos: "revisando" | Precarga ambos métodos y montos; aviso ámbar mientras falte el comprobante electrónico |
| 4 | Mesa (Comer aquí) | Sin método obligatorio; si eligió Mixto, debe completarlo | 3 pasos de siempre (sin "Esperando pago") | Cuenta abierta/mesa; sin prefill de método |
| 5 | Pedido viejo (payment_method NULL) | n/a | 3 pasos (degrada sin romper) | Sin precarga (no hay dato) — normal |

## Estados del pago del cliente (excluyentes, en orden)
1. **Sin reportar** → CTA "Reportar mi pago" + datos para pagar (Paso 1/2).
2. **Reportado a medias** (solo foto de efectivo en mixto) → aviso ámbar "falta la parte electrónica (método: monto)" + CTA "Reportar la parte electrónica". NUNCA "ya reportado".
3. **Reportado completo, sin confirmar** → "Comprobante recibido: el local está revisando tu pago". SIN datos de pago, SIN botón grande (solo enlace discreto "¿captura equivocada?"). El pedido NO avanza a "Recibido".
4. **Confirmado/cobrado** → "✅ Pedido pagado", línea avanza sola. NUNCA vuelven a salir métodos de pago ni advertencias.
5. **Corrección pedida** → vuelve el flujo completo de reporte.

## Sedes y delivery
- Cotización SIEMPRE con la sede del checkout (header `x-branch-id` explícito
  en la cotización Y en el registro; no confiar solo en localStorage).
- Cambiar de sede DESPUÉS de marcar ubicación → se recotiza sola con la sede
  nueva (efecto en CartDrawer); si la sede nueva no llega, error claro.
- El costo se suma al total apenas hay cotización; el servidor recalcula al
  crear el pedido (no confía en el monto del cliente).
- Maps: link POR SEDE (Sucursales → alimenta "Cómo llegar" de esa sede) ≠
  link GLOBAL (Configuración → botón de la barra). No se heredan entre sí.
- Sede en los datos: pedidos Pick up NUNCA se clasifican Delivery (el
  teléfono NO es señal de delivery; solo dirección/zona/costo>0).

## Notificaciones (push por pedido, suscripción del botón "Avisarme")
- Hitos que avisan: entró a cocina (Preparando), pago registrado (Pagado),
  Listo, Entregado, y revisión del comprobante (confirmado/rechazado/corregir).
- iPhone: solo con la app instalada (agregar a pantalla de inicio); sin
  soporte, el botón no aparece y el polling de 10s sigue mandando.

## Reglas duras de regresión
- La creación del pedido NUNCA registra montos recibidos ni pone "Pagado"
  (el cobro es de caja o del comprobante confirmado).
- `payment_proofs` de método con "efectivo" no cubren la pata electrónica.
- Anulación automática: solo métodos electrónicos, nunca efectivo puro.
- Caja "Cobrar": si el pedido trae método del cliente y no hay cobro previo,
  el modal abre precargado (métodos + montos + moneda) y es editable.
- La línea de pasos (4 pasos) debe caber a 320px sin cortarse.
- Todo select/columna nueva de BD debe existir en `supabase/migrations/`
  (guard `dbColumnsExist.fitness.test.ts`).

## Verificación mínima por lote
`npx tsc --noEmit` + `npx vitest run --dir ./src` + `npm run build` (log
limpio) + preview CDP de: menú público, checkout mixto, /pedido con pago a
medias, caja Cobrar. Subir caché del SW si se toca UI pública. Deploy
`npx vercel --prod --yes` + `git push origin brotherhood-publico`.
