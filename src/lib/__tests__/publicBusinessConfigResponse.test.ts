import { describe, expect, it } from "vitest"
import {
  buildPublicBusinessConfigResponse,
  cleanPromotionHref,
  cleanWhatsappNumber,
  normalizeProductIds,
  normalizePublicLocalTables,
} from "@/lib/publicBusinessConfigResponse"
import { BRAND } from "@/lib/brand"

describe("publicBusinessConfigResponse", () => {
  it("usa defaults seguros para textos base", () => {
    const response = buildPublicBusinessConfigResponse({})

    expect(response.businessName).toBe(BRAND.name)
    expect(response.businessShortDescription).toBe("Menú y pedidos")
    expect(response.publicCustomizeButtonText).toBe("Elige tus ingredientes")
    expect(response.publicCustomizerTitle).toBe("Elige tus ingredientes")
    expect(response.publicMenuTitle).toBe("Elige tu pedido")
    expect(response.productCardBackgroundColor).toBe("#ffffff")
    expect(response.productCardTextColor).toBe("#4a0000")
    expect(response.productCardBorderColor).toBe("#a00000")
    expect(response.productCardButtonColor).toBe("#ffd23c")
    expect(response.locationLabel).toBe("Mesa")
    expect(response.membershipPlan).toBe("complete")
    expect(response.membershipPlanMode).toBe("fixed")
  })

  it("limpia números de WhatsApp igual que la ruta pública anterior", () => {
    expect(cleanWhatsappNumber("+58 (414) 582-7432")).toBe("584145827432")
    expect(cleanWhatsappNumber("0414-582-7432")).toBe("584145827432")
    expect(cleanWhatsappNumber("00584145827432")).toBe("584145827432")
    expect(cleanWhatsappNumber("sin numero")).toBe("")
  })

  it("bloquea pedidos locales y delivery cuando el plan es menú digital", () => {
    const response = buildPublicBusinessConfigResponse({
      membershipPlan: "menu digital",
      deliveryEnabled: true,
      deliveryModuleEnabled: true,
    })

    expect(response.membershipPlan).toBe("menuDigital")
    expect(response.localOrdersEnabled).toBe(false)
    expect(response.deliveryEnabled).toBe(false)
    expect(response.deliveryModuleEnabled).toBe(false)
  })

  it("respeta delivery solo cuando el plan y las banderas lo permiten", () => {
    expect(
      buildPublicBusinessConfigResponse({
        membershipPlan: "operational",
        deliveryEnabled: true,
        deliveryModuleEnabled: true,
      }).deliveryEnabled
    ).toBe(true)

    expect(
      buildPublicBusinessConfigResponse({
        membershipPlan: "basic",
        deliveryEnabled: true,
        deliveryModuleEnabled: true,
      }).deliveryEnabled
    ).toBe(false)

    expect(
      buildPublicBusinessConfigResponse({
        membershipPlan: "complete",
        deliveryEnabled: false,
        deliveryModuleEnabled: true,
      }).deliveryEnabled
    ).toBe(false)
  })

  it("muestra promociones solo con módulo activo, bandera activa y contenido", () => {
    const visible = buildPublicBusinessConfigResponse({
      membershipPlan: "pro",
      promotionModuleEnabled: true,
      promotionActive: true,
      promotionTitle: " Promo del día ",
      promotionButtonHref: "/menu",
    })

    expect(visible.promotionActive).toBe(true)
    expect(visible.promotionTitle).toBe("Promo del día")
    expect(visible.promotionButtonText).toBe("Ver menú")
    expect(visible.promotionButtonHref).toBe("/menu")

    const hiddenByPlan = buildPublicBusinessConfigResponse({
      membershipPlan: "basic",
      promotionModuleEnabled: true,
      promotionActive: true,
      promotionTitle: "Promo del día",
    })

    expect(hiddenByPlan.promotionActive).toBe(false)
    expect(hiddenByPlan.promotionTitle).toBe("")
    expect(hiddenByPlan.promotionButtonHref).toBe("")

    const hiddenWithoutContent = buildPublicBusinessConfigResponse({
      membershipPlan: "pro",
      promotionModuleEnabled: true,
      promotionActive: true,
    })

    expect(hiddenWithoutContent.promotionActive).toBe(false)
  })

  it("acepta solo enlaces seguros para el botón de promoción", () => {
    expect(cleanPromotionHref("#menu")).toBe("#menu")
    expect(cleanPromotionHref("/menu")).toBe("/menu")
    expect(cleanPromotionHref("https://example.com")).toBe("https://example.com")
    expect(cleanPromotionHref("http://example.com")).toBe("http://example.com")
    expect(cleanPromotionHref("javascript:alert(1)")).toBe("")
  })

  it("activa destacados solo con módulo activo e ids válidos", () => {
    const response = buildPublicBusinessConfigResponse({
      membershipPlan: "pro",
      featuredProductsModuleEnabled: true,
      featuredProductsActive: true,
      featuredProductsTitle: "",
      featuredProductsText: " Los más pedidos ",
      featuredProductIds: "[1, 2, 2, \"3\", 0, -1, \"abc\"]",
    })

    expect(response.featuredProductsActive).toBe(true)
    expect(response.featuredProductsTitle).toBe("Favoritos de la casa")
    expect(response.featuredProductsText).toBe("Los más pedidos")
    expect(response.featuredProductIds).toEqual([1, 2, 3])

    const hidden = buildPublicBusinessConfigResponse({
      membershipPlan: "basic",
      featuredProductsModuleEnabled: true,
      featuredProductsActive: true,
      featuredProductIds: [1, 2],
    })

    expect(hidden.featuredProductsActive).toBe(false)
    expect(hidden.featuredProductIds).toEqual([])
  })

  it("normaliza ids de productos desde arrays o texto separado", () => {
    expect(normalizeProductIds([1, "2", 2, 2.7, "x", -1])).toEqual([1, 2, 3])
    expect(normalizeProductIds("1;2, 3|3|abc")).toEqual([1, 2, 3])
    expect(normalizeProductIds(" ")).toEqual([])
  })

  it("limpia, deduplica, filtra inactivas y ordena mesas públicas", () => {
    const tables = normalizePublicLocalTables([
      { id: "", name: " Mesa B ", area: " Terraza ", sortOrder: 2, isActive: true },
      { name: "Mesa A", sortOrder: 1 },
      { name: "Mesa B", sortOrder: 3 },
      { name: "Mesa C", isActive: false },
      " Barra ",
      "",
    ])

    expect(tables).toEqual([
      {
        id: "mesa-a",
        name: "Mesa A",
        area: "Principal",
        sortOrder: 1,
        isActive: true,
      },
      {
        id: "mesa-b",
        name: "Mesa B",
        area: "Terraza",
        sortOrder: 2,
        isActive: true,
      },
      {
        id: "barra",
        name: "Barra",
        area: "Principal",
        sortOrder: 5,
        isActive: true,
      },
    ])
  })


  it("expone textos públicos editables limpios", () => {
    const response = buildPublicBusinessConfigResponse({
      businessName: "Santo Test",
      publicMenuEyebrow: " Menú especial ",
      publicMenuTitle: " Pide aquí ",
      publicMenuText: " Texto del menú ",
      publicMenuSearchPlaceholder: " Buscar por nombre ",
      publicComboTitle: " Promos ",
      publicComboText: " Combos claros ",
      publicComboButtonText: " Ver promos ",
      publicCustomizeButtonText: " Elige tus ingredientes ",
      publicCustomizerTitle: " Personaliza tu producto ",
    })

    expect(response.publicMenuEyebrow).toBe("Menú especial")
    expect(response.publicMenuTitle).toBe("Pide aquí")
    expect(response.publicMenuText).toBe("Texto del menú")
    expect(response.publicMenuSearchPlaceholder).toBe("Buscar por nombre")
    expect(response.publicComboTitle).toBe("Promos")
    expect(response.publicComboText).toBe("Combos claros")
    expect(response.publicComboButtonText).toBe("Ver promos")
    expect(response.publicCustomizeButtonText).toBe("Elige tus ingredientes")
    expect(response.publicCustomizerTitle).toBe("Personaliza tu producto")
  })


  it("mantiene conectados los campos editables de configuración con la respuesta pública", () => {
    const response = buildPublicBusinessConfigResponse({
      businessName: " Santo Público ",
      businessShortDescription: " Menú actualizado ",
      themePrimaryColor: "#111111",
      themeAccentColor: "#eeee00",
      themeCreamColor: "#fafafa",
      productCardBackgroundColor: "#101010",
      productCardTextColor: "#ffffff",
      productCardBorderColor: "#ffcc00",
      productCardButtonColor: "#ffdd33",
      publicTagline: " Frase principal ",
      publicInfoTitle: " Información final ",
      publicInfoText: " Texto final público ",
      scheduleTitle: " Horario real ",
      scheduleLine1: " Lunes a viernes ",
      scheduleLine2: " Fin de semana ",
      locationButtonText: " Cómo llegar ",
      googleMapsUrl: "https://maps.example.com/local",
      instagramUrl: "https://instagram.example.com/local",
      publicCategoryOrder: ["Perritos", "Bebidas"],
      publicHiddenCategories: ["Raciones"],
      publicNavButtons: [
        { id: "inicio", label: "Inicio", kind: "section", target: "#inicio", isVisible: true, sortOrder: 1 },
        { id: "whatsapp", label: "WhatsApp", kind: "whatsapp", target: "", isVisible: true, sortOrder: 2 },
      ],
    })

    expect(response.businessName).toBe("Santo Público")
    expect(response.businessShortDescription).toBe("Menú actualizado")
    expect(response.themePrimaryColor).toBe("#111111")
    expect(response.themeAccentColor).toBe("#eeee00")
    expect(response.themeCreamColor).toBe("#fafafa")
    expect(response.productCardBackgroundColor).toBe("#101010")
    expect(response.productCardTextColor).toBe("#ffffff")
    expect(response.productCardBorderColor).toBe("#ffcc00")
    expect(response.productCardButtonColor).toBe("#ffdd33")
    expect(response.publicTagline).toBe("Frase principal")
    expect(response.publicInfoTitle).toBe("Información final")
    expect(response.publicInfoText).toBe("Texto final público")
    expect(response.scheduleTitle).toBe("Horario real")
    expect(response.scheduleLine1).toBe("Lunes a viernes")
    expect(response.scheduleLine2).toBe("Fin de semana")
    expect(response.locationButtonText).toBe("Cómo llegar")
    expect(response.googleMapsUrl).toBe("https://maps.example.com/local")
    expect(response.instagramUrl).toBe("https://instagram.example.com/local")
    expect(response.publicCategoryOrder).toEqual(["Perritos", "Bebidas"])
    expect(response.publicHiddenCategories).toEqual(["Raciones"])
    expect(response.publicNavButtons[0]).toMatchObject({
      id: "inicio",
      label: "Inicio",
      kind: "section",
      target: "#inicio",
      isVisible: true,
    })
  })


})
