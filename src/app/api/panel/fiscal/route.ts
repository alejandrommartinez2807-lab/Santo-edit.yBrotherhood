import { NextRequest, NextResponse } from "next/server"
import { checkPanelAccess } from "../_auth"
import { getBusinessConfig, saveBusinessConfig } from "@/lib/ordersBusinessConfig"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function bool(v: unknown) {
  return v === true || v === "true" || v === 1 || v === "1"
}
function clampRate(v: unknown, fallback: number) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(100, Math.max(0, n))
}

// GET: estado fiscal actual del centro comercial (para el panel del dueño).
export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const cfg = await getBusinessConfig()
    return NextResponse.json({
      ok: true,
      fiscal: {
        fiscalEnabled: cfg.fiscalEnabled === true,
        rifNumber: cfg.rifNumber || "",
        fiscalAddress: cfg.fiscalAddress || "",
        igtfEnabled: cfg.igtfEnabled !== false,
        igtfRate: Number.isFinite(Number(cfg.igtfRate)) ? Number(cfg.igtfRate) : 3,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar" }, { status: 500 })
  }
}

// POST: guarda el modo fiscal (recibos vs facturas), RIF/dirección e IGTF.
// Guardado parcial (merge): no toca el resto de la configuración del negocio.
export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const fiscalEnabled = bool(body.fiscalEnabled)

    // Para emitir facturas hace falta el RIF; si intentan activar sin RIF, se avisa.
    const rifNumber = String(body.rifNumber ?? "").trim().slice(0, 40)
    if (fiscalEnabled && !rifNumber) {
      return NextResponse.json({ error: "Para activar la facturación fiscal primero carga el RIF del centro comercial." }, { status: 400 })
    }

    const saved = await saveBusinessConfig({
      fiscalEnabled,
      rifNumber,
      fiscalAddress: String(body.fiscalAddress ?? "").trim().slice(0, 200),
      igtfEnabled: bool(body.igtfEnabled),
      igtfRate: clampRate(body.igtfRate, 3),
    })

    return NextResponse.json({
      ok: true,
      fiscal: {
        fiscalEnabled: saved.fiscalEnabled === true,
        rifNumber: saved.rifNumber || "",
        fiscalAddress: saved.fiscalAddress || "",
        igtfEnabled: saved.igtfEnabled !== false,
        igtfRate: Number.isFinite(Number(saved.igtfRate)) ? Number(saved.igtfRate) : 3,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar" }, { status: 500 })
  }
}
