# Guía del sistema — C.C. Concepto La Granja

Sistema integral de administración y sitio público del centro comercial.
**En vivo:** https://concepto-la-granja.vercel.app

---

## 1. Qué es y cómo está organizado

Una sola plataforma con **dos caras**:

- **Sitio público** (para visitantes y comerciantes): directorio de tiendas, mapa, reserva de citas médicas, pago de estacionamiento, atención al cliente y la cuenta del comerciante.
- **Panel administrativo** (para la administración del centro): locales, contratos, cobranza, estacionamiento, publicidad, consultorios, fidelidad, seguridad y más — **19 módulos**.

Todo se guarda en una base de datos privada (Supabase). Cada acción sensible queda registrada (auditoría) y hay **respaldo automático diario**.

---

## 2. Accesos

| Quién | Dónde | Cómo entra |
|---|---|---|
| Visitante | `/portal` (inicio público) | Libre |
| Comerciante | `/mi-cuenta` | Teléfono + código (se lo da la administración) |
| Administración | `/panel` | Clave por rol |

**Rol y clave del panel:** cada rol tiene su propia clave (se configuran en Vercel: `ORDERS_OWNER_PASSWORD` = dueño/administrador general, y otras por rol). El dueño entra con la clave de dueño y ve todo.

---

## 3. El sitio público

### 3.1 Inicio / Directorio — `/portal`
- **Directorio de tiendas** con filtros por rubro (moda, comida, salud, banca, etc.).
- Sección de **servicios** (estacionamiento, planta eléctrica, feria, torre médica…).
- **Alquila tu local** (botón a WhatsApp) y acceso del comerciante.
- Cada tienda muestra su nombre, rubro, piso y logo (se cargan desde el panel → Locales).

### 3.2 Mapa / directorio por piso — `/mapa`
Las tiendas agrupadas por nivel (Planta baja, Mezzanina, Feria, Torre médica…) para orientar al visitante.

### 3.3 Consultorios / citas online — `/consultorios`
El visitante: **elige especialista → elige fecha → ve los cupos libres → reserva** con su nombre y teléfono. La cita queda "solicitada" y la administración la confirma desde el panel. (Los cupos salen del horario semanal de cada doctor; no permite doble reserva del mismo cupo.)

### 3.4 Estacionamiento — `/estacionamiento`
El cliente **escanea el QR de su ticket** (o escribe el código) y ve **cuánto debe** en tiempo real, con botón para reportar el pago por WhatsApp. Sin hacer fila en caja.

### 3.5 Atención al cliente — `/contacto`
Formulario público para **reclamos, sugerencias, objetos perdidos, solicitudes de local o propuestas de proveedores**. Cada mensaje llega al panel (módulo Atención al cliente).

### 3.6 Cuenta del comerciante — `/mi-cuenta`
El comerciante entra con **teléfono + código** (la administración se lo genera). Ahí ve: su **estado de cuenta** (canon + condominio), puede **reportar su pago**, reservar áreas comunes, reportar incidencias, ver comunicados, votar en asambleas, registrar visitas y ver documentos.

---

## 4. El panel administrativo (`/panel`)

### Núcleo comercial

**Resumen (tablero gerencial)**
KPIs en tiempo real: locales (ocupados/disponibles), contratos activos y **por vencer**, **morosidad** (monto y nº de locales) e **ingresos del mes por fuente** (canon, condominio, renta %, estacionamiento, publicidad). Botones de **respaldo** (descargar / respaldar ahora).

**Locales**
Ficha de cada local: código, **nombre comercial**, **rubro**, logo, piso, m², **alícuota** (su % de participación en los gastos comunes) y **estado** (disponible / ocupado / reservado / mantenimiento). Es lo que alimenta el directorio público.

**Comerciantes**
Datos del comerciante (propietario/inquilino), vínculo con su local y botón **🔑 acceso** para generarle el código con el que entra a `/mi-cuenta`.

**Contratos**
Contrato de arrendamiento por local: **canon** mensual + moneda, **depósito** de garantía, vigencia (inicio/fin), día de vencimiento, recargo por mora, **fiador** y **renta porcentual** (cobra un % de las ventas del local por encima de un mínimo). Avisa de los contratos **por vencer** (≤ 60 días).

**Ventas (renta %)**
Cada mes registras las **ventas brutas** de los locales con renta porcentual; el sistema calcula la renta estimada en vivo. (Si el local usara nuestro POS, estas ventas entrarían solas.)

**Canon y condominio**
Botón para **emitir el cobro del mes**: reparte el gasto común por alícuota (condominio) **y** agrega el canon de cada contrato **y** la renta porcentual — en un solo recibo por local, con su vencimiento.

**Estado de cuenta**
Registra y **confirma pagos** (los que reporta el comerciante o los que registras tú), aplica el pago a los cargos y baja el saldo. Aquí ves quién está al día y quién moroso.

### Operación del centro

**Estacionamiento**
Configuras **tarifas** (gracia, tarifa por hora, tope diario). Registras **entradas** (genera un código/QR), ves los vehículos **adentro ahora** con tiempo y monto en vivo, y con un clic **cobras la salida** (cálculo automático), das **cortesía** (validada por un local) o **anulas**. También manejas **abonos** mensuales / vehículos autorizados.

**Publicidad y espacios**
Catálogo de espacios (pantallas, vallas, banners, pasillos, redes, web) con su precio, y las **contrataciones** por período (cliente, precio, estado, arte y evidencia de instalación).

**Consultorios**
Alta de **doctores** (especialidad, teléfono, tarifa), su **horario semanal** (por día, con duración del cupo) y la **agenda de citas** (confirmar / marcar atendida / cancelar). Lo que reservan en `/consultorios` cae aquí.

**Atención al cliente**
Bandeja de **casos** (reclamos, sugerencias, objetos perdidos, solicitudes). Cada caso tiene prioridad y estado (nuevo → en proceso → resuelto → cerrado).

**Fidelidad**
Clientes del programa con sus **puntos** y nivel (general/plata/oro). Acumulas puntos por compra o los **canjeas**; queda el historial de movimientos.

### Comunidad y soporte (heredado, funcionando)

- **Galería** — fotos del centro que se muestran en el portal.
- **Áreas comunes** — crear áreas y aprobar/rechazar reservas.
- **Incidencias** — tickets de mantenimiento reportados por comerciantes.
- **Comunicados** — avisos de la administración a los comerciantes.
- **Asambleas** — votaciones ponderadas por alícuota.
- **Accesos** — visitas y encomiendas.
- **Documentos** — reglamentos y archivos para los comerciantes.

---

## 5. Flujos clave (paso a paso)

**Dar de alta un local y su comerciante**
1. Panel → **Locales** → "+ Nuevo local" (código, nombre comercial, rubro, piso, alícuota, estado).
2. Panel → **Comerciantes** → "+ Nuevo comerciante" → "+ vincular" a su local.
3. (Opcional) botón **🔑 acceso** para darle entrada a `/mi-cuenta`.

**Hacer un contrato y cobrarlo**
1. Panel → **Contratos** → "+ Nuevo contrato" (local, canon, vigencia, depósito, renta % si aplica).
2. Cada mes: **Ventas (renta %)** → cargar ventas de los locales con % (si aplica).
3. **Canon y condominio** → "Emitir cobro del mes" (pon el gasto común total y el vencimiento).
4. **Estado de cuenta** → confirma los pagos que llegan.

**Estacionamiento (entrada y salida)**
1. **Estacionamiento** → "Tarifas" (una vez).
2. Entrada: escribe la placa → "+ Entrada" (genera el código/QR).
3. Salida: en "Adentro ahora" → "Cobrar salida" (o "Cortesía").

**Una cita médica**
- El paciente reserva en `/consultorios`. Tú la confirmas en Panel → **Consultorios**.
- Antes, cada doctor necesita su **Horario** cargado (botón "Horario").

**Un reclamo del público**
- Llega por `/contacto` → aparece en **Atención al cliente** → cambias prioridad y estado hasta resolverlo.

---

## 6. Datos de prueba cargados (demo)

El sistema viene con datos de ejemplo para mostrarlo funcionando: **40 locales** (con disponibles y en mantenimiento), 8 comerciantes con contratos (2 con renta %), el **cobro del mes emitido** (2 locales pagados y 3 morosos), **5 doctores** con horario, estacionamiento con vehículos adentro y cobrados, 3 campañas de publicidad activas, 6 clientes de fidelidad y 4 casos de atención.

> Para operar de verdad, se reemplazan por los datos reales (o se parte de una base limpia). El seed es opcional y no se vuelve a cargar solo.

---

## 7. Seguridad y respaldo

- Cada rol entra con su clave; el portal del comerciante es sin contraseña (código de un solo uso).
- La base de datos está cerrada: solo el servidor accede con llave de servicio.
- **Respaldo automático diario** + botón para respaldar/descargar cuando quieras (Resumen).
- Auditoría: queda registrado quién hizo cada acción sensible.

---

## 8. Qué queda por hacer (opcional)

- Que el **comerciante reporte sus propias ventas** desde `/mi-cuenta` (hoy las carga la administración).
- **Bitácora de seguridad** dedicada (vigilantes/turnos/incidentes con foto).
- Cargar **imágenes/logos reales** de cada local en el directorio.
- Integraciones futuras: facturación fiscal homologada (SENIAT), lectura de placas (ANPR), cámaras y sensores.

---

*Sistema desarrollado sobre el motor propio (multi-sede, multimoneda USD/Bs, PWA, offline-tolerante). Deploy independiente en Vercel + Supabase.*
