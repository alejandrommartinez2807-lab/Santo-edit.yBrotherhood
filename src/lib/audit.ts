import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/auditActions";

export { AUDIT_ACTION_LABELS, type AuditAction };

type HeaderBag = { headers: { get(name: string): string | null } };

export type AuditActor = {
  role?: string | null;
  label?: string | null;
  source?: string | null;
  // id del usuario de personal (staff_users). Se guarda en metadata para no
  // exigir migración; la tabla audit_logs no tiene columna actor_id.
  id?: string | null;
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

export type AuditLogEntry = {
  id: string;
  branchId: string | null;
  action: string;
  actionLabel: string;
  entityType: string;
  entityId: string | null;
  actorRole: string | null;
  actorLabel: string | null;
  actorSource: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AuditLogQuery = {
  branchId?: string | null;
  action?: string | null;
  entityType?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  limit?: number;
};

function mapAuditRow(raw: Record<string, unknown>): AuditLogEntry {
  const action = cleanText(raw.action);
  return {
    id: String(raw.id || ""),
    branchId: raw.branch_id ? String(raw.branch_id) : null,
    action,
    actionLabel: AUDIT_ACTION_LABELS[action as AuditAction] || action,
    entityType: cleanText(raw.entity_type),
    entityId: raw.entity_id ? String(raw.entity_id) : null,
    actorRole: raw.actor_role ? String(raw.actor_role) : null,
    actorLabel: raw.actor_label ? String(raw.actor_label) : null,
    actorSource: raw.actor_source ? String(raw.actor_source) : null,
    ipAddress: raw.ip_address ? String(raw.ip_address) : null,
    metadata:
      raw.metadata && typeof raw.metadata === "object"
        ? (raw.metadata as Record<string, unknown>)
        : {},
    createdAt: String(raw.created_at || ""),
  };
}

// Lectura de la bitácora (solo el dueño, vía API). Filtros opcionales por
// sucursal, acción, tipo de entidad y rango de fechas. Tope de filas acotado.
export async function getAuditLogs(query: AuditLogQuery = {}): Promise<AuditLogEntry[]> {
  const supabase = getSupabaseAdmin();
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500);

  let request = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  const branchId = cleanText(query.branchId);
  if (branchId) request = request.eq("branch_id", branchId);

  const action = cleanText(query.action);
  if (action) request = request.eq("action", action);

  const entityType = cleanText(query.entityType);
  if (entityType) request = request.eq("entity_type", entityType);

  const fromDate = cleanText(query.fromDate);
  if (fromDate) request = request.gte("created_at", fromDate);

  const toDate = cleanText(query.toDate);
  if (toDate) request = request.lte("created_at", `${toDate}T23:59:59.999Z`);

  const { data, error } = await request;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapAuditRow(row as Record<string, unknown>));
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
      metadata: {
        ...(input.metadata ?? {}),
        ...(cleanText(input.actor?.id) ? { actorStaffId: cleanText(input.actor?.id) } : {}),
      },
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
