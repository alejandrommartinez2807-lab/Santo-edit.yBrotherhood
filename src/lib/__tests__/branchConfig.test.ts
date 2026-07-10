import { describe, expect, it } from "vitest";
import {
  copyBranchConfigInRawBusinessConfig,
  getBranchConfig,
  mergeRawBusinessConfigWithBranchConfig,
  normalizeBranchScopedConfig,
} from "@/lib/branch";

describe("branch scoped business config", () => {
  it("normaliza campos públicos y mesas por sede", () => {
    const config = normalizeBranchScopedConfig({
      publicName: " Sede Centro ",
      address: " Av. Principal ",
      zone: " Centro ",
      estimatedTimeText: "20 min",
      mainWhatsapp: " 584121111111 ",
      ordersPaused: "si",
      temporarilyClosed: "no",
      localTables: "Mesa 1 | Principal\nMesa 2 | Terraza",
    });

    expect(config.publicName).toBe("Sede Centro");
    expect(config.address).toBe("Av. Principal");
    expect(config.ordersPaused).toBe(true);
    expect(config.temporarilyClosed).toBe(false);
    expect(config.localTables?.map((table) => table.name)).toEqual([
      "Mesa 1",
      "Mesa 2",
    ]);
  });

  it("mezcla un override sin borrar las otras sedes", () => {
    const raw = {
      businessName: "Santo Perrito",
      branchConfigs: {
        este: { publicName: "Sede Este", address: "Este" },
      },
    };

    const next = mergeRawBusinessConfigWithBranchConfig(raw, "centro", {
      publicName: "Centro",
      ordersPaused: true,
    });

    expect(getBranchConfig(next, "este").publicName).toBe("Sede Este");
    expect(getBranchConfig(next, "centro").publicName).toBe("Centro");
    expect(getBranchConfig(next, "centro").ordersPaused).toBe(true);
  });

  it("un campo en null elimina el override de la sede", () => {
    const raw = {
      branchConfigs: {
        centro: {
          publicName: "Centro",
          localTables: [{ name: "Mesa 1" }, { name: "Mesa 2" }],
        },
      },
    };

    const next = mergeRawBusinessConfigWithBranchConfig(raw, "centro", {
      localTables: null,
    });

    const config = getBranchConfig(next, "centro");
    expect("localTables" in config).toBe(false);
    expect(config.publicName).toBe("Centro");
  });

  it("mesas propias vacías se guardan como override vacío (no como ausencia)", () => {
    const next = mergeRawBusinessConfigWithBranchConfig({}, "centro", {
      localTables: [],
    });

    const config = getBranchConfig(next, "centro");
    expect("localTables" in config).toBe(true);
    expect(config.localTables).toEqual([]);
  });

  it("la marca de evento (modo evento) se normaliza y persiste por sede", () => {
    const config = normalizeBranchScopedConfig({ isEvent: "si" })
    expect(config.isEvent).toBe(true)

    const next = mergeRawBusinessConfigWithBranchConfig(
      { branchConfigs: { centro: { publicName: "Centro" } } },
      "feria",
      { isEvent: true, publicName: "Feria La Candelaria" },
    )

    expect(getBranchConfig(next, "feria").isEvent).toBe(true)
    expect(getBranchConfig(next, "centro").isEvent).toBeUndefined()
  })

  it("copia configuración de una sede a otra", () => {
    const raw = {
      branchConfigs: {
        centro: { publicName: "Centro", mainWhatsapp: "584120000000" },
      },
    };

    const next = copyBranchConfigInRawBusinessConfig(raw, "centro", "este");

    expect(getBranchConfig(next, "este")).toEqual({
      publicName: "Centro",
      mainWhatsapp: "584120000000",
    });
  });
});
