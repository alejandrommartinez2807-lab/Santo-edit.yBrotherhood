# Opciones del flujo de pedidos — para el dueño

Este documento explica, en cristiano, las decisiones que **tú** puedes tomar
sobre cómo funciona tu página de pedidos. Todo se cambia desde el panel
**Configuración** (entrando como dueño). No necesitas tocar nada de programación:
son interruptores y un par de números.

Al final de cada punto dice **qué recomendamos**. Si tienes dudas, quédate con la
recomendación: está pensada para que el cliente no se pierda y tú no pierdas plata.

---

## 1. ¿El cliente paga ANTES de registrar, o registra y reporta el pago después?

Hay dos maneras de trabajar:

- **Registrar y reportar después** (lo normal): el cliente arma su pedido, pone
  su nombre y teléfono, y el pedido queda guardado. Luego paga y sube su
  comprobante (captura o referencia). Caja lo confirma y ahí entra a cocina.
  - *Ventaja:* el cliente no se traba; siempre queda el pedido registrado.
  - *Riesgo:* alguien puede registrar y no pagar (para eso está la anulación
    automática del punto 2).

- **Pagar antes de registrar**: con métodos electrónicos (pago móvil,
  transferencia, Zelle…), el cliente **no puede** terminar el pedido sin adjuntar
  primero la captura o la referencia completa.
  - *Ventaja:* nada entra sin comprobante; menos pedidos fantasma.
  - *Riesgo:* un paso más para el cliente; alguna persona mayor puede frustrarse.

**Dónde se cambia:** Configuración → interruptor *"Comprobante antes de registrar"*
(campo técnico: `publicPaymentBeforeRegisterEnabled`).

**Qué recomendamos:** empieza con **registrar y reportar después** + anulación
automática encendida (punto 2). Es lo más amable para el cliente y te protege
igual. Cambia a "pagar antes" solo si ves muchos pedidos sin pagar.

---

## 2. ¿A los cuántos minutos se anula solo un pedido sin pagar?

Cuando un pedido de **pick up o delivery** con método **electrónico** no reporta
su pago, el sistema puede anularlo solo después de X minutos. Mientras tanto, al
cliente le van llegando recordatorios (a los 5, 10, 15 y 20 minutos).

- **0 = apagado:** ningún pedido se anula solo. Tú decides a mano en Caja.
- **Cualquier número (ej. 15):** si a los 15 minutos no reportó el pago, el
  pedido se anula solo y su inventario se devuelve.

Importante: esto **solo** aplica a métodos electrónicos en pick up/delivery. Un
pedido en mesa o en efectivo **nunca** se anula solo (esos se pagan al final).

**Dónde se cambia:** Configuración → *"Minutos para anular pedido sin pago"*
(campo técnico: `publicUnpaidAutoCancelMinutes`).

**Qué recomendamos:** **15 minutos.** Da tiempo de sobra para pagar sin dejar
pedidos fantasma trabando la cocina. Si tu clientela es mayor o paga lento, sube
a 20–25. Si prefieres controlar todo a mano, ponlo en 0.

---

## 3. ¿El método de pago queda FIJO o el cliente lo puede cambiar al reportar?

Cuando el cliente reporta su pago, puede pasar que al final pagara distinto a lo
que eligió al pedir.

- **Cambiable (recomendado):** el cliente puede corregir el método al reportar
  (ej. dijo "pago móvil" pero al final pagó en Zelle), siempre que cubra el total.
- **Fijo:** el método que eligió al pedir no se puede cambiar al reportar.

**Dónde se cambia:** Configuración → *"Cliente puede cambiar método de pago"*
(campo técnico: `publicPaymentMethodChangeEnabled`).

**Qué recomendamos:** **cambiable.** La vida real es así: la gente a veces paga
con otra cosa. Dejarlo fijo genera reclamos por WhatsApp.

---

## 4. ¿La promoción se muestra como una sección de la página o como ventana emergente?

Puedes anunciar tu promoción de dos formas:

- **Sección dentro de la página:** aparece como un bloque más del menú. El
  cliente la ve al bajar. Discreta.
- **Ventana emergente (pop-up):** salta al abrir la página. Imposible de ignorar.

**Dónde se cambia:** Configuración → *"Promoción como ventana emergente"*
(campo técnico: `promotionPopupEnabled`). Los textos e imagen de la promo se
editan en los mismos campos de promoción de siempre.

**Qué recomendamos:** **ventana emergente** cuando tengas una promo fuerte que
quieras que TODOS vean (ej. 2x1 del fin de semana). Para algo permanente o suave,
déjala como **sección** para no cansar al cliente que entra a diario.

---

## 5. Código de anulación (ya está encendido)

Para anular un pedido en Caja hace falta un **código que solo ves tú (el dueño)**.
Cuando alguien pide anular, te llega el código por notificación (y por WhatsApp
cuando se conecte). Ni el encargado ni el cajero ven ese código: es tu control
sobre las anulaciones.

- El **motivo** de cada anulación queda guardado y aparece en el cierre de caja y
  en el historial de cierres, para que sepas por qué se cayó cada pedido.
- Si activaste las notificaciones en tu teléfono, el código y el aviso te llegan
  por ahí. (En iPhone: agrega la página a la pantalla de inicio **desde Safari**
  para recibir notificaciones.)

**Dónde se cambia:** Configuración → *"Anulación requiere código del dueño"*
(campo técnico: `cancellationApprovalRequired`). Recomendamos **dejarlo encendido**.

---

## Resumen de la configuración recomendada

| Opción | Recomendado |
| --- | --- |
| Pago antes vs. reportar después | **Reportar después** |
| Minutos de anulación automática | **15** |
| Método de pago | **Cambiable** |
| Promoción | **Pop-up** para promos fuertes, **sección** para lo permanente |
| Código de anulación | **Encendido** |

Cualquier ajuste que hagas se aplica de una vez en la página del cliente. Si algo
no te cuadra, cámbialo y pruébalo: nada de esto es permanente.
