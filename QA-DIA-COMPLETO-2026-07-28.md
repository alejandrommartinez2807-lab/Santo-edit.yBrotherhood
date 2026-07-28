# QA · Un día completo de operación — 2026-07-28

Ronda doble: (1) la batería completa de la sesión anterior repetida desde cero, y
(2) la simulación nueva de **un día entero de operación** con inventario real
descontado, insumos nuevos a mitad del día, cierre real e historial.

Respaldo previo: `backups/santo-backup-2026-07-28T14-51-02.json` (1012 filas, 19/19 tablas).
Dev server FRESCO en :3177 (arrancado para esta ronda; identidad Brotherhood verificada).

## 1 · Batería repetida (protocolo de PROMPT-QA-CUENTAS-COBROS.md)

| Script | Resultado |
|---|---|
| `qa:open-accounts` | 42 OK, 1 falla (A3, **conocida**) |
| `qa:payments` | 27 OK, 1 falla (P3, **conocida**) |
| `qa:day-close` | 21 OK, 0 fallas |
| `qa:branches` | 15 OK, 1 falla (S1, **conocida**) |
| `qa:metodos-cobro` | 49 OK, 0 fallas |
| **Total** | **154 comprobaciones · 151 OK · 0 bugs nuevos** |

Las 3 fallas son exactamente las documentadas como abiertas:
- **A3** — quien escribe la nota puede fingir "cuenta pedida" (riesgo bajo, decisión pendiente).
- **P3** — la API acepta referencia de 4 dígitos; la regla de 6 vive solo en el navegador.
- **S1** — ninguna sede tiene WhatsApp configurado (configuración del dueño, no código).

## 2 · Día completo simulado — `npm run qa:dia-completo` (NUEVO)

**40 OK, 0 fallas.** El guion, todo en San Diego con el descuento de inventario
encendido de verdad (y restaurado al final):

- **J0 Apertura**: proveedor + 3 insumos nuevos (pan 40u/mín 12, carne 25u, papas 30 kg)
  con movimiento "Carga inicial" cada uno + 2 productos del menú con receta
  (hamburguesa = 2 pan + 1 carne; papas fritas = 1,5 kg de papas).
- **J1 Mañana**: pedido de mesa (2 hamburguesas, $16) con **ciclo de cocina completo**
  (Preparando estampa `kitchen_started_at` → Listo → Entregado) cobrado en efectivo
  divisas; para llevar (1 hamburguesa + 2 papas, $16) cobrado Bs 640 por pago móvil.
  Cada pedido descontó su receta exacta, incluida la de decimales (2 × 1,5 kg = 3 kg).
- **J2 Mediodía**: rush de 12 hamburguesas ($96, Zelle) deja el pan **por debajo del
  mínimo** (10 < 12) → llega la compra al proveedor: 60 panes por $30 con vencimiento
  a una semana. Stock 10→70 con movimiento **"Compra"**, cuenta por pagar creada y
  abono parcial de $10 (queda $20 pendiente, estado Parcial).
- **J3 Tarde**: anulación declarando que los ingredientes NO se usaron → el stock
  **vuelve** (pan 66→70, con movimiento de devolución); pedido de $8 queda sin cobrar
  y el cliente reporta su comprobante (Bs 320, por confirmar).
- **J4**: gasto del día de $15 en efectivo.
- **J5 Cierre real**: $16 efectivo + $96 Zelle + Bs 640 (=$16) = **$128 cobrados, al
  centavo**; $8 pendientes. El cierre archiva la fotografía del día (56 pedidos,
  24 comprobantes), guarda el desglose por método, marca el gasto **Cerrado** y
  limpia los comprobantes de la sede.
- **J6 Historial**: el cierre aparece en el historial de la sede **con el desglose
  intacto**, en el consolidado del dueño y en auditoría. La vida del pan quedó
  completa en movimientos: Carga inicial → 4 Consumos → Compra → Ajuste (devolución).
- **J7 Restauración**: banderas de inventario exactamente como estaban
  (apagado + dry run), comprobantes 23→23, cierres 5→5, menú 144→144 filas,
  **0 filas ZZTEST** en todas las tablas.

Detalle de implementación descubierto al escribirlo: `POST /api/orders` exige
`tableNumber` aunque el pedido sea "Para llevar" (responde 400 «Falta la mesa o
ubicación» si va vacío) — los scripts mandan un texto libre tipo "Para llevar".

## 3 · Estado de la base y línea base de código

- `qa:db-state`: 8 chequeos, 0 pendientes (RLS deny-all, bucket privado, 0031 aplicada).
- Base limpia al terminar: 0 datos de prueba, menú real intacto, comprobantes y
  cierres reales como estaban.
- Línea base: ver el resumen del commit (tsc / vitest / lint corridos en esta ronda).

## Cómo repetir

1. `npm run backup`
2. Dev server FRESCO en :3177 (un `next dev` viejo fabrica 500 con cuerpo vacío).
3. La batería de `PROMPT-QA-CUENTAS-COBROS.md` + `npm run qa:dia-completo`.
