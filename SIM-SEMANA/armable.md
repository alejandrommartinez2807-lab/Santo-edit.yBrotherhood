# Prueba del pedido armable (plantilla v2 real)

run: brotherhood-week-001 · inicio real: 2026-07-29T13:51:30.836Z

- `PASS` **ARM-0** producto armable creado con la estructura real (3 grupos + 3 adicionales) — status=200
- `PASS` **ARM-1** el menú público devuelve el armable con sus 3 grupos de variación — grupos=3 adicionales=3
- `PASS` **ARM-2** armable — una sola sección (Tipo: Smash) — el caso simple: el cliente honesto pasa y paga $8 — status=200 esperado=$8 guardado=$8 
- `FAIL` **ARM-3** armable — dos secciones (Smash · Carne) — nombre COMPUESTO: el cliente honesto pasa y paga $8 — status=400 esperado=$8 guardado=$NaN El menú cambió mientras armabas tu pedido. Actualiza la página e intenta de nuevo.
- `FAIL` **ARM-4** armable — las 3 secciones con recargos (Clásica · Mixta · Cheddar) = +$3.50: el cliente honesto pasa y paga $11.5 — status=400 esperado=$11.5 guardado=$NaN El menú cambió mientras armabas tu pedido. Actualiza la página e intenta de nuevo.
- `FAIL` **ARM-5** armable — 3 secciones + 2 tocinetas + 1 queso = el pedido más cargado: el cliente honesto pasa y paga $16 — status=400 esperado=$16 guardado=$NaN El menú cambió mientras armabas tu pedido. Actualiza la página e intenta de nuevo.
- `PASS` **ARM-HACK** un armable con deltas mentirosos se guarda al precio REAL ($14.50), no a $0.50 — status=400 guardado=$NaN
- `PASS` **ARM-FANTASMA** una opción inventada dentro del armado se rechaza (400) — status=400 El menú cambió mientras armabas tu pedido. Actualiza la página e intenta de nuevo.

limpieza: 1 pedidos de prueba y el producto armable eliminados

---
reanudado: 2026-07-29T13:56:53.418Z

- `PASS` **ARM-0** producto armable creado con la estructura real (3 grupos + 3 adicionales) — status=200
- `PASS` **ARM-1** el menú público devuelve el armable con sus 3 grupos de variación — grupos=3 adicionales=3
- `PASS` **ARM-2** armable — una sola sección (Tipo: Smash) — el caso simple: el cliente honesto pasa y paga $8 — status=200 esperado=$8 guardado=$8 
- `PASS` **ARM-3** armable — dos secciones (Smash · Carne) — nombre COMPUESTO: el cliente honesto pasa y paga $8 — status=200 esperado=$8 guardado=$8 
- `PASS` **ARM-4** armable — las 3 secciones con recargos (Clásica · Mixta · Cheddar) = +$3.50: el cliente honesto pasa y paga $11.5 — status=200 esperado=$11.5 guardado=$11.5 
- `PASS` **ARM-5** armable — 3 secciones + 2 tocinetas + 1 queso = el pedido más cargado: el cliente honesto pasa y paga $16 — status=200 esperado=$16 guardado=$16 
- `PASS` **ARM-HACK** un armable con deltas mentirosos se guarda al precio REAL ($14.50), no a $0.50 — status=200 guardado=$14.5
- `PASS` **ARM-FANTASMA** una opción inventada dentro del armado se rechaza (400) — status=400 El menú cambió mientras armabas tu pedido. Actualiza la página e intenta de nuevo.

limpieza: 5 pedidos de prueba y el producto armable eliminados

---
reanudado: 2026-07-29T14:36:54.555Z

- `PASS` **ARM-0** producto armable creado con la estructura real (3 grupos + 3 adicionales) — status=200
- `PASS` **ARM-1** el menú público devuelve el armable con sus 3 grupos de variación — grupos=3 adicionales=3
- `PASS` **ARM-2** armable — una sola sección (Tipo: Smash) — el caso simple: el cliente honesto pasa y paga $8 — status=200 esperado=$8 guardado=$8 
- `PASS` **ARM-3** armable — dos secciones (Smash · Carne) — nombre COMPUESTO: el cliente honesto pasa y paga $8 — status=200 esperado=$8 guardado=$8 
- `PASS` **ARM-4** armable — las 3 secciones con recargos (Clásica · Mixta · Cheddar) = +$3.50: el cliente honesto pasa y paga $11.5 — status=200 esperado=$11.5 guardado=$11.5 
- `PASS` **ARM-5** armable — 3 secciones + 2 tocinetas + 1 queso = el pedido más cargado: el cliente honesto pasa y paga $16 — status=200 esperado=$16 guardado=$16 
- `PASS` **ARM-HACK** un armable con deltas mentirosos se guarda al precio REAL ($14.50), no a $0.50 — status=200 guardado=$14.5
- `PASS` **ARM-FANTASMA** una opción inventada dentro del armado se rechaza (400) — status=400 El menú cambió mientras armabas tu pedido. Actualiza la página e intenta de nuevo.

limpieza: 5 pedidos de prueba y el producto armable eliminados
