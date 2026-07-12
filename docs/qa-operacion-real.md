# QA de operación real — guion de prueba post-entrega

Prompt reutilizable: simular la vida real del negocio ya entregado y cazar
fallas antes de que ocurran. Complementa `qa-flujos-cliente.md` (lado
cliente); este cubre el lado del STAFF y los cruces entre módulos.

## 1. Usuarios y trazabilidad
- [ ] Crear usuario por rol (dueño, encargado, caja, mesonero, cocina,
      delivery, promotor) → cada uno entra y ve SOLO sus módulos.
- [ ] Usuario restringido a una sede intenta operar otra (header manipulado)
      → queda clampeado a su sede.
- [ ] Cada acción sensible (cobro, cambio de estado, cierre, comprobante,
      compra, edición de usuario/config) aparece en Auditoría con nombre,
      rol, sede, hora e IP.
- [ ] Eliminar/desactivar usuario → no puede entrar; su historial permanece.
- [ ] Dos usuarios operando a la vez el mismo pedido → sin estados corruptos
      (el último gana y queda auditado).

## 2. Caja y cierres por sede
- [ ] Cierre del día con la sede A no incluye nada de la sede B.
- [ ] Historial de cierres filtrado por sede; dueño con scope=all ve todas.
- [ ] Cierre con pedidos activos/pagos pendientes → respeta los toggles de
      Configuración (permitir o bloquear).
- [ ] Cierre dos veces el mismo día → no duplica; corrige el existente.
- [ ] Gastos del día restan en el cierre; compras a proveedores no se
      duplican como gasto.
- [ ] Ventas por vendedor cuadran con los cobros auditados.

## 3. Dashboard del dueño y reportes
- [ ] Números del dashboard = suma de los reportes del mismo rango.
- [ ] Cambiar de sede en el dashboard cambia TODOS los bloques (no queda
      ninguno pegado al consolidado).
- [ ] Reporte de rango que cruza un cambio de tasa → cada pedido usa su tasa.
- [ ] Exportes (Excel/CSV) abren bien y cuadran con pantalla.

## 4. Cocina
- [ ] Pedido nuevo suena/aparece; marcar Listo avisa a caja.
- [ ] Ítems con confirmación de personal no entran a cocina hasta confirmarse.
- [ ] Producto pausado a mitad de servicio → no llegan pedidos nuevos con él.

## 5. Egresos (control de gastos)
- [ ] Gasto simple, compra a proveedor y pago parcial a proveedor → los tres
      aparecen donde toca (egresos, cuentas por pagar, cierre) sin duplicarse.
- [ ] Alertas de inventario bajo generan sugerencia de compra coherente.

## 6. Inventario
- [ ] Venta con receta descuenta stock; dry-run no descuenta.
- [ ] Ajuste manual + venta simultánea → stock final coherente.
- [ ] Stock negativo bloqueado o alertado (no silencioso).

## 7. Multi-dispositivo / concurrencia
- [ ] Caja en dos equipos a la vez: cobros no se duplican; el sondeo refresca.
- [ ] Teléfono del mesonero con sesión vieja (sede cambiada) → banner de sede
      correcto tras recargar.
- [ ] Corte de internet en pleno cobro → error claro, sin cobro fantasma;
      reintento no duplica.

## 8. Datos hostiles
- [ ] Nombres con emojis/acentos/300 caracteres en cliente, mesa y notas.
- [ ] Montos con coma/punto/miles en todos los inputs de dinero.
- [ ] Fotos pesadas o no-imagen en comprobantes y menú → error amable.
- [ ] URLs basura en link de Maps y en imagen de producto.

## 9. Ciclo de vida del negocio
- [ ] Cambiar plan (bajar de plan) → módulos bloqueados avisan, sin crash.
- [ ] Apagar un módulo con datos ya creados (reservas, delivery) → los datos
      no se pierden; al reactivar reaparecen.
- [ ] Cambiar branding/colores → público y staff sin restos del tema viejo.
