# Mensaje inicial para la próxima sesión

> Copia y pega el bloque de abajo como primer mensaje. Está escrito para que la
> sesión arranque sabiendo qué hacer, en qué base pararse y qué NO tocar.

---

```
Sesión de auditoría de seguridad y simulación de dos semanas de Brotherhood.

Lee y sigue al pie de la letra PROMPT-SEGURIDAD-Y-VIDA-REAL.md, que está en la
raíz del repo (D:\Santo edit, rama brotherhood-publico). Ese documento manda;
este mensaje solo fija por dónde empezar.

ANTES DE ESCRIBIR NADA EN LA BASE:
1. Confirma en qué Supabase estás parado. Todo esto va contra la base de
   SIMULACIÓN (gnyvdlxlrjwbsdctincy), jamás contra producción
   (fpujezdaauedjvnhjzws). El §0 del prompt trae los comandos exactos para
   intercambiar el .env.local y para restaurarlo al final.
2. Reinicia el dev server antes de correr suites: uno viejo responde 500 con
   cuerpo vacío y fabrica fallas que no existen.
3. Corre `npm run backup` y anota la ruta.

ORDEN DE TRABAJO:

1. Los tres hallazgos ya confirmados del §2. Empieza por H-1 (la fuga de las
   cuentas de mesa): quiero que primero midas el alcance real —cuántas mesas se
   pueden barrer desde afuera, qué datos salen exactamente— y recién después
   hablamos del arreglo. NO cambies el comportamiento público sin decírmelo.

2. El barrido de rutas de mutación sin guard (§3, A.99). Es el pendiente que
   más vale: lista todo endpoint POST/PATCH/DELETE bajo src/app/api que no
   valide rol o sede, separando a propósito los que son públicos por diseño y
   diciéndome cuáles consideraste públicos.

3. Playwright (los 15 checks de navegador), que ya se puede correr porque
   estamos en la base de simulación.

4. Recién ahí arranca la simulación de los 14 días (§5), día por día, cerrando
   el cuadre de cada día antes de pasar al siguiente.

REGLAS QUE NO SE NEGOCIAN:
- Nunca contra producción, ni "solo para ver".
- Un ataque no se da por bloqueado sin mirar la base de datos: la respuesta HTTP
  sola no prueba nada.
- Verifica los hallazgos ANTES de arreglarlos. En la sesión anterior una
  revisión automática reportó como grave que "Reset clave" no expulsa al
  empleado, y al probarlo era falso.
- No arregles en caliente a mitad de la simulación: anota, clasifica y sigue.
- Las migraciones las aplico yo: tú escribes el .sql y me avisas.
- No borres ni vacíes .vercelignore.

Al terminar: informe con números escrito para el dueño (no para un técnico),
commit por fases, y el .env.local devuelto a producción.
```

---

## Estado con el que arranca esa sesión (2026-07-30)

Para que no lo tenga que redescubrir:

- **Rama** `brotherhood-publico`, sincronizada con origin. Último commit
  `4c68297`. Árbol limpio.
- **En vivo** en brotherhood-xi.vercel.app con todos los arreglos del 30
  (permisos, sedes obligatorias, 4xx, desglose por sede, logos ajenos quitados).
- **447 checks de QA en verde** + 639 tests unitarios. Única falla conocida: las
  sedes no tienen WhatsApp cargado (lo configura el dueño).
- **Ninguna migración pendiente** (verificado con `npm run qa:migraciones`).
- **Las 518 pruebas en vivo del checklist siguen sin empezar.**
