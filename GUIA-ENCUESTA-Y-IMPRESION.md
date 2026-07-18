# Guía completa — Encuestas por WhatsApp + Impresión de tickets (Brotherhood)

Estado: **todo el software ya está construido, verificado y publicado** en
producción (brotherhood-xi.vercel.app). Lo único que falta es **conectar** la
cuenta de Meta del negocio y la(s) impresora(s). Esta guía separa:

- **Parte 1 — Lo que hace el DUEÑO** (WhatsApp Business, impresora, y prender
  los toggles en la app).
- **Parte 2 — Lo que hago YO** (la conexión técnica: variables + Meta).
- **Parte 3 — Cómo funciona por sede** (no hay mezclas).
- **Parte 4 — Prueba final** (conectar y probar).

---

## Parte 1 — Lo que hace el DUEÑO

### A) WhatsApp Business (para las encuestas automáticas)

Estos pasos van con la cuenta de Meta del negocio; por eso los hace el dueño
(o me da acceso y los hacemos juntos en una llamada de 15 min).

1. **Número de WhatsApp dedicado.** Un chip/número **solo para esto**. No lo
   puede tener abierto al mismo tiempo en el WhatsApp normal del teléfono: el
   sistema toma ese número para enviar las encuestas.
2. **Verificar el negocio en Meta Business.** Trámite donde se sube el RIF /
   registro mercantil. Meta tarda de unas horas a un par de días en aprobar.
3. **Método de pago (tarjeta) en la cuenta de WhatsApp.** Meta cobra unos
   centavos por cada mensaje que el sistema le inicia al cliente; sin tarjeta
   no deja enviar.
4. **Aprobar el formulario (Flow) y la plantilla** desde su WhatsApp Manager,
   o darme acceso para que yo lo deje listo.

> Resumen para el dueño: *"consígueme un número dedicado, verifica el negocio,
> pon una tarjeta en Meta, y aprueba el formulario y la plantilla. De la
> conexión técnica me encargo yo."*

### B) Impresora(s) de tickets

1. **Qué comprar:** una **impresora térmica de tickets de 80 mm** (papel
   térmico en rollo de 80 mm, sin tinta). Compatibles y económicas:
   Epson TM-T20III / TM-T88, Xprinter XP-80xx, 3nStar, Bixolon — cualquiera
   compatible con ESC/POS que el sistema operativo reconozca como impresora.
2. **Cómo conectarla:** el sistema imprime desde **Chrome**, así que la
   impresora se instala como una impresora normal del equipo:
   - **USB** → lo más simple y confiable (enchufada a la PC/laptop de caja,
     con su driver instalado).
   - **Red (WiFi/Ethernet)** → si se quiere compartir por IP.
3. **Para que imprima sola (sin diálogo cada vez):**
   - Poné la impresora térmica como **predeterminada** en ese equipo.
   - Abrí Chrome con el modo **kiosk printing** (bandera `--kiosk-printing`).
     Con eso, la comanda (al enviar a cocina) y el recibo (al marcar Listo)
     salen directo. Sin esa bandera, aparece el diálogo y hay que confirmar.
   - En Chrome, papel **80 mm** y márgenes **Ninguno** (el sistema ya fuerza
     80 mm).
4. **Cocina vs. caja (importante):** la impresión automática sale a la
   impresora **predeterminada de ese equipo**. Entonces:
   - **Un equipo con una impresora** → comanda y recibo salen ahí (lo común).
   - **Comanda en cocina y recibo en caja, cada uno a su impresora** →
     necesitas **dos equipos** (uno en cocina, otro en caja), cada uno con su
     impresora predeterminada y su panel abierto.

### C) En la app (Configuración) — prender lo que ya está listo

Todo esto ya está publicado; el dueño solo lo activa:

- **Encuesta post-venta:** prender "Encuesta post-venta" + "Enviar la encuesta
  automáticamente" + elegir los minutos de espera.
- **Moneda del sitio público:** elegir **Dólar ($)** o **Euro (€)**. Es solo
  estético para la página pública; los bolívares y el panel interno no cambian.
- **Impresión de tickets:** elegir **Sin impresión** o **Automático** (comanda
  al enviar a cocina + recibo al marcar Listo).

---

## Parte 2 — Lo que hago YO (conexión técnica)

Casi todo ya está hecho y deployado. Cuando el dueño tenga su cuenta de Meta
lista, la conexión es rápida:

1. **En developers.facebook.com** (con acceso a la cuenta del dueño): app con
   el producto WhatsApp → registrar el número → copiar el **Phone Number ID**;
   generar el **token permanente** (System User) y el **App Secret**.
2. **Importar el Flow:** WhatsApp Manager → Flows → Create → pegar el contenido
   de `docs/whatsapp-flow-encuesta.json` → Publicar.
3. **Aprobar la plantilla con botón de Flow** (cuerpo con `{{1}}` = nombre).
4. **Configurar el webhook en Meta:** Callback URL =
   `https://brotherhood-xi.vercel.app/api/whatsapp/webhook`, Verify token = el
   que yo defina, y suscribir el campo **messages**.
5. **Poner las variables en Vercel** (proyecto brotherhood) y **redeployar**
   (`npx vercel --prod`):
   - `WHATSAPP_BUSINESS_TOKEN`
   - `WHATSAPP_BUSINESS_PHONE_ID`
   - `WHATSAPP_SURVEY_FLOW_TEMPLATE`
   - `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
   - `WHATSAPP_APP_SECRET`
   - `WHATSAPP_TEMPLATE_LANG=es`
6. **Migración 0027:** ya aplicada.

> Ya deployado hoy: encuesta en WhatsApp (Flow) con el contenido del formulario
> de papel del dueño (Calidad del producto / Servicio / Ambiente + Sugerencias),
> moneda $/€ elegible, e impresión (comanda + recibo 80 mm por sede).

---

## Parte 3 — Cómo funciona por sede (no hay mezclas)

- El staff elige su sede y queda guardada en el navegador. **Cada llamada al
  servidor lleva la sede** (`x-branch-id`), así que todos los pedidos y datos
  que ve son **solo de esa sede**.
- El **recibo** muestra el nombre de **esa** sede en el encabezado, y el número
  de pedido ya trae el código de la sede (ej. `#40-SD`). Comanda y recibo salen
  con los datos de la sede donde se está operando.
- **Cada sede imprime lo suyo.** No se mezclan pedidos ni recibos entre sedes.

---

## Parte 4 — Prueba final (conectar y probar)

1. El dueño consigue número + verificación + tarjeta (Parte 1A) y la(s)
   impresora(s) (Parte 1B).
2. Yo conecto Meta y pongo las variables en Vercel + redeploy (Parte 2).
3. El dueño prende los toggles en Configuración (Parte 1C).
4. **Probar encuesta:** marcar un pedido de prueba como Entregado (o disparar
   `POST /api/surveys {action:"dispatch"}`) y confirmar que llega el WhatsApp
   con el formulario.
5. **Probar impresión:** con "Impresión → Automático", enviar un pedido a
   cocina (sale la comanda) y marcarlo Listo (sale el recibo).
