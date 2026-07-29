# Prueba de la tasa impuesta por el servidor

run: brotherhood-week-001 · inicio real: 2026-07-29T14:31:44.188Z

- `PASS` **TASA-1** modo MANUAL: la tasa del negocio (40) pisa la del cliente (4) — guardada=40
- `PASS` **TASA-2** modo AUTOMÁTICO (dólar): la tasa del BCV (744.2264) pisa la del cliente (4) — guardada=744.2264 bcv=744.2264
- `PASS` **TASA-3** modo EURO: la tasa del euro BCV (744.2264) pisa la del cliente (4) — guardada=744.2264 euro=744.2264 moneda=USD
- `FAIL` **TASA-4** el modo euro devuelve de verdad la tasa del EURO, no la del dólar — euro=744.2264 dólar=744.2264
- `PASS` **TASA-5** pagar Bs 32 (los que bastaban con tasa 4) ya NO salda un pedido de $8 — estado=Pago parcial recibido=$0.04 de $8 (tasa del pedido=744.2264)
- `PASS` **TASA-6** el STAFF conserva su tasa (55): el blindaje solo aplica al público — guardada=55
- `PASS` **TASA-7** la configuración de tasa vuelve EXACTAMENTE a como estaba — modo=manual (original=manual)

limpieza: 5 pedidos de prueba eliminados

---
reanudado: 2026-07-29T14:35:38.297Z

- `PASS` **TASA-1** modo MANUAL: la tasa del negocio (40) pisa la del cliente (4) — guardada=40
- `PASS` **TASA-2** modo AUTOMÁTICO (dólar): la tasa del BCV (744.2264) pisa la del cliente (4) — guardada=744.2264 bcv=744.2264
- `PASS` **TASA-3** modo EURO: la tasa del euro BCV (846.07378284) pisa la del cliente (4) — guardada=846.0738 euro=846.07378284 moneda=EUR
- `PASS` **TASA-4** el modo euro devuelve de verdad la tasa del EURO, no la del dólar — euro=846.07378284 dólar=744.2264
- `PASS` **TASA-5** pagar Bs 32 (los que bastaban con tasa 4) ya NO salda un pedido de $8 — estado=Pago parcial recibido=$0.04 de $8 (tasa del pedido=846.0738)
- `PASS` **TASA-6** el STAFF conserva su tasa (55): el blindaje solo aplica al público — guardada=55
- `PASS` **TASA-7** la configuración de tasa vuelve EXACTAMENTE a como estaba — modo=manual (original=manual)

limpieza: 5 pedidos de prueba eliminados
