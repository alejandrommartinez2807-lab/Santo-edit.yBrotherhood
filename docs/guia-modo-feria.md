# Guía: operar una feria o evento con el sistema

Checklist para montar un puesto en una feria/evento de punta a punta con las
piezas que ya existen. Sirve como guion de entrega al negocio.

## Antes del evento
1. **Sede del evento**: en Configuración → Sedes crea una sede para el evento
   (ej. "Feria La Candelaria") o usa una existente. Todo lo operado con esa
   sede queda separado: pedidos, cierres, reportes e inventario.
2. **Usuarios**: en Usuarios crea a cada vendedor con rol
   **Promotor (eventos/ferias)** — solo ve panel, caja, comprobantes y
   tickets. Asigna la sede del evento a cada uno (así no pueden operar otra).
3. **Menú del evento**: con la sede del evento seleccionada (banner de sede en
   Menú editable), crea o ajusta el menú del puesto. Si no creas menú propio,
   hereda el de la sede principal.
4. **Pagos**: revisa métodos de pago públicos y sus datos (pago móvil, Zelle)
   en Configuración → Información pública.
5. **QR**: imprime el QR del menú público de la sede (Caja → QR y enlaces).

## Durante el evento
- Cada promotor entra con SU clave: todo pedido y cobro queda **atribuido a su
  nombre** (visible en Auditoría y en Cierres → Ventas por vendedor).
- Pedidos del público por QR o registrados por el promotor en caja.
- Sin señal: los pedidos del cliente quedan en cola y se envían solos; las
  acciones del staff (estados) también se encolan.
- Tickets 80mm desde el módulo Tickets si hay impresora.

## Cierre del evento
- Caja → Cierre del día con la sede del evento: guarda ventas, cobros por
  método, gastos y **ventas por vendedor**; exporta el Excel con el detalle.
- El historial de cierres queda filtrado por sede; el dueño puede ver el
  consolidado de todas las sedes con el selector de alcance en Cierres y
  Reportes (`scope=all`).
- La bitácora de Auditoría guarda quién hizo cada cobro/cambio, con hora, IP
  y dispositivo, filtrable por sede y por acción.

## Qué revisar al volver
- Reportes por rango con la sede del evento → neto del evento.
- Inventario: si activaste descuento automático, revisa consumos y mermas.
- Desactiva o archiva los usuarios promotor si no van a volver a operar.
