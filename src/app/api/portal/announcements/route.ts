import { NextRequest, NextResponse } from "next/server"
import { getPortalResident } from "../_resident"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET (Bearer): comunicados publicados del condominio.
export async function GET(request: NextRequest) {
  const ctx = await getPortalResident(request)
  if (!ctx) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
  const { data } = await ctx.supabase
    .from("announcements")
    .select("id, title, body, category, is_pinned, published_at")
    .eq("branch_id", ctx.branchId)
    .eq("status", "publicado")
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(50)
  return NextResponse.json({ ok: true, announcements: data ?? [] })
}
