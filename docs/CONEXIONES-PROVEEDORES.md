# Guía de conexión con proveedores externos (paso a paso)

> Esta guía es para **ti (el dueño)**. Son los trámites y datos que hay que
> conseguir con cada proveedor para que el sistema los use. Cada sección dice:
> **qué es**, **qué tienes que hacer tú**, **qué datos traer** y **dónde se
> pegan** en nuestro panel. Lo técnico (el código que consume esos datos) ya lo
> dejamos listo con provider "manual" hasta que tengas las credenciales.

Regla de oro: mientras no tengas las credenciales reales, el módulo funciona en
modo **manual/prueba** (no rompe nada). El día que las consigas, las pegas y con
un botón queda vivo.

> **En el panel:** cada módulo dueño del trámite (Facturación, Canales, Pagos
> online, CRM) muestra una tarjeta **"Conexión con proveedor"** con esta misma
> guía resumida, qué credencial falta y un registro del avance (modo manual /
> trámite en curso / credenciales listas + nota). Ahí llevas el estado sin
> salir del sistema.

---

## 1. Odoo (LA principal — sincronización de un botón)

**Qué es:** el cliente ya lleva su contabilidad/ERP en Odoo. Nosotros NO
competimos con eso: nos enchufamos y le sumamos toda la parte hotelera. Con un
botón se sincronizan huéspedes, productos, facturas y pagos hacia Odoo.

**Qué tienes que hacer tú (una sola vez, con el cliente):**

1. Entra a la instancia de Odoo del cliente como **Administrador**.
2. Activa el **modo desarrollador**: Ajustes → (abajo del todo) *Activar el modo
   de desarrollador*. Esto habilita la API externa.
3. Crea (o pide) un **usuario dedicado** para la integración, p. ej.
   `integracion.hotel@cliente.com`, con permisos de Ventas, Contabilidad,
   Contactos e Inventario. Mejor un usuario aparte que uno personal.
4. Genera una **clave de API (API Key)** de ese usuario:
   Ajustes → Usuarios → (el usuario) → pestaña **Seguridad de la cuenta** →
   *Nuevas claves de API* → ponle nombre "Hotel Santo" → **copia la clave**
   (Odoo la muestra UNA sola vez; si la pierdes, generas otra).
5. Anota el **nombre de la base de datos** de Odoo. Si no lo sabes: aparece en la
   URL de login (`.../web/login?db=NOMBRE`) o en Ajustes → Información del sistema.

**Datos a traer (4):**
- **URL** de Odoo (ej: `https://cliente.odoo.com`)
- **Base de datos** (ej: `cliente-prod`)
- **Usuario** (el login, ej: `integracion.hotel@cliente.com`)
- **API Key** (la clave larga que copiaste)

**Dónde se pegan:** Panel → **Odoo / ERP** → *Conexión* → pegar los 4 datos →
botón **“Probar conexión”** (debe decir "Conectado como uid N"). Luego botón
**“Sincronizar ahora”**.

**Costo:** ninguno de nuestro lado. Odoo lo paga el cliente (ya lo tiene).

**Nota:** funciona con Odoo Online (odoo.com), Odoo.sh y Odoo autohospedado,
versión 14 o superior (la API Key existe desde la 14). Si es Odoo 13 o anterior,
en vez de API Key se usa la contraseña del usuario (menos seguro; recomiéndale
actualizar).

---

## 2. Facturación electrónica / máquina fiscal (SENIAT)

**Qué es:** en Venezuela la factura fiscal válida la emite una **imprenta digital
autorizada** por el SENIAT (no vale un PDF cualquiera). El proveedor más usado es
**The Factory HKA** (marca *La Factura Digital*); otros: Tfhka, Digital, Sygno.

**Qué tienes que hacer tú:**

1. Contrata el plan de facturación digital con el proveedor (The Factory HKA:
   thefactoryhka.com.ve). Te piden el **RIF** del negocio y documentos del
   representante legal.
2. El proveedor te da acceso a su **portal** y credenciales de su **API/web
   service**: normalmente **usuario**, **contraseña/token** y el **RIF emisor**
   ya habilitado.
3. Pide expresamente el **ambiente de pruebas (demo/homologación)** primero, y
   luego el de **producción**. Son credenciales distintas.
4. Verifica que tu **numeración de facturas y notas** esté habilitada en su
   portal (correlativos autorizados por el SENIAT).

**Datos a traer:**
- **Usuario** y **Token/Clave** del web service
- **RIF emisor** habilitado
- **URL del ambiente** (demo y producción)

**Dónde se pegan:** Panel → **Facturación** → *Facturación electrónica* →
credenciales del proveedor. Hoy exportamos el libro de ventas en CSV
(estilo SENIAT); con estas credenciales, además emitiremos la factura fiscal.

**Costo:** plan mensual/anual del proveedor (lo paga el cliente). Suele cobrarse
por volumen de documentos.

---

## 3. Channel Manager / OTAs (Airbnb, Booking, Expedia)

**Qué es:** que el cupo y las tarifas se sincronicen con los portales donde el
hotel también se anuncia, para no vender la misma habitación dos veces.

Hoy ya soportamos **iCal (importar bloqueos)** — la vía gratis y sin trámite.
Para el push completo de tarifas hace falta un intermediario.

### Opción A — iCal (gratis, ya funciona)
1. En Airbnb: Calendario → Disponibilidad → **Sincronización de calendarios** →
   *Exportar calendario* → copiar la URL `.ics`.
2. En Booking (Extranet): Tarifas y disponibilidad → **Sincronización de
   calendarios** → copiar la URL de exportación.
3. **Dónde se pegan:** Panel → **Canales** → cada habitación → pegar la URL iCal
   externa → *Sincronizar ahora*. Y copia NUESTRA URL iCal de esa habitación y
   pégala en Airbnb/Booking para el sentido inverso.

**Costo:** gratis. **Límite:** iCal actualiza cada pocas horas y solo mueve
bloqueos, no tarifas.

### Opción B — Channel Manager real (push de tarifas, de pago)
Si el cliente vende fuerte por OTAs, contrata un CM como **SiteMinder**,
**Cloudbeds** o **Hotelmize**. Te dan una **API key** y un mapeo de habitaciones.
Eso ya es un proyecto aparte (fase futura); trae la API key cuando la tengas y
la enchufamos.

---

## 4. Pasarela de pago (cobro online real)

**Qué es:** hoy el huésped **reporta** el pago (referencia + captura) y el staff
lo concilia a mano (esto ya funciona, provider "manual"). El paso siguiente es
que el banco confirme el pago automáticamente (C2P).

**En Venezuela, opciones reales:**
- **C2P / Botón de pago** de un banco (Banesco, Mercantil, BNC): se solicita como
  **comercio afiliado**. Trámite con tu ejecutivo del banco; te dan credenciales
  de comercio (código de afiliación + clave).
- **Agregadores:** Cashea, PagoFlash, Instapago — cuenta de comercio + API key.
- **Stripe/PayPal:** en la práctica NO operan para cobros locales en Venezuela;
  solo sirven si el hotel cobra a extranjeros en divisas por otra vía.

**Qué tienes que hacer tú:**
1. Ir al banco/agregador como **persona jurídica** (RIF + documentos del negocio).
2. Solicitar el **servicio de comercio C2P / botón de pago**.
3. Traer las **credenciales de comercio** (código de afiliación, clave/API key,
   y el ambiente de pruebas si lo dan).

**Dónde se pegan:** Panel → **Pagos online** → tarjeta *Pasarela de pago C2P*
(ahí llevas el estado del trámite). Los datos de cobro del modo manual (pago
móvil, Zelle, etc.) siguen editables en **Configuración** → *Métodos de pago*.

**Costo:** comisión por transacción (la fija el banco/agregador).

---

## 5. Envío de marketing (email / SMS)

**Qué es:** hoy segmentamos huéspedes y **copiamos la lista** para pegar en
WhatsApp (provider "manual"). Para enviar correos masivos de verdad hace falta un
proveedor de envío.

**Recomendado: Resend** (resend.com) o **SendGrid**. Pasos con Resend:
1. Crea una cuenta (tiene plan gratis para empezar: ~3.000 correos/mes).
2. **Verifica el dominio** del hotel: te da unos registros **SPF/DKIM** (TXT/CNAME)
   que hay que agregar en el DNS del dominio (donde compraste `tuhotel.com`).
   Esto evita que los correos caigan en spam.
3. Crea una **API Key** en el panel de Resend → cópiala.

**Datos a traer:**
- **API Key** de Resend/SendGrid
- **Dominio verificado** (ej: `reservas@tuhotel.com`)

**Dónde se pegan:** Panel → **CRM** → *Campañas* → proveedor de envío. Hoy las
plantillas de mensaje y la segmentación ya están; falta solo enchufar el envío.

**Costo:** gratis para empezar; luego por volumen de correos.

---

## Resumen: qué depende de terceros y qué no

| Proveedor | ¿Necesita trámite externo? | ¿Ya funciona en manual? | Prioridad |
|---|---|---|---|
| **Odoo** | Solo pedir API Key al cliente (gratis) | — (es el nuevo conector) | 🔴 Alta |
| Fiscal SENIAT | Sí, contratar imprenta digital | Sí, exporte CSV | 🔴 Alta |
| OTAs iCal | No (gratis) | ✅ Ya funciona | 🟢 Hecho |
| OTAs push real | Sí, contratar CM | Parcial (iCal) | 🟡 Media |
| Pago C2P | Sí, afiliar comercio al banco | Sí, reporte manual | 🟡 Media |
| Email marketing | Sí, cuenta + verificar dominio | Sí, copiar a WhatsApp | 🟢 Baja |

**Lo más rápido para empezar a vender:** conseguir la **API Key de Odoo** del
cliente (sección 1) — con eso demuestras la sincronización de un botón, que es el
argumento central. Lo demás se va enchufando cuando el cliente traiga cada
credencial.
