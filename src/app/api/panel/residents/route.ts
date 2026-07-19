import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseServer"
import { resolveBranchId } from "@/lib/branch"
import { checkPanelAccess } from "../_auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(v: unknown) {
  return String(v ?? "").trim()
}

// GET: residentes + sus vínculos a unidades (rol, unidad).
export async function GET(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ ok: true, residents: [], links: [] })
    const supabase = getSupabaseAdmin()
    const [resRes, linkRes] = await Promise.all([
      supabase.from("residents").select("*").eq("branch_id", branchId).order("full_name", { ascending: true }),
      supabase
        .from("unit_residents")
        .select("id, unit_id, resident_id, role, is_primary, receives_billing, units(code, tower)")
        .eq("branch_id", branchId),
    ])
    if (resRes.error) throw new Error(resRes.error.message)
    if (linkRes.error) throw new Error(linkRes.error.message)
    return NextResponse.json({ ok: true, residents: resRes.data ?? [], links: linkRes.data ?? [] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los residentes" },
      { status: 500 },
    )
  }
}

// POST: alta/edición de residente, o vínculo a unidad con kind="link".
export async function POST(request: NextRequest) {
  const access = checkPanelAccess(request)
  if (!access.ok) return access.response
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const branchId = await resolveBranchId(request)
    if (!branchId) return NextResponse.json({ error: "No hay condominio configurado" }, { status: 400 })
    const supabase = getSupabaseAdmin()

    if (text(body.kind) === "link") {
      const unitId = text(body.unitId)
      const residentId = text(body.residentId)
      if (!unitId || !residentId) {
        return NextResponse.json({ error: "Falta unidad o residente" }, { status: 400 })
      }
      const row = {
        branch_id: branchId,
        unit_id: unitId,
        resident_id: residentId,
        role: text(body.role) || "propietario",
        is_primary: body.isPrimary === true,
        receives_billing: body.receivesBilling !== false,
      }
      const { data, error } = await supabase.from("unit_residents").insert(row).select("id, unit_id, resident_id, role, is_primary, receives_billing, units(code, tower)").maybeSingle()
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, link: data }, { status: 201 })
    }

    const fullName = text(body.fullName)
    if (!fullName) return NextResponse.json({ error: "Escribe el nombre del residente" }, { status: 400 })
    const row = {
      branch_id: branchId,
      full_name: fullName,
      document_type: text(body.documentType) || "cedula",
      document_number: text(body.documentNumber),
      phone: text(body.phone),
      email: text(body.email),
      is_active: body.isActive !== false,
      notes: text(body.notes),
    }
    if (body.id) {
      const { data, error } = await supabase.from("residents").update(row).eq("id", body.id).eq("branch_id", branchId).select().maybeSingle()
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, resident: data })
    }
    const { data, error } = await supabase.from("residents").insert(row).select().maybeSingle()
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, resident: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el residente" },
      { status: 500 },
    )
  }
}
