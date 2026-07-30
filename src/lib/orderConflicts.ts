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

// Errores de negocio tipados que las rutas traducen a su código HTTP real.
// Antes llegaban al catch como Error genérico y salían 500 opacos aunque el
// bloqueo fuera correcto (QA 2026-07-30): el freno del mesonero daba 500 en
// vez de 403, y tocar un pedido de otra sede daba 500 en vez de 404.

export class OrderPermissionError extends Error {
  readonly httpStatus = 403

  constructor(message: string) {
    super(message)
    this.name = "OrderPermissionError"
  }
}

export class OrderNotFoundError extends Error {
  readonly httpStatus = 404

  constructor(message: string) {
    super(message)
    this.name = "OrderNotFoundError"
  }
}

export class OrderInvalidTransitionError extends Error {
  readonly httpStatus = 400

  constructor(message: string) {
    super(message)
    this.name = "OrderInvalidTransitionError"
  }
}

// Código HTTP del error tipado de pedidos, o null si no es uno de ellos.
export function getOrderErrorHttpStatus(error: unknown): number | null {
  if (
    error instanceof OrderActionConflictError ||
    error instanceof OrderPermissionError ||
    error instanceof OrderNotFoundError ||
    error instanceof OrderInvalidTransitionError
  ) {
    return error.httpStatus
  }
  return null
}
