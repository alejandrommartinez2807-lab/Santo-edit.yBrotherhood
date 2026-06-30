import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(__dirname, "..", "..");

function readSource(relativePath: string) {
  return readFileSync(resolve(SRC, relativePath), "utf8");
}

describe("Mutaciones multi-sede · borrados y resumen operativo", () => {
  it("los borrados de menú, inventario y recetas pasan branchId a la capa de datos", () => {
    expect(readSource("app/api/menu-products/route.ts")).toMatch(
      /deleteMenuProduct\(productId, await resolveBranchId\(request\)\)/,
    );
    expect(readSource("app/api/inventory/route.ts")).toMatch(
      /deleteInventoryItem\(itemId, await resolveBranchId\(request\)\)/,
    );
    expect(readSource("app/api/inventory-recipes/route.ts")).toMatch(
      /deleteInventoryRecipe\(recipeId, await resolveBranchId\(request\)\)/,
    );
  });

  it("la capa de inventario filtra por branch_id al borrar insumos y recetas", () => {
    const inventoryStore = readSource("lib/ordersInventory.ts");

    expect(inventoryStore).toMatch(/deleteInventoryItem\(itemId: string, branchId\?: string \| null\)/);
    expect(inventoryStore).toMatch(/deleteInventoryRecipe\(recipeId: string, branchId\?: string \| null\)/);
    expect(inventoryStore).toMatch(/query = query\.eq\("branch_id", branchId\)/);
  });

  it("el resumen operativo por sede cuenta datos siempre con branch_id", () => {
    const summaryRoute = readSource("app/api/branches/operations-summary/route.ts");

    expect(summaryRoute).toMatch(/COUNT_TARGETS/);
    expect(summaryRoute).toMatch(/\.eq\("branch_id", branchId\)/);
    expect(summaryRoute).toMatch(/access\.role !== "owner" && access\.role !== "support"/);
  });
});
