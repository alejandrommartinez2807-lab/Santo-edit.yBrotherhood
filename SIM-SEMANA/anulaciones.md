# Prueba de la política de anulaciones (BH-SIM-005)

run: brotherhood-week-001 · inicio real: 2026-07-29T15:48:09.214Z


---
reanudado: 2026-07-29T15:49:02.885Z

- `FAIL` **ANU-1** anulación personal con dinero que SE QUEDÓ: origen/quién/insumos/dinero estructurados — origen=undefined motivo=undefined por=undefined(undefined) insumos=undefined dinero=undefined $undefined
- `PASS` **ANU-2** la nota del pedido explica que el dinero se quedó en caja (visible sin migración) — nota=o) · Dueño | Ingredientes USADOS: el inventario queda descontado | Dinero cobrado ($8.00) se quedó en caja (no es venta)
- `PASS` **ANU-3** el dinero cobrado NO se borró del pedido (jamás se pierde información) — recibido=$8 estado=Pagado
- `FAIL` **ANU-4** sin respuesta sobre el dinero: aplica el DEFAULT devuelto (supuesto 2026-07-29) — dinero=undefined $undefined
- `FAIL` **ANU-5** insumos sin usar quedan estructurados (false = devueltos al stock) — insumos=undefined
- `FAIL` **ANU-6** pedido sin cobro: el destino del dinero queda NULL (no aplica), no un valor inventado — dinero=undefined monto=undefined

---
reanudado: 2026-07-29T15:50:37.162Z

- `FAIL` **ANU-1** anulación personal con dinero que SE QUEDÓ: origen/quién/insumos/dinero estructurados — origen=undefined motivo=undefined por=undefined(undefined) insumos=undefined dinero=undefined $undefined
- `PASS` **ANU-2** la nota del pedido explica que el dinero se quedó en caja (visible sin migración) — nota=o) · Dueño | Ingredientes USADOS: el inventario queda descontado | Dinero cobrado ($8.00) se quedó en caja (no es venta)
- `PASS` **ANU-3** el dinero cobrado NO se borró del pedido (jamás se pierde información) — recibido=$8 estado=Pagado
- `FAIL` **ANU-4** sin respuesta sobre el dinero: aplica el DEFAULT devuelto (supuesto 2026-07-29) — dinero=undefined $undefined
- `FAIL` **ANU-5** insumos sin usar quedan estructurados (false = devueltos al stock) — insumos=undefined
- `FAIL` **ANU-6** pedido sin cobro: el destino del dinero queda NULL (no aplica), no un valor inventado — dinero=undefined monto=undefined
- `FAIL` **ANU-7** cancelación del CLIENTE con motivo: origen cliente + motivo tal cual — origen=undefined motivo=undefined por=undefined
- `FAIL` **ANU-8** cliente sin motivo: cancel_reason NULL en la base (la UI dice 'no dejó motivo', la base no inventa) — origen=undefined motivo=undefined
- `FAIL` **ANU-9** anulación AUTOMÁTICA: origen automatico + Sistema + motivo del sistema + insumos devueltos — estado=Cancelado origen=undefined motivo=undefined por=undefined
- `PASS` **ANU-10** la configuración de anulación automática vuelve a como estaba — quedó=0 (original=undefined)

limpieza: 6 pedidos de prueba eliminados
nota: el pedido A1 (insumos usados) dejó su consumo descontado a propósito; el resto revirtió su inventario al anularse
