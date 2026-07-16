// ============================================================
// Hotel · V8-E · Proveedores externos con interfaz lista — lógica PURA.
//
// Las conexiones que dependen de un trámite con terceros (fiscal SENIAT,
// channel manager de OTAs, pasarela C2P del banco, envío de correos) quedan
// con provider "manual": el sistema YA funciona sin ellas y cada pantalla
// explica exactamente qué credencial falta y cómo conseguirla (la guía completa
// vive en docs/CONEXIONES-PROVEEDORES.md). Cuando el dueño trae la credencial,
// se enchufa el proveedor real sin rehacer nada.
//
// Aquí NO se guardan secretos: el estado (manual/en trámite/credenciales
// listas) y las notas viven en business_config; las credenciales reales se
// guardarán en tabla dedicada solo service-role cuando exista cada proveedor
// (mismo criterio que odoo_integration).
// ============================================================

export type ProviderIntegrationId = "fiscal" | "channel" | "gateway" | "email"

export type ProviderIntegrationDef = {
  id: ProviderIntegrationId
  title: string
  /** Qué resuelve la conexión, en una línea. */
  blurb: string
  /** Qué YA funciona hoy sin el proveedor (modo manual). */
  manualToday: string
  /** Credenciales que hay que traer para encender el proveedor real. */
  missingCredentials: string[]
  /** El trámite, resumido de docs/CONEXIONES-PROVEEDORES.md. */
  steps: string[]
  /** Sección de la guía docs/CONEXIONES-PROVEEDORES.md. */
  guideSection: string
}

export const PROVIDER_INTEGRATION_DEFS: ProviderIntegrationDef[] = [
  {
    id: "fiscal",
    title: "Facturación electrónica (SENIAT)",
    blurb:
      "La factura fiscal válida la emite una imprenta digital autorizada (The Factory HKA u otra). Con sus credenciales, además del libro de ventas emitiremos la factura fiscal.",
    manualToday:
      "Hoy: facturas internas con correlativo + libro de ventas estilo SENIAT en CSV (pestaña Exportes contables) para el contador.",
    missingCredentials: [
      "Usuario y token/clave del web service del proveedor",
      "RIF emisor habilitado",
      "URL del ambiente (demo y producción)",
    ],
    steps: [
      "Contrata el plan de facturación digital (The Factory HKA: thefactoryhka.com.ve) con el RIF del negocio.",
      "Pide acceso al portal y las credenciales del API/web service (usuario, token, RIF emisor).",
      "Pide primero el ambiente de PRUEBAS (homologación) y luego el de producción — son credenciales distintas.",
      "Verifica en su portal que los correlativos de factura estén autorizados por el SENIAT.",
    ],
    guideSection: "Sección 2 · Facturación electrónica / máquina fiscal (SENIAT)",
  },
  {
    id: "channel",
    title: "Channel manager real (push a OTAs)",
    blurb:
      "Sincronizar tarifas y cupo con Airbnb/Booking/Expedia en tiempo real requiere un channel manager de pago (SiteMinder, Cloudbeds…).",
    manualToday:
      "Hoy: sincronización iCal gratis y ya operativa (importar bloqueos de Airbnb/Booking por habitación + exportar nuestra URL iCal), en el módulo Canales.",
    missingCredentials: [
      "API key del channel manager contratado",
      "Mapeo de habitaciones (nuestro tipo ↔ su room type)",
    ],
    steps: [
      "Si el hotel vende fuerte por OTAs, contrata un channel manager (SiteMinder, Cloudbeds, Hotelmize).",
      "Pide la API key y el mapeo de habitaciones de la cuenta del hotel.",
      "Mientras tanto, usa la vía iCal: gratis, sin trámite, ya funciona (bloqueos cada pocas horas).",
    ],
    guideSection: "Sección 3 · Channel Manager / OTAs",
  },
  {
    id: "gateway",
    title: "Pasarela de pago C2P (banco)",
    blurb:
      "Con el comercio afiliado a un banco (Banesco/Mercantil/BNC) o un agregador, el pago del huésped se confirma solo, sin conciliar a mano.",
    manualToday:
      "Hoy: el huésped reporta su abono desde el teléfono (referencia + captura) y el staff lo confirma en Pagos y depósitos — circuito completo operativo.",
    missingCredentials: [
      "Código de afiliación de comercio",
      "Clave/API key del servicio C2P o botón de pago",
      "Credenciales del ambiente de pruebas (si el banco lo da)",
    ],
    steps: [
      "Ve al banco o agregador (Banesco, Mercantil, BNC; o Cashea/PagoFlash/Instapago) como persona jurídica (RIF + documentos).",
      "Solicita el servicio de comercio C2P / botón de pago con tu ejecutivo.",
      "Trae el código de afiliación y la clave; con eso se enciende la confirmación automática.",
    ],
    guideSection: "Sección 4 · Pasarela de pago (cobro online real)",
  },
  {
    id: "email",
    title: "Envío de correos (campañas)",
    blurb:
      "Para enviar campañas por correo de verdad (no solo copiar la lista a WhatsApp) hace falta un proveedor de envío como Resend o SendGrid.",
    manualToday:
      "Hoy: segmentación de huéspedes + plantillas con variables + copiar teléfonos para WhatsApp, en CRM → Campañas.",
    missingCredentials: [
      "API key de Resend o SendGrid",
      "Dominio del hotel verificado (registros SPF/DKIM en el DNS)",
    ],
    steps: [
      "Crea la cuenta en resend.com (plan gratis ~3.000 correos/mes para empezar).",
      "Verifica el dominio del hotel: agrega los registros SPF/DKIM que te da Resend en el DNS del dominio.",
      "Crea una API key en su panel y tráela.",
    ],
    guideSection: "Sección 5 · Envío de marketing (email / SMS)",
  },
]

export function getProviderIntegrationDef(id: string): ProviderIntegrationDef | null {
  return PROVIDER_INTEGRATION_DEFS.find((d) => d.id === id) ?? null
}

// ---------- Estado por proveedor (vive en business_config, SIN secretos) ----------

export const PROVIDER_STATUSES = ["manual", "tramite", "credenciales"] as const
export type ProviderIntegrationStatus = (typeof PROVIDER_STATUSES)[number]

export const PROVIDER_STATUS_LABELS: Record<ProviderIntegrationStatus, string> = {
  manual: "Modo manual (funciona hoy)",
  tramite: "Trámite en curso con el proveedor",
  credenciales: "Credenciales listas — pedir la conexión",
}

export type ProviderIntegrationState = {
  status: ProviderIntegrationStatus
  notes: string
}

export type ProviderIntegrationsConfig = Record<ProviderIntegrationId, ProviderIntegrationState>

export const DEFAULT_PROVIDER_INTEGRATIONS: ProviderIntegrationsConfig = {
  fiscal: { status: "manual", notes: "" },
  channel: { status: "manual", notes: "" },
  gateway: { status: "manual", notes: "" },
  email: { status: "manual", notes: "" },
}

function normalizeState(raw: unknown): ProviderIntegrationState {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const status = PROVIDER_STATUSES.includes(obj.status as ProviderIntegrationStatus)
    ? (obj.status as ProviderIntegrationStatus)
    : "manual"
  return { status, notes: String(obj.notes || "").trim().slice(0, 600) }
}

/** Normaliza el blob guardado: siempre los 4 proveedores, estados válidos. */
export function normalizeProviderIntegrations(raw: unknown): ProviderIntegrationsConfig {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const out = {} as ProviderIntegrationsConfig
  for (const def of PROVIDER_INTEGRATION_DEFS) {
    out[def.id] = normalizeState(source[def.id])
  }
  return out
}
