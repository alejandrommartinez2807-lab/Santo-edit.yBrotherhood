import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// DELETE /api/panel/residents/[id]         -> borra el residente
// DELETE /api/panel/residents/[id]?link=ID -> borra solo un vínculo unidad<->residente
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const { id } = await ctx.params
    const branchId = await resolveBranchId(request)
    const supabase = getSupabaseAdmin()
    const linkId = request.nextUrl.searchParams.get("link")
    if (linkId) {
      const { error } = await supabase.from("unit_residents").delete().eq("id", linkId).eq("branch_id", branchId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    const { error } = await supabase.from("residents").delete().eq("id", id).eq("branch_id", branchId)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar" },
      { status: 500 },
    )
  }
}
