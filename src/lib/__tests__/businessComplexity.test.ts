import { describe, expect, it } from "vitest";
import {
  getBusinessComplexityProfilePatch,
  isInventoryAutoDeductActuallyEnabled,
  normalizeBusinessComplexitySettings,
} from "../businessComplexity";

describe("businessComplexity", () => {
  it("normaliza aliases y permisos booleanos", () => {
    const config = normalizeBusinessComplexitySettings({
      businessComplexityProfile: "estandar",
      allowPublicOrdering: "no",
      allowDeliveryOrders: "sí",
      requireCloseReview: "1",
      showAdvancedReports: "0",
    });

    expect(config.businessComplexityProfile).toBe("standard");
    expect(config.publicAllowOrdering).toBe(false);
    expect(config.publicAllowDelivery).toBe(true);
    expect(config.internalRequireCloseReview).toBe(true);
    expect(config.internalShowAdvancedReports).toBe(false);
  });

  it("aplica perfiles sin activar inventario automático real", () => {
    const simplePatch = getBusinessComplexityProfilePatch("simple");

    expect(simplePatch.internalAllowCancelOrders).toBe(false);
    expect(simplePatch.internalRequireCloseReview).toBe(true);
    expect(simplePatch.inventoryAutoDeductEnabled).toBe(false);
    expect(simplePatch.inventoryAutoDeductDryRun).toBe(true);
    expect(
      isInventoryAutoDeductActuallyEnabled({
        inventoryAutoDeductEnabled: true,
        inventoryAutoDeductDryRun: true,
      }),
    ).toBe(false);
  });
});
