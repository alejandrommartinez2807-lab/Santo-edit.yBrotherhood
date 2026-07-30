# Informe de seguridad — 30 de julio de 2026

> Escrito para el dueño, no para un técnico. Todo lo que dice aquí se
> **ejecutó** contra el sistema real y se comprobó mirando la base de datos, no
> razonando sobre el código. Los ataques crearon sus propios pedidos de prueba
> y los borraron al terminar (verificado: 0 restos).

---

## En una frase

Se encontraron y se **cerraron dos agujeros graves**: cualquiera desde internet
podía (1) ver quién está sentado en cada mesa y cuánto debe, y (2) cargarle
comida a la cuenta de una mesa ocupada.

**Ya está publicado y comprobado EN VIVO.** Después de subirlo se repitieron
los mismos ataques contra brotherhood-xi.vercel.app: **8 de 8 bloqueados**.
Antes del despliegue, esa misma dirección devolvía "Carlos" al preguntar por la
Mesa 1; ahora no devuelve ningún nombre.

---

## Agujero 1 · Cualquiera veía quién está sentado en cada mesa

**Qué pasaba.** La dirección que usa el teléfono del cliente para consultar la
cuenta de su mesa no pedía ninguna clave, y los nombres de mesa se adivinan
solos (Mesa 1, Mesa 2, Barra…). Cualquier persona, desde su casa, podía
recorrer el local completo.

**Lo que devolvió el ataque, tal cual:**

| Mesa | Nombre que entregó | Deuda que entregó |
|---|---|---|
| Mesa 1 | Carlos | $485,96 |
| Mesa 4 | local1 cuenta | $96,50 |
| Mesa 6 | Carlos | $12,50 |

Se barrieron 8 mesas sin ninguna clave; 3 tenían cuenta abierta y las 3
entregaron el nombre.

**Un detalle que casi se me escapa.** Al quitar el nombre, volví a medir la
respuesta completa en vez de dar el arreglo por bueno — y el nombre **seguía
saliendo, repetido dentro de cada uno de los 8 pedidos de la mesa**, junto con
el detalle de lo que se había comido. El primer arreglo solo había tapado la
mitad. Quedó corregido y la prueba automática ahora busca el nombre en **toda**
la respuesta, no en el campo donde uno espera encontrarlo.

**Cómo quedó.** El nombre ya no viaja a ninguna parte de esa respuesta. Los
montos sí se quedan: son los que la propia mesa ve cuando pide su cuenta desde
el teléfono, y quitarlos rompería esa pantalla. **Esto no cambió ni un pixel de
lo que ve el comensal** — el nombre se enviaba pero la pantalla nunca lo
mostraba.

**Comprobación final:** 8 mesas barridas sin clave, **0 nombres** entregados.

---

## Agujero 2 · Le podían cargar la comida a la cuenta de otra mesa

**Qué pasaba.** Al pedir, el sistema solo comprobaba dos cosas: que el módulo
de cuentas estuviera activo y que el pedido fuera "para comer aquí". **Nunca
comprobaba que quien pedía estuviera de verdad en esa mesa.** El "vengo del QR"
es un texto en la dirección que cualquiera escribe a mano: no es un secreto.

**El ataque funcionó.** Sin escanear ningún QR y desde fuera del local, se
mandó un pedido a nombre de una mesa ajena: el pedido quedó pegado a esa cuenta
y **el pendiente subió $9,50 sin que nadie del local tocara nada**.

Encadenado con el agujero 1 salía el fraude completo: preguntar qué mesas
tienen cuenta y cuánto deben → elegir una → cargarle comida desde cualquier
lado.

**Cómo quedó** (el camino que usted eligió: que el personal confirme):

1. El pedido **entra normal** y **la cocina lo ve de una vez**. La comida no
   espera a nadie — atrasar el servicio para tapar un fraude poco frecuente
   sería peor que el fraude.
2. El pendiente de la cuenta **no se mueve** hasta que alguien del local toque
   **"Sumar a la cuenta"** en el panel.
3. Si nadie confirma, el pedido se cobra por su cuenta, como cualquier pedido
   de mesa. **Nunca se pierde una venta.**
4. El cliente ve algo honesto: *"Tu pedido ya entró a cocina. El mesonero lo
   suma a la cuenta de la mesa al confirmarlo."*

**Comprobación final, las tres mitades del trato:**

| Lo que se probó | Resultado |
|---|---|
| Un desconocido carga comida a una cuenta ajena | **Bloqueado** — el pendiente quedó en $0,00 |
| …con el número de la cuenta en la mano | **Bloqueado** — el pendiente quedó en $0,00 |
| El pedido igual entra y la cocina lo ve | **Sí** — quedó "Nuevo" en la base |
| Caja lo confirma desde el panel | **Sí suma** — el pendiente subió $9,50 |

Esa última fila importa tanto como las otras: sin ella, "bloqueado" podría
significar simplemente que la función se rompió.

---

## Lo que cambia para su personal

Antes, el pedido del cliente entraba solo a la cuenta. Ahora hay **un toque de
confirmación**, y aparece en los tres sitios donde su gente ya trabaja:

- **Cuentas abiertas** — tarjeta ámbar por mesa: *"¿Sumar este pedido a la
  cuenta de Mesa 3?"* con **Sumar a la cuenta** / **Dejarlo aparte**. Antes esta
  sugerencia vivía plegada como camino de excepción; ahora es lo primero que se
  ve, porque pasó a ser el camino normal.
- **Caja** — el aviso "Cuenta abierta detectada" con su botón (ya existía).
- **Mesonero** — el mismo aviso en la tarjeta del pedido (ya existía).

"Dejarlo aparte" solo esconde la sugerencia en ese equipo; el pedido sigue vivo
y se cobra normal.

**Ojo con esto:** cuando su gente use "Agregar pedido" desde el panel, el menú
se abre como el del cliente, así que **ese pedido también pide confirmación**.
Es un toque más que antes. Es el precio de que nadie de afuera pueda cargarle
comida a una mesa.

---

## Lo que se revisó y NO estaba roto

**Se revisaron las 60 puertas del sistema por donde se pueden cambiar datos**
(crear, modificar o borrar). Resultado:

- **46 exigen usuario y rol** — y casi todas, además, la sede correcta.
- **14 son públicas a propósito** (pedir, reportar un pago, reservar, la
  encuesta, cancelar el propio pedido). Cada una tiene su propia defensa: el
  precio lo recalcula el servidor, la tasa la pone el servidor, los números de
  pedido son imposibles de adivinar y hay tope de intentos por minuto.
- **0 puertas quedaron sin llave.**

Se confirmó también que **ninguna otra vía pública puede mover una cuenta de
mesa**: la de los pedidos era la única, y ya está cerrada.

**Pruebas corridas, todas en verde:**

| Prueba | Resultado |
|---|---|
| Ataques de seguridad en vivo | 8 de 8 |
| Roles y suplantación de identidad | 18 de 18 |
| Aislamiento entre sedes | 28 de 28 |
| Usuarios y permisos | 63 de 63 |
| Cobros y comprobantes | 28 de 28 |
| Navegador real (accesibilidad, PWA sin internet, móvil, sesión) | 15 de 15 |
| Pruebas internas del código | 639 de 639 |

**160 comprobaciones + 639 pruebas internas, sin una sola falla.**

Se mantienen bloqueados los ataques al dinero que ya se habían tapado antes:
pedir una hamburguesa de $9,50 diciendo que cuesta $0,01 (se guardó a $9,50) y
pagar a una tasa inventada de 1 (el servidor impuso 848,83).

> **Dos fallas que no eran fallas.** Las dos se verificaron antes de "arreglar"
> nada, que es la regla de la casa:
>
> 1. Tres comprobaciones de permisos dieron error en la primera pasada. Al
>    repetirlas contra el sistema en vivo y contra el mismo servidor ya
>    caliente, **pasaron las 63 en los dos casos**: era un arranque en frío del
>    servidor de pruebas.
> 2. Cuatro pruebas de navegador fallaron por dos motivos de equipo, no de
>    código: faltaba instalar el navegador de pruebas, y esas cuatro están
>    escritas para el entorno de **simulación** (usan sus claves). Corridas
>    donde corresponde: **15 de 15**.
>
> Queda anotado porque perseguir esos fantasmas habría costado horas.

---

## Lo que falta

1. **Decisión suya sobre el agujero 1.** Lo barato ya está hecho (quitar el
   nombre). Cerrarlo de raíz tiene dos caminos y los dos cuestan:
   - *Código secreto en el QR:* obliga a **reimprimir todas las mesas**, y el QR
     es un papel pegado en una mesa pública — se fotografía y el secreto deja de
     serlo.
   - *Atar la consulta al pedido:* más sólido, pero el cliente que llegó y
     todavía no ha pedido se queda sin ver el total de su mesa.

   Mi recomendación: quedarse como está por ahora. Ya no se filtra ningún dato
   personal; lo que queda visible son los montos de la mesa, que es justo lo que
   esa pantalla existe para mostrar.
2. **Las 518 pruebas del checklist de módulos** siguen sin empezar.
3. **Las dos semanas de operación simulada** (§5 del plan) siguen pendientes;
   conviene correrlas contra la base de simulación, no contra la de verdad.
