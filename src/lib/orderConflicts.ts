// Conflictos de concurrencia entre usuarios que operan el mismo módulo a la
// vez (dos cajas, caja+dueño, etc.): la MISMA acción no se aplica dos veces.
// El servidor la rechaza con este error y las rutas responden 409 para que la
// pantalla muestre el aviso y refresque, en vez de duplicar el efecto.

export class OrderActionConflictError extends Error {
  readonly httpStatus = 409

  constructor(message: string) {
    super(message)
    this.name = "OrderActionConflictError"
  }
}
