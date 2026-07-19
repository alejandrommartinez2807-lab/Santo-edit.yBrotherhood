import { NextRequest, NextResponse } from "next/server"
import { getPortalResident } from "../_resident"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET (Bearer): documentos visibles para residentes.
export async function GET(request: NextRequest) {
  const ctx = await getPortalResident(request)
  if (!ctx) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
  const { data } = await ctx.supabase
    .from("documents")
    .select("id, title, category, description, file_url, file_name, created_at")
    .eq("branch_id", ctx.branchId)
    .eq("is_active", true)
    .eq("visibility", "residentes")
    .order("created_at", { ascending: false })
    .limit(60)
  return NextResponse.json({ ok: true, documents: data ?? [] })
}
