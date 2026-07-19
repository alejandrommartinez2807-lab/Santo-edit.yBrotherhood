import { NextRequest, NextResponse } from "next/server"
import { storeBackup } from "@/lib/condoBackup"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Cron diario de respaldo (Vercel Cron -> vercel.json). Si CRON_SECRET está
// configurado, exige Authorization: Bearer <secreto>. Si no, permite la
// ejecución del cron de Vercel (el respaldo es de solo lectura).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization") || ""
    const isVercelCron = request.headers.get("x-vercel-cron") === "1"
    if (auth !== `Bearer ${secret}` && !isVercelCron) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
  }
  try {
    const result = await storeBackup()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falló el respaldo" },
      { status: 500 },
    )
  }
}
