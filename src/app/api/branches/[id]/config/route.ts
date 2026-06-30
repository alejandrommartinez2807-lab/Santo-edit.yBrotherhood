import { NextRequest, NextResponse } from "next/server";
import { enforceApiMutationGuards } from "@/lib/apiMutationGuards";
import {
  copyBranchConfigInRawBusinessConfig,
  getBranchConfig,
  normalizeBranchScopedConfig,
  mergeRawBusinessConfigWithBranchConfig,
} from "@/lib/branch";
import { getRequestAccess } from "@/lib/localAccess";
import { getRawBusinessConfig, saveBusinessConfig } from "@/lib/orders";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  );
}

function forbidden(message = "Solo el dueño puede configurar sedes") {
  return NextResponse.json({ error: message }, { status: 403 });
}

function unauthorized() {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}

function cleanBranchId(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

async function requireOwner(request: NextRequest) {
  const access = getRequestAccess(request, getRequestPassword(request));
  if (!access.ok) return { ok: false as const, response: unauthorized() };
  if (access.role !== "owner")
    return { ok: false as const, response: forbidden() };
  return { ok: true as const, response: null };
}

async function getBranch(branchId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("branches")
    .select("id, name, is_active, sort_order")
    .eq("id", branchId)
    .maybeSingle();

  if (error) throw new Error(error.message || "No se pudo cargar la sede");
  return data;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const branchId = cleanBranchId(id);
    const branch = await getBranch(branchId);

    if (!branch) {
      return NextResponse.json(
        { error: "Sucursal no encontrada" },
        { status: 404 },
      );
    }

    const rawBusinessConfig = await getRawBusinessConfig();
    const branchConfig = normalizeBranchScopedConfig(
      getBranchConfig(rawBusinessConfig, branchId),
    );

    return NextResponse.json({ ok: true, branch, branchConfig });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar la configuración de la sede",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-branch-config-patch",
    limit: 60,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage:
      "Demasiados cambios de configuración por sede. Espera unos segundos e intenta nuevamente.",
  });

  if (guardResponse) return guardResponse;

  const auth = await requireOwner(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const branchId = cleanBranchId(id);
    const branch = await getBranch(branchId);

    if (!branch) {
      return NextResponse.json(
        { error: "Sucursal no encontrada" },
        { status: 404 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const rawBusinessConfig = await getRawBusinessConfig();
    const copyFromBranchId = cleanBranchId(body.copyFromBranchId);
    const nextRawBusinessConfig = copyFromBranchId
      ? copyBranchConfigInRawBusinessConfig(
          rawBusinessConfig,
          copyFromBranchId,
          branchId,
        )
      : mergeRawBusinessConfigWithBranchConfig(
          rawBusinessConfig,
          branchId,
          body.branchConfig || body.config || {},
        );

    await saveBusinessConfig(nextRawBusinessConfig as never);

    return NextResponse.json({
      ok: true,
      branch,
      branchConfig: normalizeBranchScopedConfig(
        getBranchConfig(nextRawBusinessConfig, branchId),
      ),
      message: copyFromBranchId
        ? "Configuración copiada a la sede."
        : "Configuración de la sede guardada.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la configuración de la sede",
      },
      { status: 500 },
    );
  }
}
