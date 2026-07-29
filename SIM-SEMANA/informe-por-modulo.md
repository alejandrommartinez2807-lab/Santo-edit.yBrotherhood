# Informe por módulo — semana real Brotherhood

Formato exigido por el Prompt Maestro §25.2: **(E)** errores, **(C)** causa
raíz, **(F)** fix, **(S)** blindaje, **(M)** mejoras. Cada estado se apoya en
evidencia de `SIM-SEMANA/dia-*.md` (checks ejecutados contra APIs reales con
verificación en base). Los módulos sin error encontrado lo dicen así, con la
prueba que lo respalda — no con un "parece que funciona".

---

## 16.1 Autenticación y sesiones — **PASS**

- **(E)** Ninguno.
- **Evidencia**: los 16 usuarios del elenco se crearon con `/api/staff` y
  entraron con Supabase Auth real (D0-AUTH-1, 16/16); la contraseña incorrecta
  se rechazó las 16 veces (D0-AUTH-2); dos pestañas del mismo usuario conviven
  (D0-AUTH-5); un `Bearer` inventado da 401 (D1-ADV-8, repetido cada día como
  `Dn-SEC-5`); un cliente que se fabrica `x-staff-role: owner` no obtiene nada
  porque el proxy borra el header (D0-PERM-5).
- **(M)** El despido del Día 5 confirmó que desactivar corta el acceso
  (D5-RRHH-2). Ver el matiz en "Roles y permisos".

## 16.2 Roles y permisos — **PASS**

- **(E)** Ninguno.
- **Evidencia**: cocina pide reportes financieros → 403 (D0-PERM-1, repetido
  cada día); mesonero intenta crear usuarios → 403 (D0-PERM-2, `Dn-SEC-2`);
  promotora intenta cerrar caja → 403 (D0-PERM-3); manager intenta crear
  insumos → 403 (D0-PERM-6); cajera intenta cerrar el día → 403 (D1R-PERM-1);
  el mesonero no puede cancelar (descubierto en D1-CX-1 y confirmado como
  diseño correcto: `canRoleUpdateStatus` reserva la anulación a
  owner/manager/cashier).
- **(M)** Ninguna pendiente.

## 16.3 Aislamiento por sede — **PASS**

- **(E)** Ninguno en toda la semana.
- **Evidencia**: la cajera de San Diego mandando `x-branch-id` de Principal
  recibe 0 pedidos de Principal (D1-ADV-3 con 31 pedidos reales en juego, y
  `Dn-SEC-1` cada día); anular un pedido de la otra sede manipulando su id no
  tiene efecto (`Dn-SEC-3`); el manager de SD solo ve su sede en la lista
  (D0-PERM-4); cada sede publica su propio WhatsApp sin filtrar el de la otra
  (D0-SEDE-6); el producto exclusivo de SD no se puede pedir desde el QR de
  Principal (D3-QR-1); verificación nocturna `NOCHE-sedes` en 0 cruces todos
  los días.

## 16.4 Menú — **PASS**

- **(E)** Ninguno propio del módulo (el bug del precio era del endpoint de
  pedidos, no del menú).
- **Evidencia**: 15 productos por sede con variaciones, adicionales, combos y
  recetas (D0-MENU-1/3); San Diego SIN menú propio hereda el de Principal
  (D0-MENU-2) y deja de heredar al tener el suyo (D0-MENU-4); precio distinto
  por sede: Doble Brutal $9.50 en Principal y $10 en SD (D0-MENU-5); ninguna
  sede ve el exclusivo de la otra (D0-MENU-6); cambio de precio en vivo con
  pedidos anteriores intactos (D4-PRECIO-2), menú público actualizado al
  instante (D4-PRECIO-3) y cliente con caché vieja pagando el precio NUEVO
  (D4-PRECIO-4).

## 16.5 Pedidos — **FAIL → corregido (BH-SIM-001)**

- **(E)** El endpoint público aceptaba el precio que mandaba el navegador: una
  Doble Brutal de $9.50 se guardó en $0.01 (D1-ADV-5, pedido
  `ord-ms5k7igt-uz0ogl9bl0`).
- **(C)** `src/app/api/orders/route.ts` usaba `normalizeItems(body.items)` sin
  recalcular contra el menú; ningún test adversarial público existía.
- **(F)** `src/lib/publicOrderGuards.ts` — re-precio desde el menú real de la
  sede para peticiones sin identidad de staff.
- **(S)** `src/lib/__tests__/publicOrderGuards.test.ts` (12 casos).
- **(V)** Verificado empíricamente y re-probado cada día como `Dn-SEC-4`:
  el precio fabricado se guarda al precio real.
- **Otras pruebas del módulo, todas PASS**: pedido vacío y cantidad cero
  rechazados (D1-ADV-6); doble clic con clave de idempotencia no duplica
  (D1-ADV-1, D6-FALLO-1); pedido de mesa con teléfono NO se reclasifica a
  delivery (D3-QR-2, el pitfall conocido); cambio de mesa (D6-HUM-1).

## 16.6 Cocina — **PASS** (entrega física BLOCKED)

- **(E)** Ninguno.
- **Evidencia**: ciclo Nuevo→Preparando→Listo→Entregado en cientos de pedidos;
  el mesonero NO puede entregar lo que no está Listo (D1-ADV-2, compuerta de
  LISTO); dos cocineros marcando Listo a la vez dejan un solo estado coherente,
  el perdedor recibe 409 (D2-CONC-1); cocina y caja anulando a la vez dejan una
  sola anulación (D2-CONC-2).
- **BLOCKED**: impresión física de comanda y recibo 80mm (sin hardware) y
  entrega real del push al mesonero (sin VAPID). El evento interno sí se
  genera; la entrega externa no se puede observar aquí.

## 16.7 Mesonero — **PASS**

- **(E)** Ninguno.
- **Evidencia**: crea pedidos y cuentas, asocia pedidos, entrega solo lo Listo
  (D1-ADV-2), no accede a reportes financieros (D4-RRHH-6 con el usuario
  contratado a mitad de semana), no puede crear usuarios (`Dn-SEC-2`).

## 16.8 Cuentas abiertas — **PASS**

- **(E)** Ninguno.
- **Evidencia**: cuenta con 4 pedidos cobrada completa con reparto por pedido
  (D1-CTA-5/6); cuenta cobrada pedido a pedido con métodos distintos
  (D1-CTA-3); cuenta de 6 pedidos cobrada en mixto (D1-CTA-7); cuenta que
  CRUZA el día: nace el Día 5, no entra en el dinero de ese cierre, se cobra el
  Día 6 y el pedido conserva su origen (D5 carry → D6-CTA-1/2/3); la cuenta
  abierta al cierre del Día 1 quedó fuera del dinero cobrado y dentro del
  pendiente (D1R-CIERRE-CTA).

## 16.9 Caja y cobros — **PASS** (con BH-SIM-002 corregido)

- **(E)** BH-SIM-002: la tasa del pedido la fijaba el cliente y el cobro en Bs
  la usa para convertir → pagar Bs a tasa 4 en vez de 40 daba el pedido por
  Pagado. Corregido (ver `bugs.md`).
- **Evidencia PASS**: efectivo, efectivo con cambio, transferencia, pago móvil,
  punto, Zelle y mixto ejecutados cientos de veces con el libro cuadrando al
  centavo; cobro en DOS PATAS con candado optimista (segunda pata completa el
  saldo sin duplicar la primera); dos cajeros cobrando el mismo pedido → solo
  uno gana (D5-CONC-1); doble clic en cobrar no cobra dos veces (D6-HUM-2);
  corrección de método con trazabilidad (D6-HUM-3); pago reportado por el
  cliente con formato venezolano `9.648,99` (D1R-ADV-7); referencia corta
  rechazada por el servidor, no solo por el navegador (evidencia D1-ADV-7).

## 16.10 Cierre de caja — **PASS**

- **(E)** Ninguno.
- **Evidencia**: los cierres comerciales de cada día y sede cuadran AL CENTAVO
  con el libro contable independiente (`dia-N-CIERRE-<sede>-centavo`), incluido
  el desglose por método en USD y Bs; el cierre técnico de fundación queda
  separado del historial comercial (D7-CIERRE-1); la cajera no puede cerrar
  (D1R-PERM-1).

## 16.11 Inventario — **PASS**

- **(E)** Ninguno.
- **Evidencia**: 36 insumos (18 por sede) con stock propio; el descuento por
  receta se verificó pedido a pedido contra el libro teórico y la verificación
  nocturna `NOCHE-inventario` salió EXACTA los siete días; una anulación
  declarando que los insumos no se usaron devuelve el stock y declarando que sí
  lo deja descontado; un insumo llega exactamente a cero sin afectar a la otra
  sede (D2-STOCK-1/2); las compras suman stock con su movimiento.

## 16.12 Proveedores y compras — **PASS**

- **(E)** Ninguno.
- **Evidencia**: 5 proveedores y 5 facturas de fundación (pagadas, a crédito y
  con abono parcial) con saldos exactos (D0-COMPRA-saldos); 3 facturas nuevas
  el Día 4 sumando stock y creando la cuenta por pagar; dos abonos SIMULTÁNEOS
  no sobrepasan el saldo (D4-ABONO-1); un sobreabono de $5.000 sobre una
  factura de $260 se rechaza o se acota (D4-ABONO-2); ninguna factura quedó
  sobreabonada en la reconciliación final (REC-10).

## 16.13 Gastos y egresos — **PASS**

- **(E)** Ninguno.
- **Evidencia**: gastos de fundación y de cada día en ambas sedes, con autor,
  sede y su impacto en el cierre correspondiente.

## 16.14 Reportes — **PASS**

- **(E)** Ninguno.
- **Evidencia**: el consolidado del dueño = Principal + San Diego al centavo
  (D7-REP-1); un manager no obtiene el consolidado de las dos sedes (D7-REP-2);
  cocina no accede a reportes (403, todos los días).

## 16.15 Eventos y promotores — **PASS**

- **(E)** Ninguno.
- **Evidencia**: modo evento activado en Principal (D5-EVT-1); la promotora
  registra y cobra sus ventas (D5-EVT-2) y la venta queda atribuida a ella
  (D5-EVT-3); el reporte por vendedor responde con datos (D5-EVT-4).

## 16.16 Reservas — **NOT_APPLICABLE en esta semana**

- El módulo existe (`/api/reservations`, activado en el Día 0) pero el guion de
  la semana real no define escenarios de reserva. Está cubierto por su propia
  batería (`qa:*` y los tests de la fase 5 del módulo). **No se marca PASS**
  porque no se ejecutó aquí.

## 16.17 Encuestas y soporte — **NOT_APPLICABLE en esta semana**

- Las encuestas dependen de WhatsApp/Meta, sin credenciales de simulación
  (usar las de producción está prohibido). Queda `BLOCKED` para entrega real y
  fuera del alcance de esta corrida.

## 16.18 Auditoría — **PASS**

- **(E)** Ninguno.
- **Evidencia**: `staff.created` por cada usuario (D0-AUDIT-1); todos los
  cobros del día con actor y rol reales (D1R-AUDIT-1: 37/37 con actor); las
  anulaciones guardan motivo, autor y efecto declarado sobre el inventario; la
  verificación nocturna `NOCHE-integridad` no encontró una sola fila de
  auditoría sin actor en toda la semana; el historial del empleado despedido
  quedó intacto (D5-RRHH-3).

## 16.19 Configuración por sede — **PASS**

- **(E)** Ninguno.
- **Evidencia**: San Diego con sus mesas y WhatsApp propios vía el mecanismo
  real del módulo Sucursales (`PATCH /api/branches/:id/config`, D0-SEDE-5);
  envío por distancia configurado solo en Principal, con el servidor cotizando
  $2 para 2,4 km (D1R-DELIV-1).

## 16.20 Checkout público — **FAIL → corregido**

- Ver BH-SIM-001 y BH-SIM-002 arriba. Tras el fix: precio fabricado corregido
  al del menú, producto de otra sede rechazado, producto inexistente rechazado,
  tasa fabricada pisada por la del negocio, y el cliente honesto no se ve
  afectado.

## 16.21 PWA y caché — **BLOCKED (parcial PASS por API)**

- Sin Playwright instalado, Service Worker, instalación, offline real y
  multipestaña de navegador quedan `BLOCKED` por la regla §11.4 — nunca PASS
  por inspección manual.
- Lo verificable por API SÍ se probó: dos sesiones simultáneas del mismo
  usuario (D0-AUTH-5), reenvío de la cola offline sin duplicar gracias a la
  clave de idempotencia (D1-ADV-1, D6-FALLO-1) y cliente con menú viejo en
  caché pagando el precio nuevo (D4-PRECIO-4).

## 16.22 Notificaciones — **BLOCKED (entrega externa)**

- Sin VAPID ni Meta en el entorno de simulación. Se comprobó que la operación
  interna ocurre y no rompe el flujo; la entrega a un dispositivo real no es
  observable aquí y por eso NO se marca en verde.
