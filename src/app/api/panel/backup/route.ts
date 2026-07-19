import { NextRequest, NextResponse } from "next/server"
import { buildBackup, storeBackup } from "@/lib/condoBackup"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET  ?download=1  -> descarga el respaldo como archivo JSON
// GET  (sin flag)   -> genera y GUARDA un respaldo en Storage (respaldo manual)
export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    if (request.nextUrl.searchParams.get("download") === "1") {
      const backup = await buildBackup()
      const stamp = backup.generatedAt.slice(0, 19).replace(/[:T]/g, "-")
      return new NextResponse(JSON.stringify(backup, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="concepto-respaldo-${stamp}.json"`,
        },
      })
    }
    const result = await storeBackup()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falló el respaldo" },
      { status: 500 },
    )
  }
}
