# PROMPT MAESTRO — CERTIFICACIÓN TOTAL, BLINDAJE Y CERO FALSOS VERDES

Este prompt define el método obligatorio para probar, corregir y certificar el sistema POS multi-sede Brotherhood.

No eres únicamente un programador ni un lector de código. Actúas simultáneamente como:

* Dueño del negocio.
* Gerente.
* Cajero.
* Cocinero.
* Mesonero.
* Delivery.
* Promotor.
* Soporte.
* Proveedor.
* Cliente presencial.
* Cliente de pick up.
* Cliente delivery.
* Cliente que usa el menú público o QR.
* Cliente que se equivoca, repite acciones, cancela, paga mal o tiene mala conexión.
* Auditor contable.
* Auditor de seguridad.
* Ingeniero de QA.

El objetivo no es decir que el sistema funciona. El objetivo es DEMOSTRARLO con acciones reales, consultas reales a la base de datos, cálculos independientes, pruebas reproducibles y evidencia concreta.

## 0. ANCLAS REALES DEL REPO (verificadas 2026-07-28 — no inventes nada distinto)

Estas son realidades comprobadas del proyecto. Si algo aquí contradice lo que
encuentres en el código, gana el código — pero verifica antes de asumir.

* **Roles reales** (`LocalAccessRole` en `src/app/pedidos/domain.tsx`):
  `owner | manager | cashier | waiter | kitchen | delivery | promoter | support`.
* **Módulos de API reales** (`src/app/api/`): audit-logs, branches,
  business-config, cancellation-requests, day-close, day-closes, day-expenses,
  delivery-distance, delivery-zones, exchange-rate, inventory,
  inventory-recipes, local-auth, local-support, menu-products, open-accounts,
  orders, payment-proofs, payments, public, reports, reservations, staff,
  subrecipes, supplier-purchases, suppliers, surveys, whatsapp.
* **Usuarios**: se gestionan con el mecanismo REAL del sistema
  (`/api/staff` + `/api/local-auth`, claves por rol en `ORDERS_*_PASSWORD`).
  No inventes tablas ni mecanismos paralelos.
* **Scripts QA existentes** (reutiliza sus patrones, no reinventes):
  `qa:db-state`, `qa:open-accounts`, `qa:isolation`, `qa:payments`,
  `qa:inventory`, `qa:roles`, `qa:branches`, `qa:day-close`,
  `qa:inventory-deduct`, `qa:training`, `qa:metodos-cobro`, `qa:dia-completo`,
  `qa:cobros-origen`, `qa:mesa-prefill` (en `scripts/qa-*.mjs`).
* **Supabase de PRUEBA**: project ref `gnyvdlxlrjwbsdctincy`. El esquema
  (34 migraciones 0001→0035 + buckets `menu-images` público y
  `payment-proofs` privado) fue aplicado y VERIFICADO el 2026-07-28:
  26 tablas, enums con acentos correctos (`Comer aquí`), sede semilla
  "Principal" y 6 mesas. Las keys están en `.env.simulacion` (gitignored).
* **Producción de Brotherhood**: es el proyecto al que apunta `.env.local`
  (el que usan Sebas y Carlos). PROHIBIDO escribir ahí. El ref de producción
  se lee de `.env.local` SOLO para ponerlo en la denylist del guard.
* **Aislamiento por sede**: header `x-branch-id` (probar sedes con header,
  no con `?branch=`). Sede sin menú propio hereda el de la principal.
* **Parser canónico de montos**: `src/lib/publicMoneyInput.ts`.
* **Dinero**: helper único `needsPaymentReport`; reglas de mixto por pata,
  anti-duplicado y cobro por origen (cuenta vs directo) ya blindadas — no
  romperlas.
* **Navegador**: el dev server se verifica con scripts contra APIs (receta en
  memoria "Verificar sin navegador"); Playwright NO está instalado hoy —
  instálalo en la fase de preparación si vas a marcar pruebas de navegador
  como PASS; si no, quedan BLOCKED.
* **Zona horaria**: America/Caracas.
* **⚠️ `.vercelignore`**: nunca vaciarlo ni borrarlo (evita subir 18 GB y
  los .env de 14 clientes en un deploy).

## 1. ORDEN DE PRIORIDAD DE LAS REGLAS

Cuando este prompt se utilice junto con otros prompts, el orden de prioridad será:

1. Protección absoluta de producción y de los datos reales.
2. Integridad contable, seguridad, permisos y aislamiento por sede.
3. Reglas de este Prompt Maestro.
4. Reglas específicas del escenario o simulación.
5. Mejoras opcionales.

Si otro prompt contradice una regla de seguridad de este documento:

* No ejecutes la acción peligrosa.
* No improvises.
* No ignores silenciosamente la contradicción.
* Registra el bloqueo.
* Colócalo en `TE TOCA A TI`.
* Continúa con todo lo que sí pueda realizarse de forma segura.

## 2. CONTEXTO DEL SISTEMA

Sistema POS Brotherhood:

* Next.js.
* Supabase.
* Varias sedes.
* Usuarios reales trabajando en producción.
* Pedidos por mesa, pick up, delivery, personal y QR público.
* Cocina.
* Caja.
* Pagos completos y mixtos.
* Cuentas abiertas.
* Inventario y recetas.
* Proveedores y cuentas por pagar.
* Gastos.
* Reportes.
* Eventos y promotores.
* Auditoría.
* PWA.
* Notificaciones.
* Configuración independiente por sede.

Las aplicaciones hermanas, demos y proyectos relacionados no forman parte de la prueba salvo autorización expresa.

No debes modificar:

* Santo Perrito.
* Hotel.
* Clínica.
* Condominios.
* Demos.
* Otros worktrees.
* Otros proyectos Supabase.
* Producción de Brotherhood.

## 3. OBJETIVO PRINCIPAL

Probar completamente todos los flujos del sistema, incluyendo:

* Caminos felices.
* Errores humanos.
* Errores de permisos.
* Errores de red.
* Reintentos.
* Doble clic.
* Solicitudes duplicadas.
* Concurrencia.
* Cruce indebido entre sedes.
* Sesiones antiguas.
* Cambios a mitad de una operación.
* Operaciones que atraviesan cierres de caja.
* Fallos parciales.
* Montos con formatos extraños.
* Datos incompletos.
* Estados imposibles.
* Volumen realista.
* Rendimiento.
* Integridad contable.
* Integridad de inventario.
* Integridad histórica y de auditoría.

Cada error encontrado debe:

1. Reproducirse.
2. Documentarse.
3. Tener una causa raíz identificada.
4. Corregirse.
5. Recibir un test de regresión.
6. Verificarse nuevamente de punta a punta.
7. Confirmarse que no rompió otros módulos.
8. Quedar protegido para que no vuelva a ocurrir.

## 4. DEFINICIÓN DE ESTADOS

Cada escenario debe terminar en uno de estos estados:

### PASS

Solo puede marcarse `PASS` cuando existe evidencia de:

* Acción ejecutada.
* Respuesta obtenida.
* Estado real verificado en base de datos.
* Resultado comparado con lo esperado.
* Autor y sede correctos.
* Sin efectos secundarios incorrectos.

### FAIL

Se utiliza cuando:

* El resultado no coincide con lo esperado.
* Existe una diferencia contable, aunque sea de 0,01.
* Hay filtración entre sedes.
* El autor registrado es incorrecto.
* Existe duplicación.
* Se produce un estado inválido.
* Falta una actualización relacionada.
* Una operación responde bien, pero guarda mal.
* Una operación guarda bien, pero reporta mal.
* La interfaz permite algo que el backend debería rechazar.
* El backend permite algo que la interfaz oculta.

### BLOCKED

Se utiliza cuando la prueba no puede completarse por:

* Migración no aplicada.
* Credenciales no disponibles.
* Servicio externo no configurado.
* Falta de VAPID, Meta, WhatsApp u otro tercero.
* Imposibilidad técnica real.
* Dependencia externa caída.

Nunca marques `PASS` una prueba bloqueada.

### NOT_APPLICABLE

Solo se utiliza si el flujo realmente no existe en la versión actual.
Debe indicarse:

* Por qué no aplica.
* Qué evidencia demuestra que no existe.
* Si debería implementarse en el futuro.

### PENDING_FIX

Error confirmado cuya corrección aún no se ha terminado.

## 5. PROHIBICIÓN DE FALSOS VERDES

Está prohibido:

* Declarar que algo funciona por haber leído el código.
* Declarar que algo funciona porque TypeScript compila.
* Declarar que algo funciona porque una función parece correcta.
* Declarar que algo funciona porque la API respondió `200`.
* Declarar que algo funciona porque la interfaz mostró un mensaje.
* Suponer que una migración fue aplicada.
* Suponer que una notificación se envió.
* Suponer que un pago se guardó correctamente.
* Suponer que inventario descontó bien.
* Suponer que las RLS protegen una sede.
* Suponer que una sesión fue invalidada.
* Ocultar pruebas no realizadas.
* Reducir el alcance sin indicarlo.
* Cambiar una prueba difícil por una prueba superficial.

La ausencia de evidencia equivale a prueba no completada.

## 6. ENTORNO DE PRUEBAS Y BLOQUEO DE PRODUCCIÓN

### 6.1 Base separada obligatoria

Toda prueba destructiva, masiva o de simulación debe ejecutarse contra un proyecto Supabase de prueba completamente separado.

Está prohibido usar:

* URL de producción.
* `anon key` de producción.
* `service_role key` de producción.
* Variables del `.env.local` usado por Sebas, Carlos o cualquier usuario real.
* Base compartida con clientes reales.
* Storage de producción.
* Webhooks de producción.
* Configuración de WhatsApp o Meta de producción.

### 6.2 Variables obligatorias

El entorno de simulación debe tener variables separadas, con los NOMBRES
REALES que usa la app (verificados en `.env.example`):

```text
.env.simulacion   (YA EXISTE con las keys del proyecto de prueba)
SIMULATION_MODE=true
SIMULATION_RUN_ID=brotherhood-week-001
EXPECTED_SUPABASE_PROJECT_REF=gnyvdlxlrjwbsdctincy
BUSINESS_TIMEZONE=America/Caracas
NEXT_PUBLIC_SUPABASE_URL=...        # nombre real, NO "SUPABASE_URL"
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # nombre real
SUPABASE_SERVICE_ROLE_KEY=...       # nombre real
ORDERS_OWNER_PASSWORD=... (y el resto de ORDERS_*_PASSWORD por rol)
```

Si agregas `SIMULATION_MODE`/`SIMULATION_RUN_ID`/`EXPECTED_SUPABASE_PROJECT_REF`
al archivo, hazlo sin borrar las variables ya existentes.

### 6.3 Guard obligatorio antes de escribir

Debe existir un guard, por ejemplo:

```text
scripts/sim/lib/simulation-guard.mjs
```

Antes de cualquier escritura, el guard debe comprobar:

1. `SIMULATION_MODE` es exactamente `true`.
2. Existe un `SIMULATION_RUN_ID`.
3. El project ref extraído de `NEXT_PUBLIC_SUPABASE_URL` coincide con `EXPECTED_SUPABASE_PROJECT_REF`.
4. El project ref está en una allowlist de proyectos de prueba (`gnyvdlxlrjwbsdctincy`).
5. El project ref NO es el de producción (leer el ref de `.env.local` y ponerlo en denylist — sin imprimir sus keys).
6. La URL no coincide con ningún entorno real conocido.
7. Existe una marca dentro de la base (registro `environment_marker = simulation`, p. ej. dentro de `business_config.config` o una fila dedicada) — el Día 0 la crea; los días siguientes la EXIGEN.
8. No hay usuarios reales conocidos.
9. No hay sedes reales conocidas (más allá de las creadas por la simulación).
10. No hay pedidos históricos reales.
11. El entorno de Vercel o Next.js está identificado como simulación.
12. El script puede realizar una consulta de lectura segura antes de escribir.

Si una sola comprobación falla:

* Termina el proceso inmediatamente.
* No escribas nada.
* Muestra claramente qué validación falló.
* Registra el incidente.

### 6.4 Protección adicional

Está prohibido ejecutar automáticamente:

* `DROP DATABASE`.
* Eliminación de esquemas no identificados como simulación.
* Truncados fuera de la base de prueba.
* Limpieza masiva sin verificar el run ID.
* Scripts destructivos sin guard.
* Migraciones destructivas no revisadas.

## 7. WORKTREE, RAMA Y GIT

Antes de modificar código:

1. Verifica repositorio.
2. Verifica rama.
3. Verifica worktree.
4. Verifica que no sea producción directa.
5. Verifica el estado de Git.
6. Identifica archivos modificados previamente.
7. No sobrescribas trabajo de otras personas.
8. No toques aplicaciones hermanas.

Crea una rama específica, por ejemplo:

```text
qa/simulacion-semana-real
```

Cada fase debe terminar con:

* `tsc`.
* Tests.
* Build.
* Scripts de QA correspondientes.
* Revisión de diff.
* Commit separado.

Formato recomendado de commits:

```text
test(sim): add deterministic day 1 scenario
fix(payments): prevent duplicate mixed payment
test(payments): cover concurrent duplicate charge
```

No mezcles en un mismo commit:

* Refactor masivo.
* Migración.
* Corrección contable.
* Cambios visuales no relacionados.
* Tests de otro módulo.

## 8. MIGRACIONES Y ESQUEMA

### 8.1 Regla general

Toda tabla, columna, función, índice, trigger, política RLS o RPC utilizada debe existir realmente.
Nunca inventes columnas.
El test `dbColumnsExist` o su equivalente es obligatorio.

### 8.2 Antes de crear una migración

Debes:

1. Leer el esquema real.
2. Revisar migraciones existentes.
3. Detectar duplicados.
4. Verificar orden.
5. Verificar dependencias.
6. Verificar nombres reales.
7. Verificar datos existentes.
8. Analizar impacto.
9. Definir rollback cuando sea razonable.
10. Crear prueba de esquema.

### 8.3 Aplicación

Por defecto:

* Tú escribes los archivos `.sql`.
* El usuario los aplica.
* Nunca asumas que fueron aplicados.
* Verifica posteriormente el esquema real (por REST/qa:db-state).

Solo puedes aplicar una migración si:

* Es un Supabase de prueba.
* El usuario dio acceso explícito.
* El guard de simulación está en verde.
* Existe respaldo o posibilidad clara de reconstrucción.

### 8.4 Pruebas mínimas de migración

* Aplicación desde base limpia.
* Aplicación sobre el estado anterior esperado.
* Reaplicación o comportamiento idempotente cuando corresponda.
* Columnas y tipos correctos.
* Defaults.
* `NOT NULL`.
* Foreign keys.
* Índices.
* Uniques.
* Checks.
* Triggers.
* RLS.
* Funciones y permisos.
* Rollback o restauración documentada.
* Compatibilidad con datos anteriores.
* Codificación UTF-8 verificada (lección 2026-07-28: un archivo consolidado
  con acentos dañados habría creado enums rotos como `Comer aquÃ­`).

## 9. RELOJ DE NEGOCIO Y ZONA HORARIA

La zona horaria oficial es:

```text
America/Caracas
```

No dependas de esperar siete días reales.
Los scripts deben permitir una fecha de negocio controlada:

```bash
npm run sim:dia -- --day=5 --business-date=2026-08-07 --seed=brotherhood-week-v1
```

⚠️ REGLA DE HONESTIDAD TEMPORAL: la base de datos pone `created_at = now()`
real. Antes del Día 1, INVESTIGA cómo el sistema agrupa "el día" (cierres,
reportes, historial): si agrupa por `created_at`, los 7 días simulados en un
mismo día real caerán en la misma fecha. En ese caso decide y DOCUMENTA la
estrategia (p. ej. los cierres de caja marcan las fronteras de "día
comercial" y los reportes se validan por cierre, no por fecha), o implementa
soporte real de fecha de negocio si el sistema ya lo tiene. Prohibido
falsear timestamps directamente en la base para aparentar fechas, salvo que
se documente como técnica explícita del escenario y no rompa la auditoría.

Deben probarse:

* Antes de medianoche.
* Exactamente al cambio de día.
* Después de medianoche.
* Cuenta creada un día y cobrada otro.
* Cierre iniciado antes de medianoche y completado después.
* Reportes diarios.
* Reportes semanales.
* Zona horaria del servidor.
* Zona horaria de base de datos.
* Zona horaria del navegador.
* Timestamps de auditoría.

## 10. REPRODUCIBILIDAD Y REANUDACIÓN

Cada corrida debe tener:

* `run_id`.
* Semilla determinista.
* Fecha de negocio.
* Versión del código.
* Commit inicial.
* Commit final.
* Project ref de prueba.
* Versión de migraciones.
* IDs creados.
* Estado de cada fase.

Archivos obligatorios:

```text
SIM-SEMANA/
  config.json
  estado.json
  bugs.md
  pendientes.md
  resumen-final.md
```

`estado.json` debe registrar:

* Última fase completada.
* Último día completado.
* Último escenario completado.
* IDs de usuarios.
* IDs de productos.
* IDs de pedidos.
* IDs de pagos.
* IDs de cierres.
* IDs de facturas.
* Bugs abiertos.
* Migraciones pendientes.
* Commits realizados.

Cuando se indique "sigue", debes continuar desde el checkpoint real, no desde memoria.

## 11. CAPAS OBLIGATORIAS DE PRUEBAS

### 11.1 Pruebas unitarias

Para:

* Parser de dinero (`src/lib/publicMoneyInput.ts`).
* Redondeos.
* Distribución de pagos.
* Cálculo de cambio.
* Cálculo de delivery.
* Recetas.
* Descuento de inventario.
* Estados permitidos.
* Permisos.
* Fechas.
* Formateo.
* Totales.
* Reintentos.
* Idempotencia.

### 11.2 Pruebas de integración

Contra Supabase de prueba:

* APIs.
* RPC.
* RLS.
* Triggers.
* Auditoría.
* Escrituras relacionadas.
* Transacciones.
* Fallos parciales.
* Integridad referencial.

### 11.3 Pruebas de flujo completo

Con sesiones reales de cada rol:

* Login.
* Selección de sede.
* Creación de pedido.
* Cocina.
* Entrega.
* Cobro.
* Inventario.
* Reporte.
* Cierre.

### 11.4 Pruebas de navegador

No uses navegación manual como única evidencia.
Para comportamientos propios del navegador utiliza Playwright o equivalente en modo automatizado y preferiblemente headless:

* Navegación según rol.
* Doble clic.
* Multi-pestaña.
* Caché.
* Service Worker.
* PWA.
* Persistencia local.
* Formularios.
* Botones deshabilitados.
* Estados de carga.
* Impresión.
* Layout.
* Accesibilidad.
* Sesión expirada.

Playwright NO está instalado hoy en el repo: instalarlo (como devDependency,
sin tocar dependencias de producción) es parte de la preparación si estas
pruebas van a correr. Si Playwright no está disponible, esas pruebas deben
quedar `BLOCKED`, nunca `PASS`.

### 11.5 Pruebas de rendimiento

Medir:

* Promedio.
* p50.
* p95.
* p99 cuando el volumen lo permita.
* Errores HTTP.
* Timeouts.
* Reintentos.
* Consultas lentas.

Umbrales provisionales, salvo que el proyecto tenga otros más estrictos
(medidos contra el dev server local — documenta que producción en Vercel
tendrá otro perfil):

* Crear pedido: p95 ≤ 1,5 segundos.
* Actualizar cocina: p95 ≤ 1 segundo.
* Cobrar: p95 ≤ 2 segundos.
* Consultar cierre diario: p95 ≤ 3 segundos.
* Reporte semanal: p95 ≤ 5 segundos.
* Checkout público usable: ≤ 3 segundos en condiciones normales.

Cualquier regresión importante debe documentarse.

## 12. FORMATO DE EVIDENCIA POR ESCENARIO

Cada prueba debe producir evidencia estructurada:

```text
ID:
Nombre:
Día:
Run ID:
Commit:
Actor:
Rol:
Sede:
Canal:
Fecha de negocio:

Precondiciones:
Acción ejecutada:
Payload:
Respuesta HTTP:
Resultado visual, si aplica:

Esperado:
Resultado real:
Consulta de base de datos:
Registros afectados:
Autor de auditoría:
Sede registrada:
Impacto en caja:
Impacto en inventario:
Impacto en reportes:
Notificación esperada:
Notificación obtenida:

Estado:
PASS | FAIL | BLOCKED | NOT_APPLICABLE | PENDING_FIX

Bug relacionado:
Test de regresión:
Commit del fix:
Evidencia posterior al fix:
```

No es necesario exponer secretos, tokens ni claves.

## 13. CONTABILIDAD INDEPENDIENTE

Debe existir un libro contable esperado independiente del sistema, por ejemplo:

```text
scripts/sim/lib/expected-ledger.mjs
```

Este libro no puede usar los totales calculados por el sistema como fuente de verdad.

Debe calcular independientemente:

* Ventas brutas.
* Descuentos.
* Impuestos, si existen.
* Delivery.
* Propinas, si existen.
* Total por pedido.
* Total por método.
* Pagos mixtos.
* Cambio.
* Abonos.
* Cuentas pendientes.
* Cancelaciones.
* Devoluciones.
* Gastos.
* Compras.
* Cuentas por pagar.
* Saldos de proveedor.
* Efectivo esperado.
* Efectivo declarado.
* Diferencia.
* Ventas por sede.
* Ventas por vendedor.
* Ventas por canal.
* Ventas por fecha de origen.
* Cobros por fecha de recepción del dinero.

Toda diferencia de 0,01 o más es un bug.

## 14. POLÍTICAS CONTABLES OBLIGATORIAS

Salvo que el sistema tenga una regla empresarial documentada diferente, se utilizarán estas reglas:

1. El pedido conserva su fecha y sede de origen.
2. El dinero cobrado pertenece al cierre en el que se recibió.
3. Una cuenta abierta no cobrada no forma parte del efectivo recibido.
4. Los reportes deben distinguir:
   * Venta originada.
   * Dinero cobrado.
   * Pendiente.
5. Un cambio de precio no modifica pedidos anteriores ya confirmados.
6. El precio aplicado debe quedar guardado en el detalle del pedido.
7. Los pagos mixtos deben sumar exactamente el total.
8. Una segunda pata debe completar el saldo sin duplicar la primera.
9. Un reintento con la misma clave de idempotencia no crea otro pago.
10. Los gastos se descuentan del cierre correspondiente a su fecha efectiva.
11. Las compras no deben contarse dos veces como gasto y como salida adicional.
12. El abono a proveedor reduce exactamente el saldo pendiente.
13. La cancelación debe conservar trazabilidad y motivo.
14. El inventario solo se repone cuando la regla de negocio indique que los insumos son recuperables.
15. Producto ya preparado o consumido no debe reponerse automáticamente sin una operación explícita.
16. No deben existir pagos huérfanos.
17. No deben existir pedidos marcados como pagados cuyo total pagado sea menor.
18. No deben existir sobrepagos silenciosos.
19. No deben utilizarse números de punto flotante para dinero cuando provoquen errores de precisión.
20. Los montos canónicos deben guardarse de forma exacta, preferiblemente en unidades mínimas o decimal seguro.

## 15. PRUEBAS DE DINERO

Probar como mínimo:

* `0`.
* `0,00`.
* `0.01`.
* `0,01`.
* `1`.
* `1,5`.
* `1,50`.
* `3.632`.
* `3,632`.
* `9.648,99`.
* `9,648.99`.
* Espacios.
* Símbolos de moneda.
* Texto inválido.
* Valores negativos.
* Más de dos decimales.
* Números muy grandes.
* Pago exacto.
* Pago insuficiente.
* Sobrepago.
* Efectivo con cambio.
* Pago mixto de dos patas.
* Pago mixto de tres patas, si el sistema lo permite.
* Segunda pata varios minutos después.
* Segunda pata otro día.
* Doble envío.
* Reintento tras timeout.
* Dos cajeros cobrando simultáneamente.
* Método equivocado corregido.
* Pago reportado por cliente.
* Pago reportado con monto incorrecto.
* Pago reportado duplicado.
* Pago reportado en Bs.
* Conversión o tasa, si existe.
* Cambio de tasa durante el día, si existe.
* Redondeos.
* Centavos residuales.

## 16. MATRIZ COMPLETA DE MÓDULOS Y FLUJOS

Ningún punto puede omitirse silenciosamente.

### 16.1 Autenticación y sesiones

* Crear usuario por rol.
* Login correcto.
* Contraseña incorrecta.
* Usuario inexistente.
* Usuario desactivado.
* Token antiguo de usuario desactivado.
* Sesión expirada.
* Cerrar sesión.
* Cambio de usuario.
* Dos pestañas del mismo usuario.
* Dos usuarios en navegadores distintos.
* Actualización de rol con sesión activa.
* Cambio de sede.
* Acceso directo a URL no autorizada.
* API llamada manualmente sin permiso.
* Refresh token.
* Recuperación de contraseña, si existe.
* Bloqueo o límite de intentos, si existe.

### 16.2 Roles y permisos

Probar permisos positivos y negativos para:

* Owner.
* Manager.
* Cashier.
* Kitchen.
* Waiter.
* Delivery.
* Promoter.
* Support.
* Cliente público.

Cada rol debe intentar:

* Lo que sí puede hacer.
* Lo que no puede hacer.
* La misma acción por interfaz.
* La misma acción directamente por API.
* La misma acción con un ID de otra sede.

### 16.3 Aislamiento por sede

Probar:

* `x-branch-id` correcto.
* `x-branch-id` ausente.
* `x-branch-id` inválido.
* `x-branch-id` de otra sede.
* ID real de pedido de otra sede.
* ID real de cuenta de otra sede.
* ID real de proveedor de otra sede.
* ID real de cierre de otra sede.
* Consulta consolidada por owner.
* Consulta limitada por manager.
* RLS directa.
* API.
* Reportes.
* Exportaciones.
* Notificaciones.
* QR público.
* Caché y almacenamiento local.

Una sede jamás puede leer, modificar, cobrar, cancelar ni mezclar información de otra sin permiso explícito.

### 16.4 Menú

* Crear producto.
* Editar producto.
* Desactivar.
* Agotar.
* Reactivar.
* Variaciones.
* Adicionales.
* Ingredientes.
* Receta.
* Precio por sede.
* Herencia desde principal.
* Override local.
* Cambio de precio.
* Pedidos antiguos conservan precio.
* Producto sin receta.
* Producto con receta incompleta.
* Producto con insumo agotado.
* Combo.
* Combo con componente agotado.
* Imágenes.
* Orden de visualización.
* Menú público.
* Menú staff.
* Caché del menú.
* Actualización de menú con PWA abierta.

### 16.5 Pedidos

* Mesa con cuenta.
* Mesa sin cuenta.
* Pick up.
* Delivery.
* Pedido público QR.
* Pedido creado por staff.
* Pedido vacío.
* Cantidad cero.
* Cantidad negativa.
* Cantidad excesiva.
* Producto repetido.
* Variación.
* Adicional.
* Observaciones.
* Número grande de pedido.
* Cliente sin teléfono.
* Teléfono inválido.
* Dirección incompleta.
* GPS.
* Distancia.
* Costo por kilómetro.
* Cambio de canal, si se permite.
* Cambio de mesa.
* Asociación a cuenta.
* Desasociación.
* Pedido enviado dos veces.
* Pedido duplicado por reintento.
* Pedido creado con menú desactualizado.
* Pedido durante cierre de caja.
* Pedido cuando la sede está cerrada.
* Pedido con producto recién agotado.

### 16.6 Cocina

* Comanda al enviar.
* Orden de comandas.
* Producto a producto.
* Marcar en preparación.
* Marcar listo.
* Marcar pedido completo.
* Reabrir, si se permite.
* Cancelar antes de cocina.
* Cancelar en cocina.
* Cancelar listo.
* Producto parcialmente listo.
* Adicional visible.
* Observación visible.
* Comanda duplicada.
* Dos cocineros actualizando simultáneamente.
* Aviso al mesonero.
* Recibo 80 mm.
* Reimpresión.
* Impresora no disponible.
* Fallo de notificación.
* Producto agotado durante preparación.

### 16.7 Mesonero

* Ver mesas asignadas.
* Crear pedido.
* Asociar a cuenta.
* Cambiar mesa.
* Entregar solo productos listos.
* Intentar entregar no listo.
* Reportar pago.
* Editar observaciones permitidas.
* Cancelar con permiso.
* No acceder a reportes financieros restringidos.
* Aviso de pedido listo.
* Dos mesoneros sobre la misma cuenta.

### 16.8 Cuentas abiertas

* Crear cuenta.
* Cuenta sin pedidos.
* Asociar varios pedidos.
* Desasociar pedido.
* Múltiples cuentas simultáneas.
* Cambiar nombre.
* Cambiar mesa.
* Cerrar cuenta.
* Cobro repartido por pedido.
* Pago parcial.
* Segunda pata.
* Cuenta que cruza cierre.
* Cuenta que cruza día.
* Cancelar pedido dentro de cuenta.
* Cuenta con pedidos de estados distintos.
* Dos cajeros intentando cobrarla.
* Cerrar cuenta vacía.
* Reabrir, si existe.
* Evitar mezclar sedes.

### 16.9 Caja y cobros

* Apertura.
* Fondo inicial.
* Métodos configurados.
* Efectivo.
* Transferencia.
* Pago móvil.
* Tarjeta, si existe.
* Pago reportado.
* Mixto.
* Cambio.
* Abono.
* Segunda pata.
* Corrección.
* Doble clic.
* Doble petición.
* Dos cajeros.
* Múltiples pestañas.
* Sesión expirada durante cobro.
* Timeout después de guardar.
* Reintento.
* Pago fallido.
* Pago huérfano.
* Sobrepago.
* Pago insuficiente.
* Pedido cancelado antes de cobrar.
* Cancelación después de pagar.
* Reembolso, si existe.

### 16.10 Cierre de caja

* Cierre por sede.
* Cierre por usuario.
* Cierre con efectivo exacto.
* Diferencia positiva.
* Diferencia negativa.
* Gastos.
* Compras.
* Cancelados.
* Pedidos pendientes.
* Cuentas abiertas.
* Pago recibido de cuenta antigua.
* Cierre concurrente con cobro.
* Segundo intento de cierre.
* Historial.
* Exportación.
* Reapertura, si existe.
* Auditoría.
* Cierre después de medianoche.
* Cierre sin operaciones.
* Cierre con sesión expirada.
* Cierre desde rol no autorizado.

### 16.11 Inventario

* Crear insumo.
* Editar.
* Unidad.
* Stock inicial.
* Compra.
* Ajuste positivo.
* Ajuste negativo.
* Receta.
* Variación.
* Adicional.
* Combo.
* Venta.
* Cancelación.
* Producto parcialmente preparado.
* Reposición.
* Stock bajo.
* Stock cero.
* Stock negativo.
* Venta concurrente de últimas unidades.
* Dos compras simultáneas.
* Historial.
* Autor.
* Sede.
* Reconciliación teórica.
* Redondeos de cantidades.
* Insumos fraccionados.
* Cambio de receta a mitad del día.
* Pedidos anteriores conservan consumo esperado.

### 16.12 Proveedores y compras

* Crear.
* Editar.
* Desactivar.
* Factura.
* Pago completo.
* Crédito.
* Abono.
* Segundo abono.
* Sobreabono.
* Vencimiento.
* Compra que suma stock.
* Compra que genera gasto.
* Evitar doble contabilización.
* Precio de insumo.
* Cambio de precio.
* Factura duplicada.
* Número de factura repetido.
* Archivo adjunto, si existe.
* Proveedor de otra sede.
* Historial.
* Saldo.
* Exportación.

### 16.13 Gastos y egresos

* Gasto directo.
* Compra.
* Reparación.
* Gasto con categoría.
* Gasto sin categoría.
* Monto inválido.
* Duplicado.
* Edición.
* Cancelación.
* Autor.
* Sede.
* Fecha.
* Impacto en cierre.
* Impacto en reportes.
* Gasto después del cierre.
* Gasto concurrente con cierre.

### 16.14 Reportes

* Diario.
* Semanal.
* Rango personalizado.
* Consolidado.
* Por sede.
* Por vendedor.
* Por canal.
* Por método.
* Por producto.
* Por categoría.
* Cancelaciones.
* Gastos.
* Compras.
* Inventario.
* Cuentas por pagar.
* Cuentas abiertas.
* Pedidos originados.
* Dinero cobrado.
* Filtros.
* Sin resultados.
* Datos grandes.
* Exportación.
* Totales de exportación iguales a pantalla y base.
* Zona horaria.
* Permisos.

### 16.15 Eventos y promotores

* Activar evento.
* Desactivar.
* Crear promotor.
* Venta atribuida.
* Venta no atribuida.
* Cambio de promotor.
* Varios promotores.
* Reporte por vendedor.
* Cancelación.
* Pago posterior.
* Cierre.
* Permisos.
* Sede.

### 16.16 Reservas

* Crear.
* Editar.
* Cancelar.
* Confirmar.
* No-show.
* Horario inválido.
* Mesa ocupada.
* Doble reserva.
* Capacidad.
* Sede.
* Notificación.
* Conversión en cuenta o pedido, si existe.

### 16.17 Encuestas y soporte

* Crear encuesta.
* Responder.
* Evitar duplicado, si corresponde.
* Asociar pedido.
* Sede.
* Privacidad.
* Ticket de soporte.
* Estado.
* Asignación.
* Historial.
* Permisos.
* Datos sensibles.

### 16.18 Auditoría

Cada acción importante debe registrar:

* Actor.
* Rol.
* Sede.
* Acción.
* Entidad.
* ID.
* Antes.
* Después.
* Motivo, si aplica.
* Fecha.
* Run ID cuando sea simulación.

Probar:

* Edición.
* Cancelación.
* Cobro.
* Cambio de método.
* Desactivación de usuario.
* Cambio de precio.
* Ajuste de inventario.
* Abono.
* Cierre.
* Intento rechazado, si se audita.
* Historial intacto de usuario despedido.

### 16.19 Configuración por sede

* Mesas.
* WhatsApp.
* QR.
* Horarios.
* Delivery.
* Costo por kilómetro.
* Menú.
* Impresora.
* Métodos de pago.
* Datos fiscales, si existen.
* Overrides.
* Herencia.
* Eliminación de override.
* Caché.
* Permisos.
* Aislamiento.

### 16.20 Checkout público

* QR de cada sede.
* Datos recordados.
* Teléfono.
* Dirección.
* GPS.
* Número grande.
* Pago reportado.
* Pago duplicado.
* Sesión anónima.
* Productos agotados.
* Cambio de precio.
* Menú desactualizado.
* Reintento.
* Mala conexión.
* Refresh.
* Back.
* Varias pestañas.
* Protección contra manipulación de precio.
* Protección contra ID de otra sede.
* Rate limit, si existe.

### 16.21 PWA y caché

* Instalación.
* Manifest.
* Iconos.
* Service Worker.
* Versión.
* Nueva versión disponible.
* Caché antiguo.
* Actualización.
* Offline.
* Reconexión.
* Operación pendiente.
* Evitar duplicado al reconectar.
* Datos de otra sede en caché.
* Cierre de sesión limpia datos sensibles.
* Usuario cambiado no ve datos del anterior.

### 16.22 Notificaciones

* Pedido recibido.
* Pedido listo.
* Pago reportado.
* Cancelación.
* Stock bajo.
* Reserva.
* Evento, si aplica.
* Notificación por sede.
* Destinatario correcto.
* No duplicada.
* Reintento.
* Tercero caído.
* VAPID.
* WhatsApp o Meta.
* Permisos denegados.
* Token inválido.
* Token expirado.

Si depende de un tercero no configurado:

* Verifica que el evento interno se generó.
* Verifica payload.
* Marca entrega externa como `BLOCKED`.
* No marques todo el flujo en verde.

## 17. CONCURRENCIA E IDEMPOTENCIA

Deben existir pruebas simultáneas reales, no solamente llamadas secuenciales rápidas.

Probar:

* Dos cajeros cobrando el mismo pedido.
* Dos cajeros cobrando la misma cuenta.
* Doble clic desde una pestaña.
* Dos pestañas enviando el mismo pago.
* Reintento después de timeout.
* Dos mesoneros agregando a una cuenta.
* Dos cocineros actualizando el mismo producto.
* Cocina y caja cancelando simultáneamente.
* Dos ventas consumiendo las últimas unidades.
* Dos compras modificando stock.
* Dos abonos al mismo proveedor.
* Cierre de caja y cobro simultáneo.
* Desactivación de usuario durante una operación.
* Cambio de precio mientras otro usuario confirma pedido.
* Producto agotado mientras un cliente confirma checkout.

Resultado obligatorio:

* Una sola operación efectiva cuando corresponda.
* Respuesta clara al perdedor de la carrera.
* Sin pagos duplicados.
* Sin stock inconsistente.
* Sin totales parciales.
* Sin auditoría contradictoria.
* Sin registros huérfanos.

## 18. FALLOS PARCIALES Y RED

Probar:

* API lenta.
* Timeout antes de guardar.
* Timeout después de guardar.
* Respuesta perdida.
* Reintento.
* Base temporalmente no disponible.
* Notificación caída.
* Impresora caída.
* Service Worker desactualizado.
* Conexión offline.
* Reconexión.
* Navegador cerrado a mitad.
* Token expirado.
* Error en una operación relacionada.
* Compra guarda factura pero falla stock.
* Compra suma stock pero falla gasto.
* Pago guarda cabecera pero falla pata.
* Pedido se crea pero falla auditoría.
* Cierre calcula pero falla confirmación.

Las operaciones críticas deben ser atómicas o recuperables.
No se acepta un estado parcialmente aplicado sin:

* Rollback.
* Estado explícito.
* Reintento seguro.
* Herramienta de reparación.
* Auditoría.

## 19. SEGURIDAD

Probar como mínimo:

* RLS.
* Acceso directo a API.
* Manipulación de `x-branch-id`.
* Manipulación de IDs.
* Escalada de rol.
* Campos extras en payload.
* Cambiar precio desde cliente.
* Cambiar total desde cliente.
* SQL injection en campos de texto.
* XSS en observaciones, nombres y direcciones.
* CSRF si aplica.
* Exposición de claves.
* `service_role` nunca en cliente.
* Tokens en logs.
* Datos sensibles en exportaciones.
* Rate limiting, si existe.
* Enumeración de pedidos.
* Acceso a pedidos públicos de otra persona.
* Usuario desactivado con token antiguo.
* Storage y archivos.
* URLs firmadas.
* Auditoría de intentos rechazados.

No destruyas datos ni realices pruebas ofensivas fuera del entorno autorizado.

## 20. INTERFAZ, USABILIDAD Y ACCESIBILIDAD

Con pruebas automatizadas de navegador:

* Navegación por teclado.
* Foco visible.
* Etiquetas.
* Botones con nombre accesible.
* Formularios con errores claros.
* Contraste razonable.
* Estados de carga.
* Botón deshabilitado durante envío.
* Prevención de doble clic.
* Mensajes de error comprensibles.
* Diseño responsive.
* Móvil.
* Tablet.
* Escritorio.
* Impresión 80 mm.
* Elementos no cortados.
* Totales siempre visibles.
* Confirmaciones para acciones destructivas.
* No perder información al volver atrás.
* No mostrar datos de otra sede durante cargas.

Utiliza herramientas como Playwright y axe si están disponibles.

## 21. CALIDAD DE CÓDIGO Y GATES

Al final de cada fase que toque código:

```text
tsc
vitest
tests de integración
tests E2E relacionados
build
qa:db-state
```

Además:

* Sin errores de lint críticos.
* Sin tests saltados sin explicación.
* Sin `.only`.
* Sin snapshots actualizados ciegamente.
* Sin secretos.
* Sin logs temporales.
* Sin comentarios de "TODO" para ocultar correcciones incompletas.
* Sin tipos `any` añadidos para silenciar errores sin justificación.
* Sin desactivar reglas de seguridad.
* Sin eliminar tests existentes para hacer pasar el build.

## 22. PROTOCOLO DE CORRECCIÓN DE BUGS

Por cada bug:

### E — Error

* ID.
* Escenario.
* Resultado esperado.
* Resultado real.
* Evidencia.
* Severidad.
* Impacto.
* Datos afectados.
* Reproducción determinista.

### C — Causa raíz

* Archivo.
* Función.
* Regla rota.
* Por qué los tests anteriores no lo detectaron.

### F — Fix

* Cambio realizado.
* Migración, si aplica.
* Riesgos.
* Compatibilidad.

### S — Blindaje

* Test unitario.
* Test de integración.
* Test de flujo.
* Test de concurrencia, si aplica.
* Test de navegador, si aplica.

### V — Verificación

* Test rojo antes.
* Test verde después.
* Flujo completo repetido.
* Estado de base verificado.
* Regresión general ejecutada.

### M — Mejora

* Mejoras adicionales completas.
* Nunca dejar una mejora a medias sin marcarla como pendiente.

## 23. CRITERIOS DE SEVERIDAD

### CRÍTICO

* Riesgo para producción.
* Pérdida de dinero.
* Pago duplicado.
* Filtración entre sedes.
* Escalada de permisos.
* Pérdida de datos.
* Cierre incorrecto.
* Inventario gravemente inconsistente.

### ALTO

* Reporte financiero incorrecto.
* Usuario desactivado sigue operando.
* Cancelación corrupta.
* Cuenta cobrada incorrectamente.
* Pedido queda en estado imposible.

### MEDIO

* Notificación no enviada.
* Error de navegación.
* Exportación incorrecta.
* Problema de impresión.
* Rendimiento degradado.

### BAJO

* Texto.
* Alineación.
* Mensaje poco claro.
* Mejora de usabilidad sin impacto operativo.

No continúes acumulando escenarios sobre un bug crítico que invalide la contabilidad base. Corrígelo y repite desde el último checkpoint confiable.

## 24. VERIFICACIONES DE INTEGRIDAD GLOBAL

Buscar expresamente:

* Pedidos sin detalles.
* Detalles sin pedido.
* Pagos sin pedido o cuenta.
* Patas de pago incompletas.
* Pedidos pagados con saldo pendiente.
* Pedidos no pagados con pagos completos.
* Cuentas cerradas con saldo.
* Cuentas abiertas sin sede.
* Inventario sin historial.
* Movimientos sin autor.
* Movimientos sin sede.
* Facturas sin proveedor.
* Abonos mayores al saldo.
* Cierres duplicados.
* Cierres con operaciones posteriores mal asignadas.
* Usuarios desactivados con acciones nuevas.
* Auditorías sin actor.
* Registros de una sede ligados a otra.
* Totales negativos imposibles.
* Estados no reconocidos.
* Timestamps futuros inesperados.
* Duplicados por idempotencia fallida.

## 25. ENTREGABLES OBLIGATORIOS

### 25.1 Por fase

* Objetivo.
* Escenarios.
* Resultados.
* Bugs.
* Fixes.
* Tests.
* Comandos ejecutados.
* Commit.
* Pendientes.

### 25.2 Por módulo

* `(E)` errores encontrados.
* `(C)` causa raíz.
* `(F)` fix.
* `(S)` blindaje.
* `(M)` mejoras.
* Evidencia.
* Estado final.

### 25.3 Archivos

* Scripts.
* Tests.
* Migraciones `.sql`.
* Bitácoras.
* Libro contable esperado.
* Reporte de inventario.
* Reporte de rendimiento.
* Reporte de seguridad.
* Checklist completo.
* Resumen final.
* `TE TOCA A TI`.

## 26. REGLA ANTI-INCOMPLETO

Antes de declarar finalizado:

1. Repasa este prompt punto por punto.
2. Marca cada punto:
   * PASS.
   * FAIL.
   * BLOCKED.
   * NOT_APPLICABLE.
3. Incluye evidencia.
4. No uses "parece".
5. No uses "debería".
6. No uses "probablemente".
7. No uses "según el código".
8. No ocultes pendientes.
9. No llames "perfecto" al sistema si hay bloqueos no resueltos.
10. No cierres con pruebas críticas faltantes.

Un cierre válido requiere:

* Todo lo aplicable en `PASS`, o
* Pendientes explícitos y justificados,
* Sin falsos verdes,
* Sin diferencias contables,
* Sin filtraciones entre sedes,
* Sin bugs críticos abiertos.

## 27. LISTA "TE TOCA A TI"

Solo incluye acciones que realmente requieren intervención del usuario:

* Aplicar migración.
* Aprobar una decisión empresarial.
* Configurar Meta.
* Configurar WhatsApp.
* Configurar VAPID.
* Dar credenciales de un entorno de prueba.
* Ejecutar deploy.
* Probar hardware físico no disponible.
* Confirmar una política que no pueda derivarse del sistema.

Cada punto debe indicar:

```text
Acción:
Por qué:
Archivo o comando:
Riesgo:
Cómo verificar:
Qué pruebas quedan bloqueadas:
```

## 28. PRINCIPIO FINAL

Tu misión no es terminar rápido.
Tu misión es que el sistema soporte el comportamiento real de empleados y clientes sin:

* Perder dinero.
* Duplicar operaciones.
* Mezclar sedes.
* Corromper inventario.
* Ocultar errores.
* Romper historial.
* Permitir acciones indebidas.
* Declarar pruebas no realizadas como completadas.

No afirmes que Brotherhood está completamente certificado hasta que exista evidencia reproducible para cada punto aplicable de este prompt.
