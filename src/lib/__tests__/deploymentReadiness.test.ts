import { describe, expect, it } from "vitest"
import { getDeploymentReadiness } from "../deploymentReadiness"

const COMPLETE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  ORDERS_OWNER_PASSWORD: "owner-password-123",
  ORDERS_MANAGER_PASSWORD: "manager-password-123",
  ORDERS_CASHIER_PASSWORD: "cashier-password-123",
  ORDERS_KITCHEN_PASSWORD: "kitchen-password-123",
  ORDERS_DELIVERY_PASSWORD: "delivery-password-123",
  ORDERS_SUPPORT_PASSWORD: "support-password-123",
  RATE_LIMIT_MAX_KEYS: "10000",
  SECURITY_EVENT_LOGGING: "true",
  ORDERS_POST_MAX_BYTES: "9000000",
  PAYMENT_PROOF_POST_MAX_BYTES: "8000000",
  MENU_IMAGE_UPLOAD_MAX_BYTES: "5500000",
  ORDER_ATTACHMENT_IMAGE_MAX_BYTES: "6000000",
  PAYMENT_PROOF_IMAGE_MAX_BYTES: "5500000",
  MENU_IMAGE_UPLOAD_BYTES: "4800000",
  PRIVATE_API_MUTATION_MAX_BYTES: "2000000",
  MENU_PRODUCTS_MUTATION_MAX_BYTES: "3000000",
  INVENTORY_MUTATION_MAX_BYTES: "2000000",
  ORDER_DETAIL_MUTATION_MAX_BYTES: "64000",
  ORDER_PAYMENT_MUTATION_MAX_BYTES: "64000",
  DAY_CLOSE_POST_MAX_BYTES: "2000000",
  NEXT_PUBLIC_SITE_URL: "https://santo.example.com",
  STRIPE_CURRENCY: "usd",
  SENTRY_TRACES_SAMPLE_RATE: "0",
}

describe("deploymentReadiness", () => {
  it("marca error cuando faltan variables críticas de Supabase y dueño", () => {
    const result = getDeploymentReadiness({})

    expect(result.ok).toBe(false)
    expect(result.summary.errors).toBeGreaterThanOrEqual(4)
    expect(result.checks.find((check) => check.key === "supabase-url")?.status).toBe("error")
    expect(result.checks.find((check) => check.key === "owner-access")?.status).toBe("error")
  })

  it("no revela valores de secretos en recomendaciones o detalles", () => {
    const result = getDeploymentReadiness({
      ...COMPLETE_ENV,
      ORDERS_OWNER_PASSWORD: "same-secret-password",
      ORDERS_MANAGER_PASSWORD: "same-secret-password",
    })
    const text = JSON.stringify(result)

    expect(text).not.toContain("same-secret-password")
    expect(text).toContain("ORDERS_OWNER_PASSWORD")
    expect(text).toContain("ORDERS_MANAGER_PASSWORD")
  })

  it("detecta claves débiles y duplicadas sin bloquear el despliegue", () => {
    const result = getDeploymentReadiness({
      ...COMPLETE_ENV,
      ORDERS_OWNER_PASSWORD: "123456",
      ORDERS_MANAGER_PASSWORD: "shared-password",
      ORDERS_CASHIER_PASSWORD: "shared-password",
    })

    expect(result.ok).toBe(true)
    expect(result.checks.find((check) => check.key === "staff-password-strength")?.status).toBe("warning")
    expect(result.checks.find((check) => check.key === "staff-password-duplicates")?.status).toBe("warning")
  })

  it("detecta Stripe parcialmente configurado como error", () => {
    const result = getDeploymentReadiness({
      ...COMPLETE_ENV,
      STRIPE_SECRET_KEY: "sk_test_123",
      STRIPE_WEBHOOK_SECRET: "",
    })

    expect(result.ok).toBe(false)
    expect(result.checks.find((check) => check.key === "stripe-completeness")?.status).toBe("error")
  })

  it("detecta orígenes y límites con formato inválido", () => {
    const result = getDeploymentReadiness({
      ...COMPLETE_ENV,
      ALLOWED_API_ORIGINS: "https://ok.example.com,http://bad.example.com",
      RATE_LIMIT_MAX_KEYS: "abc",
      MENU_IMAGE_UPLOAD_BYTES: "-1",
    })

    expect(result.checks.find((check) => check.key === "allowed-api-origins")?.status).toBe("warning")
    expect(result.checks.find((check) => check.key === "rate-limit-store-size")?.status).toBe("warning")
    expect(result.checks.find((check) => check.key === "upload-limits")?.status).toBe("warning")
  })

  it("resume grupos y checks para soporte", () => {
    const result = getDeploymentReadiness(COMPLETE_ENV)

    expect(result.groups.length).toBeGreaterThan(0)
    expect(result.groups.some((group) => group.key === "supabase")).toBe(true)
    expect(result.summary.total).toBe(result.checks.length)
  })
})
