# Guía para el dueño — Encuestas por WhatsApp e impresión de tickets

Esta guía es para que **tú, el dueño, hagas todo lo que puedas por tu cuenta**.
Lo que necesita a tu técnico está marcado con **[Técnico]** para que sepas qué
pedirle. Todo el sistema ya está listo; solo falta conectarlo.

---

## 1) Encuesta por WhatsApp (calificación automática del cliente)

**Qué logras:** un rato después de que el cliente recibe su pedido, le llega
solo un mensajito por WhatsApp para calificar (Calidad del producto, Servicio,
Ambiente + sugerencias). Tú ves los resultados en el panel.

**Lo que haces TÚ (en Meta / Facebook Business):**
1. Consigue un **número/chip de WhatsApp nuevo**, dedicado solo para esto. Ojo:
   ese número no lo podrás usar al mismo tiempo en el WhatsApp normal del
   teléfono.
2. Entra a **business.facebook.com** y crea/abre la cuenta del negocio.
3. Inicia la **verificación del negocio** (te pedirán RIF / registro
   mercantil). Puede tardar de unas horas a un par de días.
4. Agrega una **tarjeta (método de pago)** en la cuenta de WhatsApp. Meta cobra
   unos centavos por cada mensaje que se le envía al cliente.

**Lo que hace tu técnico [Técnico]:** conectar ese número al sistema (app en
Meta, token, formulario y plantilla del mensaje, y el "webhook"). Tú solo le
pasas acceso o hacen una llamada corta juntos.

**Al final, tú prendes la encuesta en la app** (ver punto 3).

---

## 2) Impresora de tickets (comanda de cocina + recibo del cliente)

**Qué logras:** al enviar un pedido a cocina se imprime la **comanda** (sin
precios), y al marcarlo **Listo** se imprime un **recibo** para el cliente
(productos + total). Cada sede imprime lo suyo.

**Lo que compras TÚ:**
- Una **impresora térmica de tickets de 80 mm** (usa papel térmico en rollo,
  no usa tinta). Modelos comunes y económicos: Epson TM-T20III, Xprinter
  XP-80xx, 3nStar, Bixolon.

**Lo que conectas TÚ:**
1. Conecta la impresora al computador de caja por **USB** (lo más fácil) e
   instala su driver (viene en un CD o se descarga de la marca).
2. En el computador, ponla como **impresora predeterminada**.
3. Abre el panel del sistema en **Google Chrome**.
4. Para que imprima **sola** (sin preguntarte cada vez), pídele a tu técnico
   que te deje Chrome en modo "kiosk printing" **[Técnico]** — es un ajuste de
   una sola vez en ese computador.
5. En la ventana de impresión de Chrome, elige papel **80 mm** y márgenes
   **Ninguno**.

**Cocina y caja por separado (opcional):** si quieres que la comanda salga en
una impresora en la cocina y el recibo en otra en la caja, necesitas **dos
computadores** (uno en cada punto), cada uno con su impresora predeterminada.

---

## 3) En la app — lo que TÚ prendes (Configuración)

Entra al panel → **Configuración**. Todo esto ya está listo, solo lo activas:

- **Encuesta post-venta:** enciéndela, activa **"Enviar la encuesta
  automáticamente"** y elige a los cuántos minutos sale.
- **Moneda del sitio público:** elige **Dólar ($)** o **Euro (€)** — es solo
  el signo que ven los clientes en la página; no cambia los cálculos ni los
  bolívares.
- **Impresión de tickets:** elige **Automático** para que salgan la comanda y
  el recibo solos (o **Sin impresión** si no quieres imprimir).

---

## 4) Cómo se usa día a día

- **Encuesta:** no haces nada; sale sola después de cada pedido de delivery o
  pick up con teléfono. Revisa los resultados en el módulo **Encuestas**.
- **Impresión:** cuando en caja envías un pedido a cocina, sale la comanda;
  cuando lo marcas Listo, sale el recibo. Automático.

---

## 5) Resumen de lo que le pides a tu técnico [Técnico]

1. Conectar el número de WhatsApp al sistema (Meta + variables + webhook).
2. Dejar Chrome en modo impresión automática (kiosk printing) en el/los
   computador(es) de caja.

Con eso, y tus pasos de arriba, queda todo funcionando.
