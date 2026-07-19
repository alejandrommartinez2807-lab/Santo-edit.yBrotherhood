# Guía del sistema — Apartamentos Palulu

Cómo funciona **todo** y cómo se maneja el día a día. El sistema tiene **dos caras**:

- **Pública** — la ven los prospectos y los residentes (sin clave del panel).
- **Privada** — el **Panel administrativo**, solo para la administración/junta.

**Direcciones:**
| Qué | URL |
|---|---|
| Página pública (promoción) | `/` |
| Cuenta del residente | `/mi-cuenta` |
| Panel administrativo | `/panel` |

---

## 1) Lado público

### 1.1 Página pública `/` — para **promocionar y vender**
Es una web de bienvenida del edificio. Incluye:
- **Portada** con el nombre del edificio y botones de contacto.
- **Disponibilidad**: muestra automáticamente las unidades marcadas como **“desocupada”** en el panel (código, torre, m², puestos). Cada una tiene botón **“Consultar”** que abre **WhatsApp**.
- **Áreas comunes**: se arman solas con las amenidades cargadas.
- **Galería**: fotos del edificio y apartamentos (ver 2.7). Con lightbox (clic para ampliar).
- **Banner “¿Ya vives aquí?”** que lleva a la cuenta del residente.

> Regla clave: **para que un apartamento aparezca “disponible” en la web, su estado debe ser “desocupada”** en Unidades. Cuando se ocupa, se cambia a “activa” y desaparece de la promo.

### 1.2 `/mi-cuenta` — el residente entra a su cuenta
- El residente entra con **su teléfono + un código de 6 dígitos** (sin contraseñas ni apps que instalar).
- El **código se lo genera la administración** desde el panel (Residentes → 🔑 acceso).
- Adentro tiene **pestañas**:
  - **Cuenta**: su(s) unidad(es), saldo, cargos, recibos y pagos. Botón **“Reportar mi pago”** (monto, método, referencia) → queda pendiente para que la administración lo confirme.
  - **Reservas**: reserva un área común (elige área, fecha y hora); ve sus reservas y su estado.
  - **Incidencias**: reporta una avería/queja y sigue su estado.
  - **Avisos**: los comunicados publicados por la administración.
  - **Votar**: participa en las votaciones abiertas (un voto por unidad, ponderado por alícuota).
  - **Visitas**: pre-autoriza una visita y obtiene un **código para la garita**.
  - **Documentos**: reglamento, actas y estados financieros publicados.

---

## 2) Lado privado — el Panel `/panel`

Se entra con la **clave por rol** (la administración tiene la suya). Menú a la izquierda con los módulos.

### 2.1 Resumen
Tablero con: **unidades, residentes, suma de alícuotas** (te avisa si no da 100 %) y **saldo por cobrar** (morosidad total). Aquí también está el **Respaldo** (ver 3).

### 2.2 Unidades  ⭐ (base de todo)
Cada unidad (apartamento/PH/local) tiene:
- **Código** (ej. A-12B), **torre**, **piso**, **tipo**, **área**, **estacionamientos**.
- **Alícuota (%)** = el porcentaje de participación de esa unidad en los gastos del condominio. **Es la pieza más importante**: con ella se reparte la cuota y se pondera el voto.
- **Estado**: `activa` (ocupada, se le cobra), `desocupada` (disponible → sale en la promo, **no** se le cobra), `en_mora`, `inactiva`.

> **Regla del 100 %**: la **suma de todas las alícuotas debe dar 100 %**. El Resumen y la pantalla de Unidades lo verifican y avisan en rojo si no cuadra.

### 2.3 Residentes
- Datos de la persona (nombre, documento, teléfono, email).
- **Vincular a unidades** por rol: propietario / inquilino / autorizado / familiar (una persona puede tener varias unidades).
- **🔑 acceso**: genera el **código** para que el residente entre a `/mi-cuenta`. Se le entrega por WhatsApp. Se puede regenerar cuando sea necesario.

### 2.4 Cuotas (emisión del mes)
1. Se pone el **gasto común total** del mes (lo que hay que repartir).
2. Al **Emitir cuotas**, el sistema **prorratea por alícuota**: cada unidad ocupada recibe su **cargo** (`cuota = gasto total × su alícuota`) y su **recibo**, y se le sube el saldo.
3. Las unidades **desocupadas no se cobran**.
> No se puede emitir dos veces el mismo mes (evita duplicar).

### 2.5 Estado de cuenta (pagos)
- Lista cada unidad con su **saldo**.
- **Registrar pago**: se ingresa monto/método/referencia → el pago **se aplica a los cargos pendientes** (del más viejo al más nuevo) y **baja el saldo**.
- Si un residente **reporta** un pago, aparece arriba para **Confirmar** o **Rechazar**.

### 2.6 Galería
- Sube **fotos reales** del edificio/apartamentos: por **URL** o **subiendo el archivo** desde el equipo (JPG/PNG/WEBP, hasta 6 MB).
- Esas fotos se muestran en la **página pública**. Mientras no subas ninguna, la web usa **imágenes de ejemplo**.

### 2.7 Áreas comunes
- Crea las áreas (salón, parrillera, cancha…) con su **costo** y si **requieren aprobación**.
- Las reservas que hacen los residentes llegan aquí; si el área requiere aprobación, las **apruebas o rechazas**. Si tienen costo, el cargo cae solo al estado de cuenta de la unidad.

### 2.8 Incidencias
- Ves todas las incidencias reportadas por los residentes. Cambias su **estado** (abierto → en proceso → resuelto → cerrado). El residente ve el avance desde su cuenta.

### 2.9 Comunicados
- Publica avisos (con categoría, y opción de **fijar arriba**). Aparecen al instante en la pestaña **Avisos** de cada residente.

### 2.10 Asambleas y votaciones
- Crea una **votación** con su pregunta y opciones. Los residentes votan desde su cuenta (**un voto por unidad, ponderado por alícuota**). Ves los **resultados en vivo** con barras. Puedes **cerrar/reabrir** la votación.

### 2.11 Accesos y encomiendas
- **Visitas**: las visitas pre-autorizadas por los residentes aparecen con su código; la garita marca **“Entró/Salió”** (queda bitácora).
- **Encomiendas**: registras un paquete recibido y luego marcas **“Entregada”** (con quién lo retiró).

### 2.12 Documentos
- Sube el **reglamento, actas y estados financieros** (por URL o archivo). Eliges si son visibles para **residentes** o **solo junta**. Los residentes los ven en su pestaña **Documentos**.

---

## 3) Respaldos (datos delicados)
- **Automático**: se hace un respaldo **todos los días** a la nube (guarda todas las tablas, conserva los últimos 30).
- **Manual**: en Resumen, **“Respaldar ahora”** (guarda en la nube) o **“Descargar respaldo”** (baja un archivo `.json` a tu equipo).
- Recomendación: **descarga un respaldo antes de cualquier cambio grande** (cargar el edificio, cerrar el mes).

---

## 4) Flujos paso a paso (recetas)

### 4.1 Montar el condominio (primera vez)
1. **Unidades**: carga todas, con su **alícuota**. Verifica que el Resumen muestre **100 %**.
2. Marca como **“desocupada”** las que están en venta/alquiler (saldrán en la promo).
3. **Residentes**: crea cada propietario/inquilino y **vincúlalo a su unidad**.
4. **🔑 acceso** a los que usarán el portal; pásales su código por WhatsApp.
5. **Galería**: sube fotos del edificio.
6. Descarga un **respaldo**.

### 4.2 Cobranza del mes (cada mes)
1. **Cuotas** → gasto común total del mes → **Emitir**.
2. Avisa a los residentes (ven su cuota en `/mi-cuenta`).
3. A medida que pagan, **Estado de cuenta → Registrar pago** (o **Confirmar** los reportados).
4. Revisa la **morosidad** en el Resumen.

### 4.3 Dar de baja / publicar una unidad
- ¿Se desocupó? Ponla **“desocupada”** → aparece en la web como disponible.
- ¿Se ocupó? Ponla **“activa”** → se le empieza a cobrar y sale de la promo.

---

## 5) Roles
`admin` (todo) · `junta` (lectura + aprobaciones) · `contador` (finanzas) · `conserje` (recepción) · `seguridad` (garita) · `mantenimiento` · `soporte` (nosotros). El residente **no** usa el panel; usa `/mi-cuenta`.

## 6) Preguntas frecuentes
- **El residente perdió su código** → Residentes → 🔑 acceso (genera uno nuevo; el anterior deja de servir).
- **La alícuota no da 100 %** → revisa/edita las unidades hasta que el Resumen quede verde.
- **Una foto no se ve** → vuelve a subirla (archivo) o usa otra URL.
- **¿Se puede administrar más de un edificio?** → sí, el sistema es multi-condominio (cada edificio con sus unidades/residentes/cuentas).
