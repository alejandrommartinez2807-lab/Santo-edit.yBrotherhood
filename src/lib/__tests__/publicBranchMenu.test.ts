import { describe, expect, it } from "vitest"
import { getPublicMenuProductsForBranch } from "@/lib/publicBranchMenu"
import type { MenuProduct } from "@/lib/orders"

function product(id: number, name: string): MenuProduct {
  return { id, name, category: "Burgers", price: 10, isActive: true } as MenuProduct
}

const principalMenu = [product(1, "Smash Doble"), product(2, "2Pac Shakur")]

function depsWith(menusByBranch: Record<string, MenuProduct[]>, defaultBranchId: string | null) {
  return {
    getMenuProducts: async (_options?: { includeInactive?: boolean }, branchId?: string | null) => {
      if (!branchId) return Object.values(menusByBranch).flat()
      if (!(branchId in menusByBranch)) throw new Error(`invalid input syntax for type uuid: "${branchId}"`)
      return menusByBranch[branchId]
    },
    getDefaultBranchId: async () => defaultBranchId,
  }
}

describe("getPublicMenuProductsForBranch", () => {
  it("una sede con menú propio usa sus productos", async () => {
    const deps = depsWith({ principal: principalMenu, "san-diego": [product(9, "Solo SD")] }, "principal")

    const products = await getPublicMenuProductsForBranch("san-diego", deps)
    expect(products.map((item) => item.name)).toEqual(["Solo SD"])
  })

  it("una sede activa sin menú propio hereda el menú de la sede por defecto", async () => {
    const deps = depsWith({ principal: principalMenu, "san-diego": [] }, "principal")

    const products = await getPublicMenuProductsForBranch("san-diego", deps)
    expect(products.map((item) => item.name)).toEqual(["Smash Doble", "2Pac Shakur"])
  })

  it("un id de sede viejo o dañado guardado en el navegador hereda el menú por defecto en vez de fallar", async () => {
    const deps = depsWith({ principal: principalMenu }, "principal")

    const products = await getPublicMenuProductsForBranch("sede-que-ya-no-existe", deps)
    expect(products.map((item) => item.name)).toEqual(["Smash Doble", "2Pac Shakur"])
  })

  it("la propia sede por defecto sin productos no reconsulta en bucle", async () => {
    const deps = depsWith({ principal: [] }, "principal")

    const products = await getPublicMenuProductsForBranch("principal", deps)
    expect(products).toEqual([])
  })

  it("sin sede resuelta mantiene el comportamiento previo (menú sin filtrar)", async () => {
    const deps = depsWith({ principal: principalMenu }, "principal")

    const products = await getPublicMenuProductsForBranch(null, deps)
    expect(products).toHaveLength(2)
  })
})
