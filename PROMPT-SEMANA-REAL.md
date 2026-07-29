# PROMPT — SEMANA REAL BLINDADA: 7 DÍAS OPERANDO BROTHERHOOD COMPLETO

> Ejecuta una simulación integral de una semana comercial completa del POS Brotherhood.
>
> Durante la simulación actúas como dueño, personal, clientes, proveedores, auditor contable, auditor de seguridad e ingeniero QA.
>
> Aplican obligatoriamente todas las reglas de:
>
> `PROMPT-MAESTRO-CERTIFICACION-TOTAL.md`
>
> El Prompt Maestro tiene prioridad sobre este documento.
>
> La simulación debe probar el sistema haciendo operaciones reales contra APIs reales, sesiones reales de prueba y un Supabase de simulación separado.
>
> No se acepta probar solamente leyendo código.

---

# 1. META DE LA SIMULACIÓN

Simular siete días comerciales distintos, con aproximadamente 200 clientes diarios y 550 pedidos totales durante la semana.

La simulación debe cubrir:

* Dos sedes.
* Todos los roles.
* Todos los canales.
* Cocina.
* Mesas.
* Pick up.
* Delivery.
* QR público.
* Caja.
* Pagos.
* Cuentas abiertas.
* Inventario.
* Proveedores.
* Compras.
* Gastos.
* Eventos.
* Promotores.
* Cancelaciones.
* Reportes.
* Auditoría.
* Notificaciones.
* PWA.
* Seguridad.
* Concurrencia.
* Rendimiento.
* Fallos parciales.
* Cierre y reconciliación semanal.

Cada día debe ser diferente.
No se debe reutilizar exactamente la misma combinación de:

* Personal.
* Horarios.
* Productos.
* Canales.
* Métodos de pago.
* Mesas.
* Clientes.
* Escenarios adversariales.
* Distribución de pedidos.

---

# 2. ENTORNO DE SIMULACIÓN

## Regla absoluta

Está prohibido ejecutar esta simulación contra producción.

Antes de crear cualquier dato:

1. Ejecuta el guard de simulación.
2. Verifica el project ref.
3. Verifica la marca interna de entorno.
4. Verifica `SIMULATION_MODE=true`.
5. Verifica que no existan usuarios ni sedes reales.
6. Ejecuta `qa:db-state`.
7. Guarda evidencia del estado inicial.
8. Registra el `run_id`.

Si no puedes demostrar que es una base de prueba:

* Detén toda escritura.
* Marca la simulación como `BLOCKED`.
* No intentes continuar.

## 2.1 Estado YA LISTO (verificado 2026-07-28 — no repetir desde cero)

* Proyecto Supabase de prueba: ref `gnyvdlxlrjwbsdctincy`, creado por el
  usuario y dedicado a esta simulación.
* Esquema aplicado y verificado: `SETUP-SUPABASE-PRUEBA.sql` (34 migraciones
  0001→0035) → 26 tablas, enums con acentos correctos (`Comer aquí`), sede
  semilla "Principal" + 6 mesas, buckets `menu-images` (público) y
  `payment-proofs` (privado).
* `.env.simulacion` YA EXISTE en la raíz (gitignored) con las keys del
  proyecto de prueba y claves de rol `sim-*-2026`. Solo falta agregarle
  `SIMULATION_MODE`, `SIMULATION_RUN_ID` y `EXPECTED_SUPABASE_PROJECT_REF`.
* La sede San Diego NO existe todavía en la base de prueba: crearla es parte
  del Día 0 usando el módulo real de Sucursales.
* Playwright NO está instalado: instalarlo es parte de la preparación si las
  pruebas de navegador van a marcarse PASS.

## Entorno recomendado

```text
.env.simulacion   (nombres de variables REALES de la app)
SIMULATION_MODE=true
SIMULATION_RUN_ID=brotherhood-week-001
BUSINESS_TIMEZONE=America/Caracas
EXPECTED_SUPABASE_PROJECT_REF=gnyvdlxlrjwbsdctincy
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ORDERS_*_PASSWORD=... (por rol)
```

El servidor de desarrollo debe levantarse utilizando únicamente ese archivo
(receta: copiar `.env.simulacion` sobre `.env.local` guardando respaldo del
original, o usar un cargador de env explícito; al terminar, RESTAURAR el
`.env.local` de producción y verificarlo).

---

# 3. PREPARACIÓN DE MIGRACIONES

Antes del Día 0:

1. Revisa todas las migraciones.
2. Consolídalas en orden cuando sea necesario.
3. Identifica dependencias.
4. Verifica columnas reales.
5. Verifica funciones.
6. Verifica RLS.
7. Verifica triggers.
8. Verifica índices.
9. Verifica constraints.
10. Entrega los `.sql`.
11. No asumas que fueron aplicados.
12. Después de aplicarlos, ejecuta pruebas de esquema.
13. Verifica base limpia.
14. Ejecuta `dbColumnsExist`.
15. Registra la versión exacta del esquema.

Si el usuario da acceso explícito al SQL editor del proyecto de prueba, puedes aplicarlas únicamente después de superar el guard.

NOTA: el esquema base YA está aplicado (sección 2.1). Este bloque aplica a
migraciones NUEVAS que nazcan de fixes durante la semana. Toda migración
nueva se aplica en el proyecto de prueba Y se entrega el `.sql` para que el
usuario la aplique después en producción (lista TE TOCA A TI).

---

# 4. ESTRUCTURA DE SCRIPTS

Crear:

```text
scripts/sim/
  lib/
    simulation-guard.mjs
    auth.mjs
    api-client.mjs
    scenario-generator.mjs
    expected-ledger.mjs
    expected-inventory.mjs
    db-verifier.mjs
    concurrency.mjs
    assertions.mjs
    evidence-writer.mjs
    performance.mjs
  dia-0.mjs
  dia-1.mjs
  dia-2.mjs
  dia-3.mjs
  dia-4.mjs
  dia-5.mjs
  dia-6.mjs
  dia-7.mjs
  run-week.mjs
  resume-week.mjs
  reset-simulation.mjs
```

Reutiliza los patrones ya probados de `scripts/qa-*.mjs` (especialmente
`qa-dia-completo.mjs` y `qa-cobros-origen.mjs`): sesiones por rol, header
`x-branch-id`, verificación de estado en base tras cada acción.

Cada script debe:

* Aceptar semilla.
* Aceptar fecha de negocio.
* Ser repetible.
* Ser reanudable.
* Guardar IDs.
* Guardar evidencia.
* Evitar duplicados al reintentarse.
* Verificar estado antes y después.
* Generar bitácora.
* Detenerse ante diferencias críticas.

`reset-simulation.mjs` solo puede borrar datos si el guard está en verde y el
`SIMULATION_RUN_ID` coincide; jamás debe poder apuntarse a producción.

---

# 5. ARCHIVOS DE SALIDA

Crear:

```text
SIM-SEMANA/
  config.json
  estado.json
  plan-semanal.json
  dia-0.md
  dia-1.md
  dia-2.md
  dia-3.md
  dia-4.md
  dia-5.md
  dia-6.md
  dia-7.md
  contabilidad-esperada.json
  inventario-esperado.json
  rendimiento.json
  seguridad.md
  concurrencia.md
  bugs.md
  pendientes.md
  reconciliacion-final.md
  resumen-final.md
```

---

# 6. PLAN EXACTO DE VOLUMEN

| Día       | Clientes equivalentes | Pedidos | Sede Principal | San Diego | Cancelaciones objetivo |
| --------- | --------------------: | ------: | -------------: | --------: | ---------------------: |
| Día 1     |                   150 |      55 |             35 |        20 |                      2 |
| Día 2     |                   180 |      70 |             44 |        26 |                      5 |
| Día 3     |                   195 |      78 |             42 |        36 |                      4 |
| Día 4     |                   190 |      72 |             45 |        27 |                      3 |
| Día 5     |                   260 |     115 |             72 |        43 |                      8 |
| Día 6     |                   245 |     100 |             62 |        38 |                     12 |
| Día 7     |                   160 |      60 |             36 |        24 |                      3 |
| **Total** |             **1.380** | **550** |        **336** |   **214** |                 **37** |

Los clientes equivalentes se calculan mediante cantidad de personas por mesa, pedido o grupo.

---

# 7. DISTRIBUCIÓN EXACTA POR CANAL

| Día   | Mesa con cuenta | Mesa sin cuenta | Pick up | Delivery | QR público | Staff | Total |
| ----- | --------------: | --------------: | ------: | -------: | ---------: | ----: | ----: |
| Día 1 |              18 |              18 |       7 |        5 |          5 |     2 |    55 |
| Día 2 |              14 |              18 |      10 |       10 |         16 |     2 |    70 |
| Día 3 |               8 |              10 |      22 |       22 |         14 |     2 |    78 |
| Día 4 |              14 |              14 |      14 |       12 |         16 |     2 |    72 |
| Día 5 |              28 |              22 |      20 |       18 |         25 |     2 |   115 |
| Día 6 |              24 |              18 |      18 |       16 |         22 |     2 |   100 |
| Día 7 |              14 |              14 |      10 |        8 |         12 |     2 |    60 |

No puede reducirse el volumen silenciosamente.
Si un escenario no puede completarse:

* Registra los pedidos no ejecutados.
* Explica el motivo.
* No modifiques la cifra esperada para aparentar cumplimiento.

---

# 8. CUOTAS MÍNIMAS DE ESCENARIOS DE PAGO

Durante la semana deben existir, como mínimo:

* 100 pagos en efectivo.
* 90 transferencias.
* 90 pagos móviles.
* 70 pagos mixtos.
* 40 pagos con segunda pata posterior.
* 50 pagos reportados por cliente.
* 20 pagos reportados en Bs con formato venezolano.
* 20 pagos con efectivo y cambio.
* 10 correcciones de método.
* 10 reintentos seguros después de timeout.
* 10 intentos de pago duplicado.
* 6 carreras de dos cajeros cobrando simultáneamente.
* 4 cuentas cobradas en un día diferente a su origen.
* 5 intentos de sobrepago.
* 5 intentos de pago insuficiente.
* 5 montos inválidos rechazados.

Usar formatos como:

```text
9.648,99
3.632
1.250,50
1000
0,01
```

El script debe registrar la interpretación canónica esperada (la referencia
es `src/lib/publicMoneyInput.ts`: `3.632` = tres mil seiscientos treinta y
dos, formato venezolano).

El contador de cuotas vive en `SIM-SEMANA/estado.json` y se actualiza cada
día; el Día 7 no puede cerrar con una cuota incumplida sin explicación.

---

# 9. ELENCO BASE

Crear desde cero, usando el mecanismo REAL de usuarios del sistema
(`/api/staff` + `/api/local-auth`) — no inventar tablas paralelas:

| Rol      | Sede Principal         | Sede San Diego    |
| -------- | ---------------------- | ----------------- |
| Owner    | Alejandro              | Mismo owner       |
| Manager  | Génesis                | Luis              |
| Cashier  | María Fernanda, Kelvin | Roxana            |
| Kitchen  | Jesús, Dubraska        | Carlos Alberto    |
| Waiter   | Anthony, Yorgelis      | Daniela           |
| Delivery | Miguel                 | Sin empleado fijo |
| Promoter | Vanessa                | Solo eventos      |
| Support  | Usuario QA Support     | Acceso controlado |

Agregar además:

* Un usuario público anónimo por flujo QR.
* Clientes deterministas.
* Un usuario que será contratado el Día 4.
* Un usuario que será despedido el Día 5.

---

# 10. ROTACIÓN DE PERSONAL

"Nadie trabaja igual dos días seguidos" significa que debe cambiar al menos uno de estos elementos:

* Turno.
* Horario.
* Caja.
* Mesas asignadas.
* Responsabilidad.
* Sede, cuando el rol lo permita.
* Canal principal.
* Usuario que registra pedidos.
* Usuario que cobra.
* Usuario que cancela.

Los roles con una sola persona pueden trabajar días consecutivos, pero no con exactamente la misma asignación.

Crear un calendario determinista en:

```text
SIM-SEMANA/plan-semanal.json
```

---

# 11. DÍA 0 — FUNDACIÓN Y LÍNEA BASE

El Día 0 es preparación técnica y contable.
No cuenta como uno de los siete cierres comerciales.
Puede generar un `cierre técnico de fundación`, claramente separado del historial comercial.

Además, el Día 0 crea la MARCA DE ENTORNO (`environment_marker = simulation`)
que el guard exigirá todos los días siguientes, y la sede San Diego con el
módulo real de Sucursales.

## 11.1 Usuarios

Crear todos los usuarios.
Por cada uno:

* Login correcto.
* Contraseña incorrecta.
* Navegación por rol.
* APIs permitidas.
* APIs prohibidas.
* Sede correcta.
* Intento de sede cruzada.
* Auditoría.
* Sesión en dos pestañas.

## 11.2 Sedes

Configurar:

### Principal

* Mesas.
* WhatsApp.
* QR.
* Horario.
* Métodos de pago.
* Delivery.
* Costo por kilómetro.
* Impresión.
* Menú principal.

### San Diego

* Mesas propias.
* WhatsApp propio.
* QR propio.
* Overrides.
* Herencia del menú principal.
* Restricciones de sede.

Verificar que ningún dato se filtre.

## 11.3 Inventario inicial

Crear al menos 18 insumos:

* Pan.
* Carne.
* Pollo.
* Queso.
* Tocineta.
* Papas.
* Aceite.
* Refresco.
* Agua.
* Salsa de tomate.
* Mayonesa.
* Mostaza.
* Vegetales.
* Cebolla.
* Empaques.
* Bolsas.
* Servilletas.
* Hielo.

Para cada uno:

* Unidad.
* Stock.
* Stock mínimo.
* Costo.
* Sede.
* Historial.
* Proveedor relacionado cuando corresponda.

## 11.4 Proveedores

Crear cinco proveedores:

1. Carnes.
2. Panadería.
3. Bebidas.
4. Empaques.
5. Verduras.

Datos:

* Nombre.
* Identificación.
* Teléfono.
* Dirección.
* Contacto.
* Condiciones de crédito.
* Días de vencimiento.
* Sede o alcance.

## 11.5 Compras iniciales

Crear una factura por proveedor:

* 2 pagadas completas.
* 2 completamente a crédito.
* 1 con abono parcial.

Verificar:

* Stock sumado.
* Gasto o cuenta contable.
* Saldo pendiente.
* Historial.
* Autor.
* Sede.
* No doble contabilización.

## 11.6 Menú

Crear:

* 12 productos.
* 2 combos.
* Variaciones.
* Adicionales.
* Recetas.
* Ingredientes.
* Precios.
* Disponibilidad por sede.
* Herencia.
* Overrides.

Incluir:

* Producto simple.
* Producto con variación.
* Producto con varios adicionales.
* Producto con receta fraccionada.
* Combo.
* Producto exclusivo de una sede.
* Producto heredado.
* Producto con precio distinto por sede.

## 11.7 Gastos

Registrar:

* Alquiler ficticio.
* Limpieza.
* Hielo.
* Mantenimiento menor.

## 11.8 Línea base

Al finalizar:

* `qa:db-state`.
* Snapshot del esquema.
* Snapshot de inventario.
* Snapshot de cuentas por pagar.
* Snapshot de usuarios.
* Snapshot de configuración.
* `tsc`.
* Tests.
* Build.
* Commit.

---

# 12. RUTINA OBLIGATORIA DE CADA DÍA

Cada día debe seguir esta secuencia:

## Fase A — Preflight

* Guard de simulación.
* Verificar fecha.
* Verificar semilla.
* Verificar esquema.
* Verificar usuarios del turno.
* Verificar stock inicial.
* Verificar cuentas abiertas heredadas.
* Verificar que no hay diferencias del día anterior.

## Fase B — Apertura

* Abrir caja por sede.
* Registrar fondo inicial.
* Verificar actor.
* Verificar sede.
* Verificar auditoría.

## Fase C — Operación feliz

Ejecutar pedidos y operaciones normales.

## Fase D — Operación adversarial

Ejecutar errores, duplicados, concurrencia y fallos.

## Fase E — Verificación intermedia

A mitad del día:

* Caja.
* Inventario.
* Pedidos.
* Pagos.
* Cuentas.
* Auditoría.
* Notificaciones.
* Sede.

## Fase F — Cierre

* Cerrar caja por sede.
* Comparar con libro independiente.
* Verificar gastos.
* Verificar cancelaciones.
* Verificar cuentas abiertas.
* Verificar pagos recibidos.
* Verificar diferencias.

## Fase G — Calidad

Si se tocó código:

* Tests relacionados.
* Tests generales.
* `tsc`.
* Build.
* E2E.
* Commit.

## Fase H — Bitácora

Guardar esperado versus real.

---

# 13. DÍA 1 — LUNES SUAVE Y NACIMIENTO DE LA OPERACIÓN

Objetivo:

* Validar apertura básica.
* Operación normal.
* Primera cuenta abierta.
* Primer cierre comercial.

Ejecutar exactamente 55 pedidos.

## Escenarios obligatorios

* Mayoría de pedidos en mesa.
* Una cuenta abierta con al menos 4 pedidos asociados.
* Una segunda cuenta con pagos separados.
* Pedidos de las dos sedes.
* 2 pedidos staff.
* Efectivo con cambio.
* Transferencia.
* Pago móvil.
* Pago mixto.
* Pedido QR.
* Pick up pagado al retirar.
* Delivery simple.
* 2 cancelaciones:
  * Una antes de cocina.
  * Una antes del cobro.

## Pruebas adversariales

* Doble clic al crear pedido.
* Mesonero intenta entregar producto no listo.
* Cajero intenta ver datos de otra sede.
* Usuario kitchen intenta acceder a reporte financiero.
* Monto `9.648,99`.
* Pedido vacío.
* Producto con cantidad cero.
* Pedido duplicado por reintento.

## Cierre

Verificar:

* Primer cierre por sede.
* Historial limpio.
* Gastos correctamente restados.
* Cancelaciones visibles.
* Inventario exacto.
* Cuenta abierta correctamente excluida del dinero cobrado.
* Auditoría completa.

---

# 14. DÍA 2 — MARTES DE COCINA E INVENTARIO

Ejecutar exactamente 70 pedidos.

Objetivo:

* Probar cocina de punta a punta.
* Probar agotamiento.
* Probar cancelaciones en distintos estados.

## Cocina

* Comanda al enviar.
* Marcar producto a producto.
* Marcar completo.
* Avisar al mesonero.
* Recibo 80 mm.
* Reimpresión.
* Dos cocineros trabajando simultáneamente.
* Observaciones.
* Variaciones.
* Adicionales.

## Agotamiento

Un insumo debe agotarse a mitad del día.

Verificar:

* Stock llega exactamente a cero.
* Producto afectado se marca agotado.
* Menú público se actualiza.
* Staff no puede confirmar nueva venta.
* QR abierto previamente no puede manipular el precio ni vender stock inexistente.
* Otras sedes conservan su propio stock.
* Combo afectado también se bloquea cuando corresponda.

## Cinco cancelaciones

1. Antes de cocina.
2. En preparación.
3. Producto parcialmente preparado.
4. Pedido listo.
5. Pedido asociado a cuenta.

Cada cancelación debe tener:

* Motivo.
* Autor.
* Fecha.
* Efecto en caja.
* Efecto en inventario.
* Efecto en reporte.
* Auditoría.

## Pruebas adversariales

* Dos cocineros marcan listo al mismo tiempo.
* Cocina y cajero cancelan simultáneamente.
* Producto agotado mientras cliente confirma QR.
* Fallo de impresora.
* Fallo de notificación.
* Reintento después de timeout.

---

# 15. DÍA 3 — MIÉRCOLES DE CALLE, PICK UP Y DELIVERY

Ejecutar exactamente 78 pedidos.

Objetivo:

* Dar prioridad a pick up y delivery.
* Probar pagos reportados.
* Probar aislamiento público por sede.

## Pick up

* Pago anticipado.
* Pago al retirar.
* Cliente llega temprano.
* Cliente llega tarde.
* Pedido marcado listo.
* Aviso.
* Cambio de método.

## Delivery

* GPS correcto.
* GPS ausente.
* Dirección incompleta.
* Dirección corregida.
* Distancia.
* Costo por kilómetro.
* Dirección fuera de rango, si existe límite.
* Reasignación de delivery.
* Delivery sin permiso para cobrar, si esa es la regla.

## Pago reportado incorrectamente

Crear un cliente que:

* Reporta monto equivocado.
* Reporta método equivocado.
* Cajero revisa.
* Corrige de forma auditada.
* El sistema conserva la trazabilidad.

## Anti-duplicado

El mismo cliente intenta reportar el mismo pago dos veces:

* Desde la misma pestaña.
* Desde otra pestaña.
* Después de timeout.
* Con el mismo identificador.
* Con un identificador nuevo pero mismos datos.

El sistema debe evitar el duplicado o enviarlo a revisión explícita.

## QR por sede

* Pedido QR Principal.
* Pedido QR San Diego.
* Manipulación de branch ID.
* ID de producto de otra sede.
* Menú desactualizado.
* Precio manipulado desde payload.
* Sesión anónima.
* Datos recordados.
* Cierre de sesión o limpieza de datos.

⚠️ Pitfall conocido del checkout público: `customerPhone` no vacío hace que
el server trate el pedido como delivery — cubrir ese caso explícitamente.

---

# 16. DÍA 4 — JUEVES DE PROVEEDORES Y CAMBIOS EN VIVO

Ejecutar exactamente 72 pedidos.

## Compras

Llegan tres facturas:

1. Pagada completa.
2. A crédito.
3. Con abono parcial.

Una factura incluye un insumo más caro.

Verificar:

* Stock.
* Costo.
* Cuenta por pagar.
* Gasto.
* Auditoría.
* No doble contabilización.

## Cambio de precios

Subir el precio de dos productos a mitad del día.

Verificar:

* Pedidos anteriores conservan precio.
* Pedidos nuevos usan precio nuevo.
* Cuentas abiertas conservan detalles históricos.
* Menú público se actualiza.
* PWA con caché viejo recibe actualización.
* Cliente no puede enviar precio antiguo manipulado.

## Abono a proveedor

* Registrar abono.
* Intentar duplicarlo.
* Intentar sobreabono.
* Dos usuarios intentando abonar simultáneamente.
* Saldo exacto.

## Gasto imprevisto

Registrar reparación.
Verificar impacto en cierre y reportes.

## Contratación

Crear un empleado nuevo a mitad del día.

Debe:

* Recibir rol.
* Recibir sede.
* Iniciar sesión.
* Ver navegación correcta.
* Abrir o usar caja según permiso.
* Trabajar esa misma tarde.
* Registrar operaciones.
* Quedar en auditoría.

Probar:

* Antes de ser creado no entra.
* Con rol incorrecto no accede.
* Cambio de rol se refleja correctamente.
* Sesión se comporta según política.

## Producto nuevo

* Crear producto.
* Receta.
* Precio.
* Disponibilidad.
* Publicarlo.
* Venderlo.
* Descontar inventario.
* Reportarlo.
* Cancelar una unidad.
* Verificar historial.

---

# 17. DÍA 5 — VIERNES PICO, EVENTO Y CONCURRENCIA

Ejecutar exactamente 115 pedidos y representar 260 clientes.

Objetivo:

* Volumen máximo.
* Varias cuentas.
* Evento.
* Promotores.
* Desactivación de empleado.
* Concurrencia.

## Operación pico

* Varias cajas o pestañas.
* Varias cuentas abiertas.
* Mesas grandes.
* Pedidos simultáneos.
* Cocina saturada.
* Pagos mixtos.
* Segundas patas.
* Reportes durante operación.
* Delivery.
* QR.
* Pick up.

## Modo evento

Activar evento.
Vanessa trabaja como promotora.

Verificar:

* Ventas atribuidas.
* Ventas sin promotor.
* Cambio de promotor.
* Cancelación.
* Pago posterior.
* Reporte por vendedor.
* Reporte por sede.
* Cierre.
* Sin atribución duplicada.

## Despido

Desactivar un empleado a media tarde.

Verificar inmediatamente:

* No puede iniciar sesión.
* Token anterior deja de operar.
* Una pestaña abierta no puede seguir escribiendo.
* No puede crear pedido.
* No puede cobrar.
* No puede cancelar.
* No puede consultar información nueva.
* Historial anterior permanece intacto.
* Auditoría conserva sus acciones.
* Reportes conservan sus ventas.
* No se reasignan falsamente sus operaciones.

## Cuenta que cruza el cierre

Dejar una cuenta abierta.

Debe:

* Tener pedidos del Día 5.
* No formar parte del dinero recibido del cierre del Día 5.
* Conservar fecha de origen.
* Cobrar una parte el Día 6.
* Mostrar correctamente origen y fecha de cobro.

## Concurrencia obligatoria

* Dos cajeros cobran el mismo pedido.
* Dos cajeros cobran la misma cuenta.
* Dos ventas consumen las últimas unidades.
* Dos pestañas envían el mismo pago.
* Cierre intenta comenzar mientras entra un cobro.
* Cambio de precio durante confirmación de pedido.

---

# 18. DÍA 6 — SÁBADO DE ERRORES HUMANOS Y FALLOS REALES

Ejecutar exactamente 100 pedidos.

Objetivo:

* Simular comportamiento desordenado real.
* Confirmar que el sistema se recupera.

## Casos humanos

* Cambio de mesa.
* Cliente se arrepiente antes de cocina.
* Cliente se arrepiente durante cocina.
* Cliente se arrepiente cuando está listo.
* Doble clic en cobrar.
* Cajero elige método incorrecto.
* Corrección de método.
* Delivery con dirección mala.
* Cliente llama impaciente.
* Pedido listo genera aviso.
* Cliente actualiza página.
* Cliente vuelve atrás.
* Cliente usa dos pestañas.
* Mesonero intenta cobrar sin permiso.
* Cajero intenta cancelar sin motivo.
* Cocina marca producto equivocado.
* Pedido con observación ofensiva o XSS.
* Nombre de cliente con caracteres especiales.
* Teléfono incompleto.
* GPS inconsistente.

## Doce cancelaciones

Distribuir:

* 3 antes de cocina.
* 3 durante preparación.
* 2 parcialmente preparados.
* 2 listos.
* 1 asociado a cuenta.
* 1 pagado, probando la política de devolución o bloqueo.

Todas con motivo.

## Cuenta del Día 5

Cobrar la cuenta pendiente.

Verificar:

* Pedido conserva origen Día 5.
* Dinero cae en cierre Día 6.
* Reportes separan origen y cobro.
* Inventario no se descuenta otra vez.
* Auditoría muestra todos los actores.
* Pago no se duplica.

## Fallos parciales

Simular:

* Timeout después de guardar un pago.
* Reintento.
* Notificación caída.
* Impresora caída.
* Base lenta.
* Sesión expirada durante cobro.
* Reconexión de PWA.
* Solicitud offline reenviada.
* Error en una pata de pago mixto.
* Reintento seguro.

---

# 19. DÍA 7 — DOMINGO, CIERRE Y AUDITORÍA SEMANAL

Ejecutar exactamente 60 pedidos.

Objetivo:

* Operación baja.
* Cierre semanal.
* Reconciliación completa.

## Operación

* Dos sedes.
* Todos los canales.
* Tres cancelaciones.
* Pagos variados.
* Una cuenta abierta y cerrada el mismo día.
* Un pedido con cambio de mesa.
* Un delivery.
* Un QR por sede.
* Un pago mixto.
* Un pago reportado.

## Auditoría de reportes

Comparar:

* Consolidado.
* Principal.
* San Diego.
* Por vendedor.
* Por promotor.
* Por canal.
* Por producto.
* Por método.
* Por fecha de origen.
* Por fecha de cobro.
* Cancelaciones.
* Gastos.
* Compras.
* Cuentas por pagar.
* Inventario.

## Historial de cierres

Debe haber exactamente:

* 7 cierres comerciales por cada sede que haya operado diariamente, o
* La cantidad documentada si el modelo del sistema utiliza un cierre consolidado.

El cierre técnico del Día 0 no debe confundirse con los comerciales.

## Exportaciones

Exportar los reportes disponibles.

Verificar:

* Totales.
* Filas.
* Fechas.
* Sede.
* Codificación.
* Decimales.
* Cancelaciones.
* Pagos.
* Sin datos de otra sede para usuarios restringidos.

## Cuentas por pagar

Verificar:

* Facturas iniciales.
* Facturas del Día 4.
* Abonos.
* Saldos.
* Vencimientos.
* Sin sobreabonos.
* Sin duplicados.

## Reconciliación de inventario

Calcular independientemente:

```text
Stock esperado =
stock inicial
+ compras
+ ajustes positivos
- ventas según receta
- ajustes negativos
+ reposiciones válidas por cancelación
```

Comparar por:

* Insumo.
* Sede.
* Unidad.
* Movimiento.
* Pedido.
* Compra.
* Autor.

Toda diferencia es bug.

## Trazabilidad

Elegir de forma determinista al menos 10 pedidos:

* De días distintos.
* De ambas sedes.
* De distintos canales.
* Con varios métodos.
* Con cancelación.
* Con cuenta abierta.
* Con evento.
* Con delivery.
* Con QR.
* Con cambio de precio.

Reconstruir:

* Quién creó.
* Quién envió a cocina.
* Quién preparó.
* Quién marcó listo.
* Quién entregó.
* Quién cobró.
* Quién canceló.
* Motivo.
* Precio histórico.
* Inventario.
* Notificaciones.
* Cierre.
* Reporte.

---

# 20. PRUEBAS TRANSVERSALES DURANTE TODA LA SEMANA

## Seguridad

Cada día ejecutar al menos:

* Un intento de acceso cruzado entre sedes.
* Un intento de acción sin permiso.
* Un intento de manipular un ID.
* Un intento de manipular precio.
* Un intento de usar sesión no válida.

## Concurrencia

Durante la semana completar al menos:

* 6 cobros simultáneos.
* 4 cuentas modificadas simultáneamente.
* 4 carreras de inventario.
* 3 carreras de cocina.
* 2 cierres concurrentes con operación.
* 2 abonos concurrentes.
* 2 cambios de precio concurrentes.

## PWA y navegador

Probar:

* Móvil.
* Tablet.
* Escritorio.
* Dos pestañas.
* Caché.
* Actualización de versión.
* Offline.
* Reconexión.
* Datos recordados.
* Limpieza al cerrar sesión.
* Aislamiento de sede en almacenamiento local.

(Con Playwright headless; si no está instalado ni se puede instalar,
estas pruebas quedan `BLOCKED` — nunca `PASS` por inspección manual.)

## Rendimiento

Registrar diariamente:

* p50.
* p95.
* Máximo.
* Errores.
* Timeouts.
* Reintentos.

Medir:

* Crear pedido.
* Enviar a cocina.
* Marcar listo.
* Cobrar.
* Consultar cuenta.
* Cerrar caja.
* Generar reporte.
* Menú público.

---

# 21. VERIFICACIÓN OBLIGATORIA CADA NOCHE

Para cada sede:

1. Cierre cuadra al céntimo.
2. Fondo inicial correcto.
3. Efectivo esperado correcto.
4. Pagos por método correctos.
5. Gastos correctos.
6. Compras no duplicadas.
7. Cancelaciones visibles.
8. Cuentas abiertas correctas.
9. Inventario exacto.
10. Autor correcto.
11. Sede correcta.
12. Auditoría completa.
13. Notificaciones internas generadas.
14. Terceros marcados correctamente.
15. Sin filtración entre sedes.
16. Sin registros huérfanos.
17. Sin pagos duplicados.
18. Sin pedidos en estados imposibles.
19. Rendimiento registrado.
20. Bitácora guardada.

Si se tocó código:

21. `tsc`.
22. Vitest.
23. Integración.
24. E2E relacionado.
25. Build.
26. Revisión de diff.
27. Commit.

---

# 22. REGLA DE DETENCIÓN POR ERROR CRÍTICO

Si se detecta:

* Diferencia contable.
* Pago duplicado.
* Filtración entre sedes.
* Corrupción de inventario.
* Usuario desactivado que sigue operando.
* Pérdida de trazabilidad.
* Operación parcialmente aplicada.

Entonces:

1. Detén el avance del escenario dependiente.
2. Conserva evidencia.
3. Reproduce.
4. Escribe test rojo.
5. Corrige.
6. Ejecuta gates.
7. Repite el escenario.
8. Repite las verificaciones del día desde el último checkpoint confiable.
9. Continúa solo cuando la base vuelva a estar consistente.

---

# 23. INFORME FINAL

Crear un informe por módulo con:

## E — Errores

* ID.
* Severidad.
* Escenario.
* Evidencia.
* Impacto.

## C — Causa

* Archivo.
* Función.
* Regla rota.
* Razón por la que no se detectó antes.

## F — Fix

* Cambio.
* Migración.
* Riesgos.

## S — Blindaje

* Test unitario.
* Integración.
* E2E.
* Concurrencia.
* Seguridad.

## M — Mejoras

* Mejoras terminadas.
* No propuestas vagas.
* No tareas a medias sin marcar.

---

# 24. TABLA SEMANAL FINAL

Incluir:

| Concepto              | Bitácora esperada | Sistema | Diferencia | Estado |
| --------------------- | ----------------: | ------: | ---------: | ------ |
| Pedidos               |                   |         |            |        |
| Clientes equivalentes |                   |         |            |        |
| Ventas originadas     |                   |         |            |        |
| Dinero cobrado        |                   |         |            |        |
| Efectivo              |                   |         |            |        |
| Transferencias        |                   |         |            |        |
| Pago móvil            |                   |         |            |        |
| Pagos mixtos          |                   |         |            |        |
| Cancelaciones         |                   |         |            |        |
| Gastos                |                   |         |            |        |
| Compras               |                   |         |            |        |
| Cuentas por pagar     |                   |         |            |        |
| Abonos                |                   |         |            |        |
| Inventario            |                   |         |            |        |

Debe incluir:

* Total general.
* Principal.
* San Diego.
* Por día.
* Por vendedor.
* Por canal.
* Por método.

---

# 25. CHECKLIST FINAL

Repasar punto por punto:

* Prompt Maestro.
* Día 0.
* Días 1–7.
* Todos los módulos.
* Todas las pruebas transversales.
* Todos los cierres.
* Seguridad.
* Concurrencia.
* Inventario.
* Dinero.
* PWA.
* Notificaciones.
* Rendimiento.
* Auditoría.
* Exportaciones.
* Migraciones.
* Tests.
* Commits.

Cada punto debe tener:

```text
Estado:
Evidencia:
Comando:
Archivo:
Registro DB:
Test:
Commit:
```

---

# 26. "TE TOCA A TI"

Al final, dejar únicamente acciones que requieran al usuario:

* Aplicar migraciones.
* Configurar servicios externos.
* Dar acceso al Supabase de prueba.
* Ejecutar deploy.
* Confirmar hardware físico.
* Aprobar una política empresarial no definida.

No colocar como tarea del usuario algo que puedas resolver tú dentro del repositorio o del entorno autorizado.

---

# 27. CRITERIO DE CERTIFICACIÓN

La simulación solo puede declararse certificada cuando:

* No existen bugs críticos abiertos.
* No existen diferencias contables.
* No existe filtración entre sedes.
* No existen pagos duplicados.
* Inventario cuadra.
* Auditoría conserva autor y sede.
* Usuarios desactivados no operan.
* Todas las pruebas aplicables tienen evidencia.
* Los bloqueos externos están claramente identificados.
* Los scripts pueden repetir la semana.
* El estado puede reconstruirse desde cero.
* Los tests de regresión protegen cada bug encontrado.
* `tsc`, tests y build están en verde.
* El checklist está completo.

No utilices la palabra "perfecto" únicamente porque terminó el script.
La certificación debe basarse en evidencia reproducible.

---

# 28. AL TERMINAR LA SIMULACIÓN (higiene del entorno)

1. Restaurar `.env.local` de producción si fue reemplazado, y verificarlo.
2. Confirmar que ningún dato de simulación tocó producción (spot-check).
3. Dejar los scripts `scripts/sim/*` y `SIM-SEMANA/*` commiteados en la rama
   `qa/simulacion-semana-real` (sin keys ni secretos).
4. Entregar la lista de fixes que deben viajar a `main`/`brotherhood-publico`
   con su migración correspondiente para producción.
