import { describe, expect, it, vi, beforeEach } from "vitest"

import {
  getCaracasDayStartIso,
  getDateKeyInCaracas,
  getBusinessDayKeyInCaracas,
  getBusinessDayStartIso,
  BUSINESS_DAY_START_HOUR,
} from "@/app/pedidos/domain"

// Auditoría 2026-08-02 · hallazgo crítico del cierre después de medianoche.
//
// El local apaga a la 1:00 AM. Sus pedidos de la noche ya cuentan como "de
// ayer" en hora Caracas, así que el cierre del día los deja fuera de los
// totales; el reinicio, en cambio, vaciaba la tabla ENTERA de la sede y se
// llevaba la venta de la noche sin cierre y sin pedidos: pérdida irreversible.
//
// El arreglo acota el borrado a la jornada que el cierre acaba de fotografiar.

describe("getCaracasDayStartIso — inicio del día de negocio", () => {
  it("la medianoche de Caracas es 04:00 UTC", () => {
    expect(getCaracasDayStartIso("2026-08-04")).toBe("2026-08-04T04:00:00.000Z")
  })

  it("el instante devuelto ya pertenece a ese día en Caracas", () => {
    const start = getCaracasDayStartIso("2026-08-04")
    expect(getDateKeyInCaracas(start)).toBe("2026-08-04")
  })

  it("un milisegundo antes todavía es el día anterior", () => {
    const start = getCaracasDayStartIso("2026-08-04")
    const justBefore = new Date(Date.parse(start) - 1).toISOString()
    expect(getDateKeyInCaracas(justBefore)).toBe("2026-08-03")
  })

  it("sirve en cruce de mes y de año", () => {
    expect(getCaracasDayStartIso("2027-01-01")).toBe("2027-01-01T04:00:00.000Z")
    expect(getDateKeyInCaracas(getCaracasDayStartIso("2027-01-01"))).toBe("2027-01-01")
  })

  it("una fecha inválida no produce un filtro basura", () => {
    expect(getCaracasDayStartIso("")).toBe("")
    expect(getCaracasDayStartIso("no-es-fecha")).toBe("")
  })
})

// ---------------------------------------------------------------------------
// La jornada de negocio: corte a las 5:00 de Caracas (decisión de Alejandro).
// Caracas = UTC-4, así que las 5:00 locales son las 09:00 UTC.

describe("jornada de negocio (corte 5:00)", () => {
  it("el corte acordado son las 5 de la mañana", () => {
    expect(BUSINESS_DAY_START_HOUR).toBe(5)
  })

  it("la venta de las 23:50 y la de las 00:10 son LA MISMA jornada", () => {
    // 2026-08-04 23:50 Caracas = 2026-08-05T03:50Z
    const antesDeMedianoche = getBusinessDayKeyInCaracas("2026-08-05T03:50:00.000Z")
    // 2026-08-05 00:10 Caracas = 2026-08-05T04:10Z
    const despuesDeMedianoche = getBusinessDayKeyInCaracas("2026-08-05T04:10:00.000Z")

    expect(antesDeMedianoche).toBe("2026-08-04")
    expect(despuesDeMedianoche).toBe("2026-08-04")
  })

  it("cerrar a la 1:00 AM sigue siendo la jornada de la noche anterior", () => {
    // 2026-08-05 01:00 Caracas = 2026-08-05T05:00Z
    expect(getBusinessDayKeyInCaracas("2026-08-05T05:00:00.000Z")).toBe("2026-08-04")
  })

  it("a las 4:59 todavía es la jornada anterior; a las 5:00 empieza la nueva", () => {
    // 04:59 Caracas = 08:59Z · 05:00 Caracas = 09:00Z
    expect(getBusinessDayKeyInCaracas("2026-08-05T08:59:59.999Z")).toBe("2026-08-04")
    expect(getBusinessDayKeyInCaracas("2026-08-05T09:00:00.000Z")).toBe("2026-08-05")
  })

  it("a media tarde la jornada coincide con el día del calendario", () => {
    // 2026-08-05 14:00 Caracas = 18:00Z
    expect(getBusinessDayKeyInCaracas("2026-08-05T18:00:00.000Z")).toBe("2026-08-05")
    expect(getDateKeyInCaracas("2026-08-05T18:00:00.000Z")).toBe("2026-08-05")
  })

  it("funciona en cruce de mes y de año", () => {
    // 2027-01-01 02:00 Caracas = 2027-01-01T06:00Z → jornada del 31/12
    expect(getBusinessDayKeyInCaracas("2027-01-01T06:00:00.000Z")).toBe("2026-12-31")
    // 2026-09-01 03:00 Caracas = 07:00Z → jornada del 31/08
    expect(getBusinessDayKeyInCaracas("2026-09-01T07:00:00.000Z")).toBe("2026-08-31")
  })

  it("la jornada empieza a las 5:00 de Caracas (09:00 UTC)", () => {
    expect(getBusinessDayStartIso("2026-08-04")).toBe("2026-08-04T09:00:00.000Z")
  })

  it("el inicio de jornada pertenece a esa misma jornada", () => {
    const inicio = getBusinessDayStartIso("2026-08-04")
    expect(getBusinessDayKeyInCaracas(inicio)).toBe("2026-08-04")

    // Y un milisegundo antes es la jornada anterior.
    const justoAntes = new Date(Date.parse(inicio) - 1).toISOString()
    expect(getBusinessDayKeyInCaracas(justoAntes)).toBe("2026-08-03")
  })

  it("el pedido de las 00:10 NO se borra al cerrar esa jornada", () => {
    // Es el fallo original: el reinicio arrasaba con lo que el cierre no había
    // resumido. Ahora el filtro del borrado empieza a las 5:00 de la jornada, y
    // el pedido de las 00:10 (04:10Z del día siguiente) cae DESPUÉS de ese
    // inicio, así que está dentro del cierre que se acaba de guardar.
    const inicioJornada = Date.parse(getBusinessDayStartIso("2026-08-04"))
    const pedidoDeMadrugada = Date.parse("2026-08-05T04:10:00.000Z")

    expect(pedidoDeMadrugada).toBeGreaterThan(inicioJornada)
  })

  it("una fecha inválida no produce clave de jornada", () => {
    expect(getBusinessDayKeyInCaracas("no-es-fecha")).toBe("")
    expect(getBusinessDayStartIso("")).toBe("")
  })
})

// ---------------------------------------------------------------------------
// El borrado real: clearOrdersInStore solo puede tocar lo que entró al cierre.

const deleteChain = {
  eq: vi.fn(),
  gte: vi.fn(),
  or: vi.fn(),
}

const countChain = {
  eq: vi.fn(),
  gte: vi.fn(),
  or: vi.fn(),
}

function resetChains() {
  for (const chain of [deleteChain, countChain]) {
    chain.eq.mockReset().mockReturnValue(chain)
    chain.gte.mockReset().mockReturnValue(chain)
  }
  deleteChain.or.mockReset().mockResolvedValue({ error: null })
  countChain.or.mockReset().mockResolvedValue({ count: 3 })
}

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => countChain,
      delete: () => deleteChain,
    }),
  }),
}))

describe("clearOrdersInStore — alcance del reinicio", () => {
  beforeEach(() => {
    resetChains()
    vi.resetModules()
  })

  it("con createdFrom, el DELETE se acota a la jornada cerrada", async () => {
    const { clearOrdersInStore } = await import("@/lib/ordersStoreLifecycle")

    await clearOrdersInStore("sede-1", { createdFrom: "2026-08-04T04:00:00.000Z" })

    expect(deleteChain.eq).toHaveBeenCalledWith("branch_id", "sede-1")
    expect(deleteChain.gte).toHaveBeenCalledWith(
      "created_at",
      "2026-08-04T04:00:00.000Z",
    )
  })

  it("el conteo de borrados usa el MISMO filtro que el borrado", async () => {
    const { clearOrdersInStore } = await import("@/lib/ordersStoreLifecycle")

    await clearOrdersInStore("sede-1", { createdFrom: "2026-08-04T04:00:00.000Z" })

    expect(countChain.gte).toHaveBeenCalledWith(
      "created_at",
      "2026-08-04T04:00:00.000Z",
    )
  })

  it("sin createdFrom se conserva el comportamiento anterior (borra todo)", async () => {
    const { clearOrdersInStore } = await import("@/lib/ordersStoreLifecycle")

    await clearOrdersInStore("sede-1")

    expect(deleteChain.gte).not.toHaveBeenCalled()
    expect(deleteChain.eq).toHaveBeenCalledWith("branch_id", "sede-1")
  })

  it("sigue siendo fail-closed sin sede: no borra nada de nadie", async () => {
    const { clearOrdersInStore } = await import("@/lib/ordersStoreLifecycle")

    await expect(clearOrdersInStore(null)).rejects.toThrow(/sucursal/i)
    expect(deleteChain.eq).not.toHaveBeenCalled()
  })
})
