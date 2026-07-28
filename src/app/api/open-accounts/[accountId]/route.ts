import { NextRequest, NextResponse } from "next/server";
import {
  attachOrderToOpenAccount,
  closeOpenAccount,
  getBusinessConfig,
  getOpenAccountStatus,
  getOpenAccounts,
  getOrders,
  OrderPaymentConflictError,
  setOpenAccountBillRequested,
  updateOrderPayment,
  updateOrderStatus,
  type OrderStatus,
} from "@/lib/orders";
import {
  canLocalAccessUseModule,
  getLocalAccessAuditActor,
  getRequestAccess,
  type LocalRole,
} from "@/lib/localAccess";
import { getModulePlanAccess } from "@/lib/localPlans";
import { canRoleUpdateStatus } from "@/lib/orderStatusPermissions";
import { resolveBranchId } from "@/lib/branch";
import { writeAuditLog } from "@/lib/audit";
import { OrderActionConflictError } from "@/lib/orderConflicts";

import { enforceApiMutationGuards } from "@/lib/apiMutationGuards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OpenAccountRouteContext = {
  params: Promise<{
    accountId: string;
  }>;
};

function getRequestPassword(request: NextRequest) {
  return (
    request.headers.get("x-local-password") ||
    request.headers.get("x-admin-password") ||
    ""
  );
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}

function forbiddenResponse(
  message = "Esta clave no tiene permiso para manejar cuentas abiertas",
) {
  return NextResponse.json({ error: message }, { status: 403 });
}

function checkRole(request: NextRequest, allowedRoles: LocalRole[]) {
  const access = getRequestAccess(request, getRequestPassword(request));

  if (!access.ok) {
    return {
      ok: false as const,
      response: unauthorizedResponse(),
      role: null,
      roleLabel: "",
    };
  }

  if (!allowedRoles.includes(access.role)) {
    return {
      ok: false as const,
      response: forbiddenResponse(),
      role: access.role,
      roleLabel: access.roleLabel,
    };
  }

  // Guard H18 (2026-07-24): respetar los permisos POR USUARIO (permissionsMode
  // "custom"). Era la única superficie mutable del POS sin este chequeo: un
  // cajero con el módulo de cuentas quitado seguía cobrando/cerrando por API.
  if (!canLocalAccessUseModule(access, "openAccounts")) {
    return {
      ok: false as const,
      response: forbiddenResponse(
        "Tu usuario no tiene habilitado el módulo de cuentas abiertas",
      ),
      role: access.role,
      roleLabel: access.roleLabel,
    };
  }

  return {
    ok: true as const,
    response: null,
    role: access.role,
    roleLabel: access.roleLabel,
    access,
  };
}

function getModuleUnavailableMessage(reason: "plan" | "owner") {
  if (reason === "plan") {
    return "Cuentas abiertas no está incluido en el plan activo. Solicita activación o sube el plan para usar esta función.";
  }

  return "Cuentas abiertas está desactivado desde Configuración del negocio.";
}

async function checkOpenAccountsModule() {
  const businessConfig = await getBusinessConfig();
  const moduleAccess = getModulePlanAccess(
    businessConfig as unknown as Record<string, unknown>,
    "openAccounts",
  );

  if (!moduleAccess.includedInPlan) {
    return {
      ok: false as const,
      response: forbiddenResponse(getModuleUnavailableMessage("plan")),
    };
  }

  if (!moduleAccess.effectiveEnabled) {
    return {
      ok: false as const,
      response: forbiddenResponse(getModuleUnavailableMessage("owner")),
    };
  }

  return { ok: true as const, response: null };
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function roundMoney(value: unknown) {
  const numberValue = Number(value || 0);

  if (!Number.isFinite(numberValue)) return 0;

  return Math.round((numberValue + Number.EPSILON) * 100) / 100;
}

function normalizeMoney(value: unknown) {
  const numberValue = Number(value || 0);

  if (!Number.isFinite(numberValue) || numberValue <= 0) return 0;

  return roundMoney(numberValue);
}

function getOrderTotalUSD(
  order: Awaited<ReturnType<typeof getOrders>>[number],
) {
  return roundMoney(order.totalUSD ?? order.totalPrice ?? 0);
}

function getOrderReceivedEquivalentUSD(
  order: Awaited<ReturnType<typeof getOrders>>[number],
) {
  const savedEquivalent = Number(
    order.paymentReceivedEquivalentUSD ??
      order.payment?.receivedEquivalentUSD ??
      0,
  );

  if (Number.isFinite(savedEquivalent) && savedEquivalent > 0)
    return roundMoney(savedEquivalent);

  const amountUSD = Number(
    order.amountReceivedUSD ?? order.payment?.amountReceivedUSD ?? 0,
  );
  const amountVES = Number(
    order.amountReceivedVES ?? order.payment?.amountReceivedVES ?? 0,
  );
  const exchangeRate = Number(order.exchangeRate || 0);

  return roundMoney(
    Math.max(amountUSD, 0) +
      (amountVES > 0 && exchangeRate > 0 ? amountVES / exchangeRate : 0),
  );
}

function getOrderPendingUSD(
  order: Awaited<ReturnType<typeof getOrders>>[number],
) {
  const savedPending = Number(
    order.paymentPendingUSD ?? order.payment?.pendingUSD ?? 0,
  );

  if (Number.isFinite(savedPending) && savedPending > 0)
    return roundMoney(savedPending);

  return roundMoney(
    Math.max(getOrderTotalUSD(order) - getOrderReceivedEquivalentUSD(order), 0),
  );
}

function normalizeOrderStatus(value: unknown): OrderStatus | null {
  if (
    value === "Nuevo" ||
    value === "Preparando" ||
    value === "Listo" ||
    value === "Entregado" ||
    value === "Cancelado"
  ) {
    return value;
  }

  return null;
}

function isAccountDeliveryStatus(status: OrderStatus) {
  return status === "Listo" || status === "Entregado";
}

function normalizeDeliveryPaymentIn(
  value: unknown,
): "Divisas" | "Bolívares" | "Mixto" | "Sin registrar" {
  const cleanValue = cleanText(value);

  if (
    cleanValue === "Divisas" ||
    cleanValue === "Bolívares" ||
    cleanValue === "Mixto"
  ) {
    return cleanValue;
  }

  return "Sin registrar";
}

export async function GET(
  request: NextRequest,
  context: OpenAccountRouteContext,
) {
  try {
    const access = checkRole(request, [
      "owner",
      "manager",
      "cashier",
      "waiter",
    ]);
    if (!access.ok) return access.response;

    const moduleCheck = await checkOpenAccountsModule();
    if (!moduleCheck.ok) return moduleCheck.response;

    const { accountId } = await context.params;
    const cleanAccountId = cleanText(accountId);
    const branchId = await resolveBranchId(request);
    const openAccounts = await getOpenAccounts(
      { status: "all", id: cleanAccountId },
      branchId,
    );
    const openAccount = openAccounts.find(
      (account) => account.id === cleanAccountId,
    );

    if (!openAccount) {
      return NextResponse.json(
        { error: "No se encontró la cuenta abierta" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, openAccount });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar la cuenta abierta",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: OpenAccountRouteContext,
) {
  const guardResponse = enforceApiMutationGuards(request, {
    id: "api-open-accounts-patch",
    limit: 90,
    windowMs: 60_000,
    envMaxBytes: "PRIVATE_API_MUTATION_MAX_BYTES",
    maxBytes: 1_000_000,
    rateLimitMessage:
      "Demasiados cambios de cuentas abiertas. Espera unos segundos e intenta nuevamente.",
  });

  if (guardResponse) return guardResponse;

  try {
    const access = checkRole(request, [
      "owner",
      "manager",
      "cashier",
      "waiter",
    ]);
    if (!access.ok) return access.response;

    const moduleCheck = await checkOpenAccountsModule();
    if (!moduleCheck.ok) return moduleCheck.response;

    const { accountId } = await context.params;
    const branchId = await resolveBranchId(request);
    const cleanAccountId = cleanText(accountId);
    const body = (await request.json()) as Record<string, unknown>;
    const action = cleanText(body.action);

    // Guard H4 (2026-07-24): completa el R4 — cerrar, marcar entregas o cobrar
    // también exigen que la cuenta siga Abierta (antes solo attachOrder lo
    // validaba y un "close" repetido pisaba closed_at/closed_by en silencio).
    if (action === "updateOrderStatus" || action === "payAccount" || action === "close") {
      const accountStatus = await getOpenAccountStatus(cleanAccountId, branchId);

      if (!accountStatus) {
        return NextResponse.json(
          { error: "No se encontró la cuenta abierta" },
          { status: 404 },
        );
      }

      if (accountStatus !== "Abierta") {
        return NextResponse.json(
          {
            error:
              action === "close"
                ? "Esta cuenta ya está cerrada."
                : "Esta cuenta ya está cerrada: cobra o ajusta cada pedido directamente desde caja.",
            conflict: true,
          },
          { status: 409 },
        );
      }
    }

    if (action === "attachOrder") {
      const orderId = cleanText(body.orderId);

      if (!orderId) {
        return NextResponse.json(
          { error: "Selecciona el pedido que quieres asociar" },
          { status: 400 },
        );
      }

      const result = await attachOrderToOpenAccount(
        cleanAccountId,
        orderId,
        branchId,
      );

      await writeAuditLog({
        action: "open_account.order.attached",
        branchId,
        entityType: "open_account",
        entityId: cleanAccountId,
        actor: getLocalAccessAuditActor(access.access),
        request,
        metadata: { orderId },
      });

      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "updateOrderStatus") {
      const orderId = cleanText(body.orderId);
      const status = normalizeOrderStatus(body.status);

      if (!orderId) {
        return NextResponse.json(
          { error: "Selecciona el pedido de la cuenta" },
          { status: 400 },
        );
      }

      if (!status || !isAccountDeliveryStatus(status)) {
        return NextResponse.json(
          {
            error:
              "Desde cuenta abierta solo puedes marcar pedidos como listos/no entregados o entregados",
          },
          { status: 400 },
        );
      }

      const accountOrders = (await getOrders(branchId)).filter(
        (order) => cleanText(order.openAccountId) === cleanAccountId,
      );
      const orderInAccount = accountOrders.find(
        (order) => order.id === orderId,
      );

      if (!orderInAccount) {
        return NextResponse.json(
          { error: "Ese pedido no pertenece a esta cuenta abierta" },
          { status: 404 },
        );
      }

      if (orderInAccount.status === "Cancelado") {
        return NextResponse.json(
          { error: "No se puede cambiar la entrega de un pedido cancelado" },
          { status: 400 },
        );
      }

      // Mismo permiso rol→estado que /api/orders (fuente única): antes esta
      // puerta autorizaba distinto (auditoría 2026-07-23, P1).
      if (!canRoleUpdateStatus(access.role, status)) {
        return NextResponse.json(
          { error: "Tu rol no puede poner ese estado en un pedido" },
          { status: 403 },
        );
      }

      const order = await updateOrderStatus(orderId, status, branchId, access.role);
      const refreshedAccounts = await getOpenAccounts(
        { status: "all", id: cleanAccountId },
        branchId,
      );
      const openAccount = refreshedAccounts.find(
        (account) => account.id === cleanAccountId,
      );

      await writeAuditLog({
        action: "open_account.order.status.updated",
        branchId,
        entityType: "open_account",
        entityId: cleanAccountId,
        actor: getLocalAccessAuditActor(access.access),
        request,
        metadata: { orderId, status },
      });

      return NextResponse.json({ ok: true, openAccount, order });
    }

    if (action === "payAccount") {
      if (access.role === "waiter") {
        return forbiddenResponse(
          "El mesonero puede abrir o asociar cuentas, pero caja debe registrar los cobros.",
        );
      }

      const amountReceivedUSD = normalizeMoney(body.amountReceivedUSD);
      const amountReceivedVES = normalizeMoney(body.amountReceivedVES);
      const paymentMethodUSD = cleanText(body.paymentMethodUSD);
      const paymentMethodVES = cleanText(body.paymentMethodVES);
      const deliveryPaymentIn = normalizeDeliveryPaymentIn(
        body.deliveryPaymentIn,
      );
      const paymentNote = cleanText(body.paymentNote);
      const closeIfPaid = body.closeIfPaid === true;

      if (amountReceivedUSD <= 0 && amountReceivedVES <= 0) {
        return NextResponse.json(
          { error: "Indica el monto recibido para cobrar la cuenta" },
          { status: 400 },
        );
      }

      const allOrders = await getOrders(branchId);
      const accountOrders = allOrders
        .filter((order) => cleanText(order.openAccountId) === cleanAccountId)
        .filter((order) => order.status !== "Cancelado")
        .sort((first, second) =>
          String(first.createdAt || "").localeCompare(
            String(second.createdAt || ""),
          ),
        );

      if (accountOrders.length === 0) {
        return NextResponse.json(
          { error: "Esta cuenta no tiene pedidos activos para cobrar" },
          { status: 400 },
        );
      }

      let remainingUSD = amountReceivedUSD;
      let remainingVES = amountReceivedVES;
      const updatedOrders = [];
      const actor = getLocalAccessAuditActor(access.access);
      // Dos cobros de la misma cuenta a la vez (riesgo R6): el reparto FIFO
      // leía los montos y REESCRIBÍA — el segundo cobro pisaba el dinero del
      // primero. Cada escritura va ahora con el candado optimista de
      // updateOrderPayment (expectedPrevious): si otro cobro tocó el pedido
      // entremedio, se relee SOLO ese pedido y se reintenta una vez.
      let conflictNotice = "";

      // Reparte lo disponible sobre UN pedido usando los montos del snapshot
      // `source` y lo escribe exigiendo que sigan vigentes. Devuelve null si
      // a este pedido no le toca dinero.
      const chargeOrder = async (
        source: (typeof accountOrders)[number],
        availableUSD: number,
        availableVES: number,
      ) => {
        let pendingUSD = getOrderPendingUSD(source);

        if (pendingUSD <= 0.01) return null;

        const currentAmountUSD = roundMoney(
          source.amountReceivedUSD ?? source.payment?.amountReceivedUSD ?? 0,
        );
        const currentAmountVES = roundMoney(
          source.amountReceivedVES ?? source.payment?.amountReceivedVES ?? 0,
        );
        const exchangeRate = Number(source.exchangeRate || 0);
        let addUSD = 0;
        let addVES = 0;

        if (availableUSD > 0 && pendingUSD > 0) {
          addUSD = roundMoney(Math.min(availableUSD, pendingUSD));
          pendingUSD = roundMoney(Math.max(pendingUSD - addUSD, 0));
        }

        if (availableVES > 0 && pendingUSD > 0 && exchangeRate > 0) {
          const availableVESEquivalentUSD = roundMoney(
            availableVES / exchangeRate,
          );
          const addVESEquivalentUSD = roundMoney(
            Math.min(availableVESEquivalentUSD, pendingUSD),
          );
          addVES = roundMoney(addVESEquivalentUSD * exchangeRate);
          pendingUSD = roundMoney(
            Math.max(pendingUSD - addVESEquivalentUSD, 0),
          );
        }

        if (addUSD <= 0 && addVES <= 0) return null;

        const updatedOrder = await updateOrderPayment(
          source.id,
          {
            amountReceivedUSD: roundMoney(currentAmountUSD + addUSD),
            amountReceivedVES: roundMoney(currentAmountVES + addVES),
            // El método solo se estampa en la moneda que este cobro realmente
            // tocó; si no, se conserva el que ya tenía el pedido (antes un
            // cobro 100% en Bs le escribía también el método USD = reporte de
            // pago falso en ese pedido).
            paymentMethodUSD:
              addUSD > 0
                ? paymentMethodUSD
                : cleanText(source.paymentMethodUSD),
            paymentMethodVES:
              addVES > 0
                ? paymentMethodVES
                : cleanText(source.paymentMethodVES),
            deliveryPaymentIn,
            paymentNote,
            chargedBy: { id: actor.id, name: actor.label, role: actor.role },
            expectedPrevious: {
              amountReceivedUSD: currentAmountUSD,
              amountReceivedVES: currentAmountVES,
            },
          },
          branchId,
        );

        return { updatedOrder, usedUSD: addUSD, usedVES: addVES };
      };

      for (const order of accountOrders) {
        if (remainingUSD <= 0.01 && remainingVES <= 0.01) break;

        let result;
        try {
          result = await chargeOrder(order, remainingUSD, remainingVES);
        } catch (chargeError) {
          if (!(chargeError instanceof OrderPaymentConflictError)) {
            throw chargeError;
          }
          // Chocó: montos frescos de ESTE pedido y un solo reintento.
          const freshOrders = await getOrders(branchId);
          const freshOrder = freshOrders.find((item) => item.id === order.id);
          if (!freshOrder || freshOrder.status === "Cancelado") continue;
          try {
            result = await chargeOrder(freshOrder, remainingUSD, remainingVES);
          } catch (retryError) {
            if (!(retryError instanceof OrderPaymentConflictError)) {
              throw retryError;
            }
            conflictNotice =
              "Otro cobro de esta cuenta entró al mismo tiempo: revisa el pendiente actualizado antes de volver a cobrar.";
            break;
          }
        }

        if (!result) continue;

        updatedOrders.push(result.updatedOrder);
        remainingUSD = roundMoney(Math.max(remainingUSD - result.usedUSD, 0));
        remainingVES = roundMoney(Math.max(remainingVES - result.usedVES, 0));
      }

      if (updatedOrders.length === 0) {
        if (conflictNotice) {
          return NextResponse.json(
            { error: conflictNotice, conflict: true },
            { status: 409 },
          );
        }
        return NextResponse.json(
          { error: "No había pendiente suficiente para aplicar este cobro" },
          { status: 400 },
        );
      }

      // Cobrar ES atender la petición de cuenta: el badge se apaga solo.
      await setOpenAccountBillRequested(cleanAccountId, false, branchId).catch(
        () => {},
      );

      const refreshedAccounts = await getOpenAccounts(
        { status: "all", id: cleanAccountId },
        branchId,
      );
      let openAccount = refreshedAccounts.find(
        (account) => account.id === cleanAccountId,
      );

      if (
        closeIfPaid &&
        openAccount &&
        Number(openAccount.pendingUSD || 0) <= 0.01
      ) {
        openAccount = await closeOpenAccount(
          cleanAccountId,
          {
            closedBy:
              cleanText(body.closedBy) ||
              getLocalAccessAuditActor(access.access).label ||
              "Caja",
          },
          branchId,
        );
      }

      await writeAuditLog({
        action: "open_account.payment.updated",
        branchId,
        entityType: "open_account",
        entityId: cleanAccountId,
        actor: getLocalAccessAuditActor(access.access),
        request,
        metadata: {
          amountReceivedUSD,
          amountReceivedVES,
          updatedOrderIds: updatedOrders.map((order) => order.id),
          remainingUSD,
          remainingVES,
          closeIfPaid,
        },
      });

      return NextResponse.json({
        ok: true,
        openAccount,
        updatedOrders,
        unusedAmountUSD: remainingUSD,
        unusedAmountVES: remainingVES,
        // Cobro aplicado a medias por una carrera: la UI se lo dice a caja.
        ...(conflictNotice ? { conflictNotice } : {}),
      });
    }

    // El mesonero también puede marcar la petición de cuenta como atendida
    // (fue a la mesa): apaga el badge sin tocar cobros ni estados.
    if (action === "clearBillRequest") {
      await setOpenAccountBillRequested(cleanAccountId, false, branchId);

      const refreshedAccounts = await getOpenAccounts(
        { status: "all", id: cleanAccountId },
        branchId,
      );

      return NextResponse.json({
        ok: true,
        openAccount: refreshedAccounts.find(
          (account) => account.id === cleanAccountId,
        ),
      });
    }

    if (action === "close") {
      if (access.role === "waiter") {
        return forbiddenResponse(
          "El mesonero puede abrir o asociar cuentas, pero caja debe cerrarlas.",
        );
      }

      // "Cancelada": la cuenta se cierra SIN cobrarse (el estado existía en
      // la BD pero ninguna pantalla podía ponerlo). Cualquier otro valor
      // degrada a "Cerrada", el cierre normal.
      const closeStatus =
        cleanText(body.closeStatus) === "Cancelada" ? "Cancelada" : "Cerrada";

      const openAccount = await closeOpenAccount(
        cleanAccountId,
        {
          status: closeStatus,
          closedBy:
            cleanText(body.closedBy) ||
            getLocalAccessAuditActor(access.access).label ||
            "Caja",
        },
        branchId,
      );

      await writeAuditLog({
        action: "open_account.closed",
        branchId,
        entityType: "open_account",
        entityId: cleanAccountId,
        actor: getLocalAccessAuditActor(access.access),
        request,
        metadata: { closeStatus },
      });

      return NextResponse.json({ ok: true, openAccount });
    }

    return NextResponse.json(
      { error: "Acción de cuenta abierta no válida" },
      { status: 400 },
    );
  } catch (error) {
    // 409: otro usuario ya hizo esta misma acción (anti doble-acción).
    if (error instanceof OrderActionConflictError) {
      return NextResponse.json(
        { error: error.message, conflict: true },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la cuenta abierta",
      },
      { status: 400 },
    );
  }
}
