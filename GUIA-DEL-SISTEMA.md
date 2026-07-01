# Guía del sistema — Santo Perrito (POS multi-sucursal)

Esta guía explica, en lenguaje sencillo, cómo funciona el sistema hoy, cómo
entra cada persona con su usuario y contraseña, y cómo se garantiza que un
trabajador de una sede **no** pueda ver ni tocar la información de otra sede.

---

## 1. ¿Qué es y cómo está organizado?

Es un punto de venta (POS) para el restaurante, con **varias sedes/sucursales**
(por ejemplo: **San Diego** y **El Viñedo**). Cada sede tiene sus propios
pedidos, caja, inventario, mesas y reportes. La información **nunca se mezcla**
entre sedes.

- **Página pública** (menú del cliente): `/local-santo` es en realidad el panel
  privado del negocio; el menú del cliente se sirve aparte por sede.
- **Panel del dueño / staff**: se entra por `/local-santo`. Ahí están todas las
  tarjetas de módulos (Caja, Cocina, Delivery, Inventario, Reportes, etc.).
- **Cada módulo** vive en `/local-santo/<módulo>` (ej. `/local-santo/caja`,
  `/local-santo/usuarios`, `/local-santo/reportes`).

---

## 2. Cómo entra cada persona (usuario y contraseña)

**El login NO es por sede.** Todos entran por la misma pantalla, con su usuario
y contraseña personales. La sede se resuelve **automáticamente** según a qué
sede está asignado ese usuario (ver punto 4).

### Pasos para iniciar sesión
1. Abre la página de acceso: **`/acceso`**.
2. Escribe tu **usuario** (ej. `maria`, `jose`) — no hace falta correo. El
   sistema convierte `maria` en un correo interno `maria@santo.local`.
   Si tienes un correo real, también puedes usarlo.
3. Escribe tu **contraseña** (te la da el dueño; se puede restablecer desde
   el módulo de Usuarios).
4. Entras al panel `/local-santo` con **solo los módulos y la(s) sede(s)** que
   te fueron asignados.

### ¿Cómo sé en qué sede estoy trabajando?
- Dentro del panel, en la **cabecera**, aparece un banner grande:
  **“Estás viendo la sede: <nombre>”**.
- Si tienes acceso a **más de una sede**, ese mismo banner tiene un selector
  para cambiar de sede (la página se recarga y todo pasa a esa sede).
- Si solo tienes **una sede**, el banner solo muestra el nombre (no puedes
  cambiarlo — es correcto).
- Todos los pedidos y datos que ves debajo del banner son **solo de esa sede**.

> Nota técnica: la sede elegida se guarda en el navegador y se envía en cada
> llamada como cabecera `x-branch-id`. El servidor la valida contra tus sedes
> permitidas (ver punto 4).

---

## 3. Para el dueño: acceso a cada sede

El dueño (rol **owner**) tiene acceso a **todas** las sedes. Para revisar una
sede específica:

1. Entra a `/local-santo`.
2. En el banner de la cabecera, usa el selector **“Estás viendo la sede”** y
   elige, por ejemplo, **El Viñedo** o **San Diego**.
3. La página se recarga: pedidos, caja, inventario y reportes pasan a ser los
   de esa sede.

Para ver todo junto o comparar sedes, usa **Reportes** (`/local-santo/reportes`),
que incluye comparación por sucursal.

---

## 4. Aislamiento por sede (lo importante) — cómo se garantiza

**Objetivo:** un usuario de caja asignado a **El Viñedo** solo puede entrar a la
caja de El Viñedo y **nunca** a la de San Diego.

Así funciona:

1. **Asignación en el módulo de Usuarios** (`/local-santo/usuarios`):
   - Al crear o editar un trabajador, en la sección **“Sedes permitidas”**
     eliges **“Todas las sedes”** o marcas sedes específicas.
   - En la tabla de usuarios, la columna **“Sedes”** muestra con una insignia
     de color a qué sede(s) está asignado cada quien:
     - **Amarillo** = Todas las sedes (dueño/soporte).
     - **Azul** = una o varias sedes específicas.
     - **Rojo** = sin sede asignada (revisar).

2. **Refuerzo en el servidor (no se puede burlar):**
   - Aunque un usuario manipule manualmente la sede en el navegador, el
     servidor lo **“clampa”** a su primera sede permitida. Es decir: si un
     cajero de El Viñedo intenta pedir datos de San Diego, el sistema lo
     devuelve a El Viñedo y **nunca** lee ni escribe datos de San Diego.
   - Los roles **owner** y **support** son los únicos sin restricción (ven
     todas las sedes).
   - Esto lo controla `resolveBranchId()` en `src/lib/branch.ts`, usando las
     cabeceras `x-staff-role` y `x-staff-branch-ids`.

3. **Cada consulta filtra por sede:** todas las tablas operativas llevan
   `branch_id`, y hay una prueba automática (`branchIsolation.fitness.test.ts`)
   que verifica que ninguna consulta se “escape” de su sede.

**En resumen:** basta con asignar al trabajador su sede en Usuarios; el sistema
se encarga de que solo pueda operar en esa sede.

---

## 5. Roles y qué ve cada uno (resumen)

| Rol         | Sedes           | Módulos típicos                                   |
|-------------|-----------------|---------------------------------------------------|
| Dueño       | Todas           | Todo                                              |
| Encargado   | Las asignadas   | Caja, cocina, delivery, inventario, reportes…     |
| Caja        | Las asignadas   | Panel, Caja, Comprobantes, Tickets, Cuentas       |
| Mesonero    | Las asignadas   | Panel, Cuentas abiertas, Mesas, QR, Tickets       |
| Cocina      | Las asignadas   | Cocina, Cocina por producto, Tickets              |
| Delivery    | Las asignadas   | Delivery                                          |
| Soporte     | Todas           | Soporte, Usuarios, Sucursales, Configuración      |

Los módulos por rol se pueden ajustar por usuario (modo **“Personalizados”**)
en el módulo de Usuarios.

---

## 6. Preguntas frecuentes

- **Un cajero se queja de que no ve su caja:** revisa en Usuarios que tenga la
  sede correcta marcada y que su rol incluya el módulo **Caja**.
- **¿Cómo cambio la contraseña de alguien?** En Usuarios, botón **“Reset clave”**.
- **¿Cómo agrego una nueva sede?** En `/local-santo/sucursales`.
- **No veo el banner de sede:** significa que aún no hay sucursales activas
  creadas, o no se pudieron cargar. Crea/activa la sede en Sucursales.

---

_Última actualización: 2026-07-01._
