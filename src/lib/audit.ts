import { getSupabaseAdmin } from "@/lib/supabaseServer";

type HeaderBag = { headers: { get(name: string): string | null } };

export type AuditAction =
  | "order.payment.updated"
  | "order.status.updated"
  | "order.notes.updated"
  | "order.delivery.reported"
  | "order.staff.confirmed"
  | "order.staff.reset"
  | "order.deleted"
  | "open_account.order.attached"
  | "open_account.order.status.updated"
  | "open_account.payment.updated"
  | "open_account.closed"
  | "payment_proof.created"
  | "payment_proof.reviewed"
  | "day_close.saved";

export type AuditActor = {
  role?: string | null;
  label?: string | null;
  source?: string | null;
};

export type AuditLogInput = {
  action: AuditAction;
  branchId?: string | null;
  entityType: string;
  entityId?: string | null;
  actor?: AuditActor;
  request?: HeaderBag;
  metadata?: Record<string, unknown>;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function getClientIp(request?: HeaderBag) {
  if (!request) return "";
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    ""
  );
}

export async function writeAuditLog(input: AuditLogInput) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("audit_logs").insert({
      branch_id: input.branchId ?? null,
      action: input.action,
      entity_type: cleanText(input.entityType),
      entity_id: cleanText(input.entityId) || null,
      actor_role: cleanText(input.actor?.role) || null,
      actor_label: cleanText(input.actor?.label) || null,
      actor_source: cleanText(input.actor?.source) || null,
      ip_address: getClientIp(input.request) || null,
      user_agent: input.request?.headers.get("user-agent") || null,
      metadata: input.metadata ?? {},
      created_at: new Date().toISOString(),
    });

    if (error && process.env.NODE_ENV !== "production") {
      console.warn("[audit] No se pudo guardar audit_logs:", error.message);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[audit] Audit log omitido:", error);
    }
  }
}
