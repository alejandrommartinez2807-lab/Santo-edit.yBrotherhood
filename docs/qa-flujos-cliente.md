# QA de flujos del cliente — guion de prueba

Prompt reutilizable: recorrer TODOS los caminos que un cliente puede tomar y
detectar sinsentidos (textos contradictorios, botones muertos, estados
imposibles). Ejecutar contra el dev server con datos reales de la marca.

## 1. Carrito y checkout
- [ ] Carrito vacío: abrir carrito → no debe dejar "Registrar pedido".
- [ ] Agregar producto normal, combo (categoría Combos + pago normal) y
      producto configurable → precios y referencia Bs coherentes.
- [ ] Doble clic rápido en "Registrar pedido" → un solo pedido creado.
- [ ] Producto con canales limitados (solo local): elegir Delivery → aviso de
      no disponible, no se puede registrar.
- [ ] Cambiar tipo de pedido (mesa→llevar→delivery) → campos y validaciones
      cambian sin dejar restos (mesa no exige teléfono, delivery sí).
- [ ] Carrito viejo en localStorage: al recargar sincroniza modo de pago,
      canales y categoría con el menú vivo.

## 2. Mesa / QR / cuenta abierta
- [ ] Entrar con link de mesa (?mesa=) → mesa preseleccionada, aviso visible.
- [ ] Pedido en mesa con cuenta abierta activa → se asocia y el mensaje dice
      que caja cobra al cerrar (sin pasos de pago individual).
- [ ] Pedido en mesa sin cuenta abierta → pasos de pago normales.

## 3. Delivery
- [ ] Distancia activa + GPS denegado → mensaje con instrucciones y plan B
      (link de Maps).
- [ ] Link de Maps inválido/basura → error claro, no rompe.
- [ ] Fuera de cobertura → mensaje claro, no se registra.
- [ ] Distancia apagada → costo "se confirma por WhatsApp", registrar igual.
- [ ] Confirmación de dirección (mapa) antes de registrar; "Ajustar" mueve pin.

## 4. Pago
- [ ] Método simple → tras registrar: Paso 1 datos correctos filtrados al
      método + Paso 2 comprobante.
- [ ] Pago mixto incompleto (falta monto/método) → no deja registrar.
- [ ] Pago mixto completo → resumen "vas a pagar X con Y".
- [ ] Reportar pago duplicado → aviso anti-duplicado (409) con confirmación.
- [ ] Imagen > 5MB o no-imagen → error claro.

## 5. Seguimiento y regreso
- [ ] "Ver avance" → misma info de pago (Paso 1 con métodos elegidos + Paso 2)
      hasta que caja confirme; luego "Pago confirmado".
- [ ] /pedido/ord-inexistente → mensaje de no encontrado, sin crash.
- [ ] Pedidos recientes en carrito → reabre seguimiento; pedidos
      listos/entregados salen de la lista.
- [ ] /mis-pedidos sin historial → estado vacío claro.

## 6. Sedes
- [ ] Cambiar sede en el picker público → menú recarga con la nueva sede.
- [ ] Sede sin menú propio → hereda menú principal sin lista vacía.
- [ ] Sede guardada vieja/inválida en el navegador → sanea a la default.

## 7. Reservas (aunque el módulo esté apagado)
- [ ] Flag apagada → /reservar explica que no está disponible (sin crash).
- [ ] Flag activa → formulario completo, validaciones, confirmación.

## 8. Offline
- [ ] Sin conexión al registrar → pedido en cola local + mensaje "guardado sin
      conexión"; al volver internet se envía solo.

## 9. Modo evento / feria
- [ ] Con modo evento activo: pedidos atribuidos al vendedor; el flujo público
      no muestra rastros del modo (solo staff).
