# Mensaje inicial para la próxima sesión

> Copia y pega el bloque de abajo como primer mensaje. Está escrito para que la
> sesión arranque sabiendo qué hacer, en qué base pararse y qué NO tocar.

---

```
Sesión de auditoría de seguridad y arreglos de Brotherhood.

Lee y sigue PROMPT-SEGURIDAD-Y-VIDA-REAL.md (raíz del repo D:\Santo edit, rama
brotherhood-publico). Ese documento manda; este mensaje solo fija por dónde
empezar.

CONTEXTO DE ESTA SESIÓN — se trabaja EN VIVO contra producción:
Autoricé que se pruebe contra producción (brotherhood-xi.vercel.app) porque el
sistema todavía NO se le entregó al cliente: todos los pedidos, cuentas y
comprobantes de ahí son de PRUEBA y se van a borrar antes de entregar. Un ataque
que crea su pedido y lo ataca no daña nada irreversible.
LO QUE NO SE TOCA aunque sea producción de prueba: el menú real (62 productos),
la configuración, las sucursales/mesas/claves y las 4 compras de insumos
precargadas — eso el cliente lo hereda.

ARRANQUE:
1. Corre `npm run qa:seguridad` (pega a producción por defecto). Es la batería de
   ataques en vivo: fuga de cuentas de mesa (H-1), precio y tasa manipulados,
   y el fraude de cargar comida a la cuenta ajena (H-4). Crea y borra todo con
   prefijo ZZTEST- y verifica que quedó limpio. Referencia: 6/6.
2. Con eso ya tienes confirmado en vivo qué está abierto. Ahora arreglamos.

ORDEN DE TRABAJO:

1. IMPLEMENTA EL H-4, que ya tiene mi decisión tomada (camino B): hoy cualquiera
   carga comida a la cuenta de otra mesa sin estar en el local (qa:seguridad S4 y
   S5 lo prueban). El pedido debe entrar normal y la COCINA LO VE DE UNA VEZ,
   pero el pendiente de la cuenta NO se mueve hasta que alguien del local toque
   "Sumar a la cuenta" en el panel. Cuando esté hecho, INVIERTE los checks S4/S5
   de qa:seguridad para que verifiquen que ya no se puede. Con su prueba.

2. H-1 (fuga de cuentas de mesa): deja hecho lo barato —quitar el nombre del
   cliente de la respuesta pública (se envía pero no se muestra en pantalla, así
   que no cambia nada)— e invierte el check S1. Para lo demás (código en el QR o
   atar la consulta al pedido) primero mide el alcance y me consultas.

3. El barrido de rutas de mutación sin guard (§3, A.99): lista todo endpoint
   POST/PATCH/DELETE bajo src/app/api que no valide rol o sede, separando los
   públicos por diseño y diciéndome cuáles consideraste públicos.

4. Corre las suites que qa:seguridad NO cubre: qa:roles, qa:branch-isolation,
   qa:usuarios, qa:payments. Y Playwright (los 15 de navegador).

5. Si queda tiempo y quieres el cuadre grande de dos semanas, ESO sí conviene
   correrlo contra la base de simulación (§0 y §5 del prompt): el motor tiene sus
   candados y su reconciliación, y no ensucia lo que se le mostrará al cliente.

REGLAS QUE NO SE NEGOCIAN:
- Un ataque no se da por bloqueado sin mirar la base: la respuesta HTTP sola no
  prueba nada. Y el ataque tiene que LLEGAR hasta la defensa (con un producto/
  precio/tasa reales), o un guard anterior te da un falso negativo.
- Verifica los hallazgos ANTES de arreglarlos. Ya pasó que una revisión reportó
  como grave que "Reset clave" no expulsa al empleado, y al probarlo era falso.
- Todo lo que crees lleva prefijo ZZTEST- y se borra al final, con verificación.
- NO toques el menú real, la config, sucursales/mesas/claves ni las 4 compras
  precargadas.
- Las migraciones las aplico yo: tú escribes el .sql y me avisas.
- No borres ni vacíes .vercelignore.

Al terminar: informe con números escrito para el dueño (no para un técnico) y
commit por fases.
```

---

## Estado con el que arranca esa sesión (2026-07-30)

Para que no lo tenga que redescubrir:

- **Rama** `brotherhood-publico`, sincronizada con origin. Árbol limpio.
- **En vivo** en brotherhood-xi.vercel.app con todos los arreglos del 30
  (permisos, sedes obligatorias, 4xx, desglose por sede, logos ajenos quitados).
- **447 checks de QA en verde** + 639 tests unitarios + `qa:seguridad` 6/6.
  Única falla conocida: las sedes no tienen WhatsApp cargado (lo pone el dueño).
- **Ninguna migración pendiente** (verificado con `npm run qa:migraciones`).
- **Dos hallazgos 🔴 abiertos, confirmados en vivo**: H-1 (fuga de cuentas de
  mesa) y H-4 (cargar comida a cuenta ajena). H-4 con decisión tomada (camino B).
- **Las 518 pruebas del checklist de módulos siguen sin empezar.**
