import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getRequestAccess } from "@/lib/localAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BranchSummaryCountKey =
  | "orders"
  | "openAccounts"
  | "dayCloses"
  | "expenses"
  | "menuProducts"
  | "inventoryItems"
  | "inventoryMovements"
  | "inventoryRecipes"
  | "suppliers"
  | "supplierPurchases"
  | "paymentProofs";

type CountTarget = {
  key: BranchSummaryCountKey;
  table: string;
  label: string;
};

const COUNT_TARGETS: CountTarget[] = [
  { key: "orders", table: "orders", label: "Pedidos" },
  { key: "openAccounts", table: "open_accounts", label: "Cuentas abiertas" },
  { key: "dayCloses", table: "day_closes", label: "Cierres" },
  { key: "expenses", table: "day_expenses", label: "Gastos" },
  { key: "menuProducts", table: "menu_products", label: "Productos" },
  { key: "inventoryItems", table: "inventory_items", label: "Inventario" },
  { key: "inventoryMovements", table: "inventory_movements", label: "Movimientos" },
  { key: "inventoryRecipes", table: "inventory_recipes", label: "Recetas" },
  { key: "suppliers", table: "suppliers", label: "Proveedores" },
  { key: "supplierPurchases", table: "supplier_purchases", label: "Compras" },
  { key: "paymentProofs", table: "payment_proofs", label: "Comprobantes" },
];

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  );
}

async function countTableRows(branchId: string, table: string) {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("branch_id", branchId);

  if (error) return null;
  return count ?? 0;
}

export async function GET(request: NextRequest) {
  const access = getRequestAccess(request, getRequestPassword(request));

  if (!access.ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (access.role !== "owner" && access.role !== "support") {
    return NextResponse.json(
      { error: "Solo el dueño puede ver el resumen consolidado por sede" },
      { status: 403 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: branches, error } = await supabase
      .from("branches")
      .select("id, name, is_active, sort_order")
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const summaries = await Promise.all(
      (branches ?? []).map(async (branch) => {
        const counts = Object.fromEntries(
          await Promise.all(
            COUNT_TARGETS.map(async (target) =>
              [
                target.key,
                await countTableRows(String(branch.id), target.table),
              ] as const
            ),
          ),
        ) as Record<BranchSummaryCountKey, number | null>;

        const missingChecks = COUNT_TARGETS.filter(
          (target) => counts[target.key] === null,
        ).map((target) => target.label);

        return {
          branchId: String(branch.id),
          branchName: String(branch.name || branch.id),
          isActive: branch.is_active !== false,
          sortOrder: Number(branch.sort_order ?? 0) || 0,
          counts,
          missingChecks,
        };
      }),
    );

    return NextResponse.json({
      ok: true,
      summaries,
      labels: Object.fromEntries(
        COUNT_TARGETS.map((target) => [target.key, target.label]),
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el resumen operativo por sede",
      },
      { status: 500 },
    );
  }
}
