"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Store,
  Users,
} from "lucide-react";
import { formatUSD } from "@/utils/formatCurrency";
import { usePersistedToggle } from "@/hooks/usePersistedToggle";
import { getSelectedBranchId } from "@/lib/branchClient";
import {
  getBillRequestedAt,
  stripBillRequestMarker,
} from "@/lib/openAccountBillRequest";
import type {
  LocalOrder,
  OpenAccount,
  OpenAccountOrderSummary,
} from "@/types/localOrders";
import { getDisplayOrderNumber } from "@/lib/localOrderHelpers";
import {
  formatMoneyForInput,
  getOrderPayment,
  getOrderTotals,
  parseMoneyInput,
} from "@/lib/localOrderMoney";
import {
  DELIVERY_PAYMENT_OPTIONS,
  PAYMENT_METHOD_USD_OPTIONS,
  PAYMENT_METHOD_VES_OPTIONS,
} from "@/lib/paymentOptions";
import {
  EMPTY_ACCOUNT_PAYMENT_FORM,
  EMPTY_CREATE_FORM,
  formatAccountDate,
  formatAccountStatusLabel,
  getAccountDeliveryStats,
  getAccountDeliveryTone,
  getAccountOperationalTone,
  getAccountPendingOrdersCount,
  getAccountRepresentativeExchangeRate,
  getAccountStatusClasses,
  getComputedAccountTotals,
  getNormalizedTable,
  getOrderAccountId,
  getOrderDeliveryLabel,
  getOrderDeliveryTone,
  isEligibleOrderForOpenAccount,
  isSameTable,
  mergeAccountOrders,
  readApiResponse,
  type AccountPaymentForm,
  type AccountViewMode,
  type CreateAccountForm,
} from "./openAccountsDomain";
import {
  MiniStat,
  OrderItemsPreview,
  OrderPill,
  PaymentInput,
  PaymentSelect,
} from "./openAccountsComponents";
import { SepararCuentaModal } from "./SepararCuentaModal";

// Pedidos que el personal decidió NO sumar a la cuenta ("Dejarlo aparte").
// Solo esconde la sugerencia en ESTE equipo; el pedido sigue vivo y se cobra
// por su cuenta.
const DISMISSED_ATTACH_STORAGE_KEY = "caja_open_accounts_attach_dismissed";

type OpenAccountsPanelProps = {
  adminPassword: string;
  orders: LocalOrder[];
  canManage?: boolean;
  canCloseAccounts?: boolean;
  canRegisterPayments?: boolean;
  canSplitBill?: boolean;
  compact?: boolean;
  title?: string;
  description?: string;
  closeRoleLabel?: string;
  tableOptions?: string[];
  preferredTableName?: string;
  // Cuentas abiertas ya cargadas por la página (por ejemplo, el sondeo de caja).
  // Si se pasan, el panel las usa como fuente en la vista "Abiertas" y evita
  // duplicar el fetch de /api/open-accounts; el historial sigue cargándose aquí.
  externalOpenAccounts?: OpenAccount[];
  // Permite plegar el panel para que caja recupere espacio en pantalla.
  collapsible?: boolean;
  // Mesonero (2026-07-28): "Marcar entregado" se deshabilita hasta que
  // cocina/caja pongan el pedido LISTO (el servidor aplica la misma regla).
  deliverRequiresReady?: boolean;
  onOrdersShouldRefresh?: () => void;
};

export function OpenAccountsPanel({
  adminPassword,
  orders,
  canManage = true,
  canCloseAccounts = canManage,
  canRegisterPayments = canCloseAccounts,
  canSplitBill = false,
  compact = false,
  title = "Cuentas abiertas",
  description = "Abre una cuenta para una mesa o ubicación, asocia pedidos de consumo local y ciérrala desde caja. Cerrar una cuenta no registra cobro ni cambia estados de pago.",
  closeRoleLabel = "Caja",
  tableOptions = [],
  preferredTableName = "",
  externalOpenAccounts,
  collapsible = false,
  deliverRequiresReady = false,
  onOrdersShouldRefresh,
}: OpenAccountsPanelProps) {
  const [openAccounts, setOpenAccounts] = useState<OpenAccount[]>([]);
  // Preferencia recordada por equipo; solo tiene efecto si collapsible=true.
  const [isCollapsed, setIsCollapsed] = usePersistedToggle(
    "caja_open_accounts_collapsed",
    false,
  );
  const [isLoading, setIsLoading] = useState(false);
  // Guardado POR ÁMBITO (id de cuenta o "create"): una acción en curso solo
  // congela SU tarjeta — antes un isSaving global deshabilitaba los botones
  // de TODAS las mesas a la vez y caja no podía atender dos cuentas seguidas.
  const [savingScopes, setSavingScopes] = useState<Record<string, boolean>>({});
  const isScopeSaving = (scope: string) => Boolean(savingScopes[scope]);
  const startSaving = (scope: string) =>
    setSavingScopes((current) => ({ ...current, [scope]: true }));
  const stopSaving = (scope: string) =>
    setSavingScopes((current) => ({ ...current, [scope]: false }));
  const [message, setMessageState] = useState<string | null>(null);
  // true = el último mensaje es un éxito (verde); false = advertencia/error.
  // Antes TODO salía en el naranja de advertencia, hasta los éxitos.
  const [messageIsSuccess, setMessageIsSuccess] = useState(false);
  function showMessage(text: string | null, ok = false) {
    setMessageState(text);
    setMessageIsSuccess(ok);
  }
  const [form, setForm] = useState<CreateAccountForm>(EMPTY_CREATE_FORM);
  const [selectedOrderByAccount, setSelectedOrderByAccount] = useState<
    Record<string, string>
  >({});
  const [viewMode, setViewMode] = useState<AccountViewMode>("open");
  const [expandedAccounts, setExpandedAccounts] = useState<
    Record<string, boolean>
  >({});
  // Asociar un pedido YA existente es el camino viejo: sigue estando, pero
  // plegado. El camino de todos los días es "Agregar pedido", que abre el menú
  // con la mesa puesta. Antes el selector ocupaba el ancho de cada tarjeta.
  const [attachOpenAccounts, setAttachOpenAccounts] = useState<
    Record<string, boolean>
  >({});
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [accountPaymentForm, setAccountPaymentForm] =
    useState<AccountPaymentForm>(EMPTY_ACCOUNT_PAYMENT_FORM);
  const [closeAfterAccountPayment, setCloseAfterAccountPayment] =
    useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  // Modal propio de cierre (reemplaza el window.confirm nativo): guarda la
  // cuenta y su pendiente para decidir entre cerrar, cobrar primero o
  // marcarla Cancelada (cerrada SIN cobrar).
  const [closeModal, setCloseModal] = useState<{
    account: OpenAccount;
    accountOrders: OpenAccountOrderSummary[];
    pendingUSD: number;
  } | null>(null);
  const isModalSaving = closeModal ? isScopeSaving(closeModal.account.id) : false;

  const hasExternalAccounts = Array.isArray(externalOpenAccounts);

  // En la vista "Abiertas" prioriza las cuentas que ya sondea la página; el
  // historial ("all") siempre viene del fetch interno con status=all.
  const accountsSource = useMemo(
    () =>
      hasExternalAccounts && viewMode === "open"
        ? (externalOpenAccounts as OpenAccount[])
        : openAccounts,
    [externalOpenAccounts, hasExternalAccounts, openAccounts, viewMode],
  );

  const activeAccounts = useMemo(
    () => accountsSource.filter((account) => account.status === "Abierta"),
    [accountsSource],
  );

  const visibleAccounts = useMemo(() => {
    const base = viewMode === "all" ? accountsSource : activeAccounts;
    // Las mesas que PIDIERON la cuenta van primero: es la cola de atención.
    return [...base].sort((first, second) => {
      const firstRequested =
        first.status === "Abierta" && getBillRequestedAt(first.note) ? 1 : 0;
      const secondRequested =
        second.status === "Abierta" && getBillRequestedAt(second.note) ? 1 : 0;
      return secondRequested - firstRequested;
    });
  }, [accountsSource, activeAccounts, viewMode]);

  const eligibleOrders = useMemo(
    () => orders.filter(isEligibleOrderForOpenAccount),
    [orders],
  );

  const unlinkedEligibleOrders = useMemo(
    () => eligibleOrders.filter((order) => !getOrderAccountId(order)),
    [eligibleOrders],
  );
  // H-4 camino B: un pedido del cliente ya NO se suma solo a la cuenta de la
  // mesa (cualquiera desde internet podía cargarle comida a una mesa ajena).
  // Entra a cocina igual y aquí se pregunta "¿Sumar a la cuenta?".
  // "Dejarlo aparte" es una preferencia de PANTALLA, no un estado del negocio:
  // vive en este equipo, no toca la base, y solo esconde la sugerencia — el
  // pedido se cobra por su cuenta como cualquier pedido de mesa.
  const [dismissedAttachOrderIds, setDismissedAttachOrderIds] = useState<
    string[]
  >([]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DISMISSED_ATTACH_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];

      if (Array.isArray(parsed)) {
        setDismissedAttachOrderIds(
          parsed.filter((id): id is string => typeof id === "string"),
        );
      }
    } catch {
      // localStorage bloqueado (modo privado): la sugerencia sigue saliendo.
    }
  }, []);

  function dismissAttachSuggestion(orderId: string) {
    setDismissedAttachOrderIds((current) => {
      if (current.includes(orderId)) return current;

      // Tope: es una lista de descartes, no un historial.
      const next = [...current, orderId].slice(-200);

      try {
        window.localStorage.setItem(
          DISMISSED_ATTACH_STORAGE_KEY,
          JSON.stringify(next),
        );
      } catch {
        // idem
      }

      return next;
    });
  }
  const knownTableOptions = useMemo(() => {
    const options = [
      ...tableOptions,
      ...eligibleOrders.map((order) => order.tableNumber),
    ];
    const seen = new Set<string>();

    return options
      .map((option) => String(option || "").trim())
      .filter(Boolean)
      .filter((option) => {
        const key = getNormalizedTable(option);

        if (!key || seen.has(key)) return false;

        seen.add(key);
        return true;
      });
  }, [eligibleOrders, tableOptions]);

  const activeTotals = useMemo(() => {
    return activeAccounts.reduce(
      (summary, account) => {
        const accountOrders = mergeAccountOrders(account, orders);
        const totals = getComputedAccountTotals(account, accountOrders);

        summary.totalEstimatedUSD += totals.totalEstimatedUSD;
        summary.totalCollectedUSD += totals.totalCollectedUSD;
        summary.pendingUSD += totals.pendingUSD;
        summary.ordersCount += accountOrders.length;

        return summary;
      },
      {
        totalEstimatedUSD: 0,
        totalCollectedUSD: 0,
        pendingUSD: 0,
        ordersCount: 0,
      },
    );
  }, [activeAccounts, orders]);

  const cleanPreferredTableName = preferredTableName.trim();

  function applyTableToForm(tableName: string) {
    const cleanTableName = tableName.trim();

    if (!cleanTableName) return;

    setForm((current) => ({
      ...current,
      tableNumber: cleanTableName,
      customerName: current.customerName.trim() || cleanTableName,
    }));
  }

  useEffect(() => {
    if (!canManage || !cleanPreferredTableName) return;

    // Difiere el setState un tick para no hacerlo síncrono en el efecto.
    const timer = setTimeout(() => syncFormWithPreferredTable(), 0);
    return () => clearTimeout(timer);

    function syncFormWithPreferredTable() {
      setForm((current) => {
      if (
        getNormalizedTable(current.tableNumber) ===
        getNormalizedTable(cleanPreferredTableName)
      ) {
        return current;
      }

        return {
          ...current,
          tableNumber: cleanPreferredTableName,
          customerName: current.customerName.trim() || cleanPreferredTableName,
        };
      });
    }
  }, [canManage, cleanPreferredTableName]);

  async function loadOpenAccounts(
    silent = false,
    requestedViewMode: AccountViewMode = viewMode,
  ) {
    if (!adminPassword) return;

    if (!silent) setIsLoading(true);
    showMessage(null);

    try {
      const statusParam = requestedViewMode === "all" ? "all" : "Abierta";
      const response = await fetch(
        `/api/open-accounts?status=${encodeURIComponent(statusParam)}`,
        {
          headers: { "x-admin-password": adminPassword },
          cache: "no-store",
        },
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        setOpenAccounts([]);
        throw new Error(
          data.error ||
            data.message ||
            "No se pudieron cargar las cuentas abiertas",
        );
      }

      setOpenAccounts(
        Array.isArray(data.openAccounts) ? data.openAccounts : [],
      );
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar las cuentas abiertas",
      );
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  async function changeViewMode(nextViewMode: AccountViewMode) {
    setViewMode(nextViewMode);

    // Con cuentas externas la vista "Abiertas" ya está al día por la página.
    if (nextViewMode === "open" && hasExternalAccounts) return;

    await loadOpenAccounts(false, nextViewMode);
  }

  // Tras crear/asociar/cobrar/cerrar: si la página provee las cuentas, basta
  // con onOrdersShouldRefresh (el caller lo dispara); solo el historial
  // necesita recargarse aquí.
  async function refreshAccountsAfterAction() {
    if (!hasExternalAccounts || viewMode === "all") {
      await loadOpenAccounts(true, viewMode);
    }
  }

  async function createOpenAccount() {
    if (!canManage || isScopeSaving("create")) return;

    const tableNumber = form.tableNumber.trim();
    const customerName = form.customerName.trim() || tableNumber;

    if (!tableNumber) {
      showMessage("Indica la mesa o ubicación para abrir la cuenta.");
      return;
    }

    startSaving("create");
    showMessage(null);

    try {
      const response = await fetch("/api/open-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          tableNumber,
          customerName,
          customerPhone: form.customerPhone.trim(),
          note: form.note.trim(),
        }),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "No se pudo abrir la cuenta",
        );
      }

      setForm(EMPTY_CREATE_FORM);
      setExpandedAccounts((current) => ({
        ...current,
        [data.openAccount?.id || ""]: true,
      }));
      showMessage("Cuenta abierta correctamente.", true);
      await refreshAccountsAfterAction();
      onOrdersShouldRefresh?.();
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "No se pudo abrir la cuenta",
      );
    } finally {
      stopSaving("create");
    }
  }

  // orderIdArg: lo manda el botón "Sumar a la cuenta" de la sugerencia (H-4
  // camino B). Sin él se usa el pedido elegido en el desplegable de siempre.
  async function attachOrder(accountId: string, orderIdArg?: string) {
    if (!canManage || isScopeSaving(accountId)) return;

    const orderId = orderIdArg || selectedOrderByAccount[accountId];

    if (!orderId) {
      showMessage("Selecciona un pedido local para asociar a la cuenta.");
      return;
    }

    startSaving(accountId);
    showMessage(null);

    try {
      const response = await fetch(
        `/api/open-accounts/${encodeURIComponent(accountId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": adminPassword,
          },
          body: JSON.stringify({ action: "attachOrder", orderId }),
        },
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "No se pudo asociar el pedido",
        );
      }

      setSelectedOrderByAccount((current) => ({ ...current, [accountId]: "" }));
      setExpandedAccounts((current) => ({ ...current, [accountId]: true }));
      showMessage("Pedido asociado a la cuenta abierta.", true);
      await refreshAccountsAfterAction();
      onOrdersShouldRefresh?.();
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "No se pudo asociar el pedido",
      );
    } finally {
      stopSaving(accountId);
    }
  }

  async function updateAccountOrderStatus(
    accountId: string,
    orderId: string,
    status: "Listo" | "Entregado",
  ) {
    if (!canManage || isScopeSaving(accountId)) return;

    startSaving(accountId);
    showMessage(null);

    try {
      const response = await fetch(
        `/api/open-accounts/${encodeURIComponent(accountId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": adminPassword,
          },
          body: JSON.stringify({
            action: "updateOrderStatus",
            orderId,
            status,
          }),
        },
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "No se pudo actualizar la entrega",
        );
      }

      setExpandedAccounts((current) => ({ ...current, [accountId]: true }));
      showMessage(
        status === "Entregado"
          ? "Pedido marcado como entregado en la cuenta."
          : "Pedido reabierto como listo/no entregado.",
        true,
      );
      await refreshAccountsAfterAction();
      onOrdersShouldRefresh?.();
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la entrega",
      );
    } finally {
      stopSaving(accountId);
    }
  }

  // Marca/desmarca UN producto del pedido como entregado al cliente.
  // Va directo al pedido (PATCH /api/orders/:id) y refresca la cuenta.
  async function toggleAccountItemDelivered(
    accountId: string,
    orderId: string,
    item: { cartLineId?: string; id: number; name: string },
    delivered: boolean,
  ) {
    if (!canManage || isScopeSaving(accountId)) return;

    startSaving(accountId);
    showMessage(null);

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": adminPassword,
          },
          body: JSON.stringify({
            action: "setItemDelivered",
            lineId: item.cartLineId || "",
            productId: item.id,
            itemName: item.name,
            delivered,
          }),
        },
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "No se pudo marcar el producto",
        );
      }

      setExpandedAccounts((current) => ({ ...current, [accountId]: true }));
      showMessage(
        delivered
          ? `"${item.name}" marcado como entregado.`
          : `"${item.name}" vuelve a pendiente por entregar.`,
        true,
      );
      await refreshAccountsAfterAction();
      onOrdersShouldRefresh?.();
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "No se pudo marcar el producto",
      );
    } finally {
      stopSaving(accountId);
    }
  }

  // El mesonero/caja fue a la mesa: apaga el badge "piden la cuenta" sin
  // tocar cobros ni estados (también se apaga solo al cobrar o cerrar).
  async function clearBillRequest(accountId: string) {
    if (!canManage || isScopeSaving(accountId)) return;

    startSaving(accountId);
    showMessage(null);

    try {
      const response = await fetch(
        `/api/open-accounts/${encodeURIComponent(accountId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": adminPassword,
          },
          body: JSON.stringify({ action: "clearBillRequest" }),
        },
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "No se pudo marcar la petición como atendida",
        );
      }

      showMessage("Petición de cuenta marcada como atendida.", true);
      await refreshAccountsAfterAction();
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "No se pudo marcar la petición como atendida",
      );
    } finally {
      stopSaving(accountId);
    }
  }

  // "Agregar pedido": abre el menú público con la MESA (y la sede) ya
  // puestas. El carrito detecta la cuenta abierta de esa mesa y el pedido
  // nace asociado — se acabó el ciclo salir → registrar → volver → buscarlo
  // en el select. El panel lo trae solo con el sondeo de la página.
  function openMenuForAccount(account: OpenAccount) {
    const params = new URLSearchParams();
    const branchId = getSelectedBranchId();
    if (branchId) params.set("branch", branchId);
    params.set("mesa", account.tableNumber);
    window.open(`/?${params.toString()}#menu`, "_blank", "noopener");
  }

  // Paso 1 del cierre: abrir el modal propio con el pendiente a la vista
  // (antes era un window.confirm nativo, el único diálogo sin estilo del
  // panel, y la gente cerraba cuentas con dinero pendiente sin darse cuenta).
  function requestCloseAccount(
    account: OpenAccount,
    accountOrders: OpenAccountOrderSummary[],
  ) {
    if (
      !canManage ||
      !canCloseAccounts ||
      isScopeSaving(account.id) ||
      account.status !== "Abierta"
    )
      return;

    const totals = getComputedAccountTotals(account, accountOrders);
    setCloseModal({
      account,
      accountOrders,
      pendingUSD: Number(totals.pendingUSD || 0),
    });
    showMessage(null);
  }

  // Paso 2: cierre confirmado desde el modal. "Cerrada" = cierre normal;
  // "Cancelada" = quedó claro que ese dinero NO se va a cobrar.
  async function confirmCloseAccount(closeStatus: "Cerrada" | "Cancelada") {
    const target = closeModal;
    if (!target || isScopeSaving(target.account.id)) return;

    startSaving(target.account.id);
    showMessage(null);

    try {
      const response = await fetch(
        `/api/open-accounts/${encodeURIComponent(target.account.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": adminPassword,
          },
          body: JSON.stringify({
            action: "close",
            closeStatus,
            closedBy: closeRoleLabel,
          }),
        },
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "No se pudo cerrar la cuenta",
        );
      }

      setCloseModal(null);
      showMessage(
        closeStatus === "Cancelada"
          ? `Cuenta de ${target.account.tableNumber} marcada como Cancelada: quedó registrado que no se cobró.`
          : "Cuenta cerrada correctamente. Los cobros reales no fueron modificados.",
        true,
      );
      await refreshAccountsAfterAction();
      onOrdersShouldRefresh?.();
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "No se pudo cerrar la cuenta",
      );
    } finally {
      stopSaving(target.account.id);
    }
  }

  function openAccountPayment(
    account: OpenAccount,
    accountOrders: OpenAccountOrderSummary[],
  ) {
    const totals = getComputedAccountTotals(account, accountOrders);

    setPaymentAccountId(account.id);
    // El camino normal es "cobrar Y cerrar": la casilla arranca activada y
    // caja la desmarca solo si la cuenta debe seguir abierta.
    setCloseAfterAccountPayment(true);
    setSplitOpen(false);
    setAccountPaymentForm({
      ...EMPTY_ACCOUNT_PAYMENT_FORM,
      amountReceivedUSD: formatMoneyForInput(totals.pendingUSD),
      paymentNote: `Cobro de cuenta abierta ${account.tableNumber}`.trim(),
    });
    setExpandedAccounts((current) => ({ ...current, [account.id]: true }));
    showMessage(null);
  }

  function updateAccountPaymentForm<K extends keyof AccountPaymentForm>(
    field: K,
    value: AccountPaymentForm[K],
  ) {
    setAccountPaymentForm((current) => ({ ...current, [field]: value }));
    showMessage(null);
  }


  async function saveAccountPayment(account: OpenAccount) {
    if (!canRegisterPayments || isScopeSaving(account.id)) return;

    const amountReceivedUSD = parseMoneyInput(
      accountPaymentForm.amountReceivedUSD,
    );
    const amountReceivedVES = parseMoneyInput(
      accountPaymentForm.amountReceivedVES,
    );

    if (amountReceivedUSD <= 0 && amountReceivedVES <= 0) {
      showMessage("Indica el monto recibido para cobrar la cuenta.");
      return;
    }

    startSaving(account.id);
    showMessage(null);

    try {
      const response = await fetch(
        `/api/open-accounts/${encodeURIComponent(account.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": adminPassword,
          },
          body: JSON.stringify({
            action: "payAccount",
            amountReceivedUSD,
            amountReceivedVES,
            paymentMethodUSD: accountPaymentForm.paymentMethodUSD,
            paymentMethodVES: accountPaymentForm.paymentMethodVES,
            deliveryPaymentIn: accountPaymentForm.deliveryPaymentIn,
            paymentNote: accountPaymentForm.paymentNote,
            closeIfPaid: closeAfterAccountPayment,
            closedBy: closeRoleLabel,
          }),
        },
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "No se pudo cobrar la cuenta",
        );
      }

      const unusedUSD = Number(data.unusedAmountUSD || 0);
      const unusedVES = Number(data.unusedAmountVES || 0);
      const unusedMessage =
        unusedUSD > 0.01 || unusedVES > 0.01
          ? ` Quedó un excedente no aplicado: ${formatUSD(unusedUSD)}${unusedVES > 0.01 ? ` / Bs ${unusedVES.toFixed(2)}` : ""}.`
          : "";
      // El candado del servidor detectó otro cobro simultáneo: se aplicó lo
      // que se pudo y caja debe mirar el pendiente fresco antes de repetir.
      const conflictMessage = data.conflictNotice
        ? ` ${String(data.conflictNotice)}`
        : "";
      const closedMessage =
        data.openAccount?.status === "Cerrada"
          ? " La cuenta quedó pagada y CERRADA."
          : "";

      setPaymentAccountId("");
      setAccountPaymentForm(EMPTY_ACCOUNT_PAYMENT_FORM);
      setCloseAfterAccountPayment(false);
      showMessage(
        `Cobro aplicado a la cuenta de ${account.tableNumber}.${closedMessage}${unusedMessage}${conflictMessage}`,
        // El cobro con carrera detectada NO es un éxito limpio: naranja.
        !conflictMessage,
      );
      await refreshAccountsAfterAction();
      onOrdersShouldRefresh?.();
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "No se pudo cobrar la cuenta",
      );
    } finally {
      stopSaving(account.id);
    }
  }

  function toggleAccountDetails(accountId: string) {
    setExpandedAccounts((current) => ({
      ...current,
      [accountId]: !current[accountId],
    }));
  }

  function toggleAttachPicker(accountId: string) {
    setAttachOpenAccounts((current) => ({
      ...current,
      [accountId]: !current[accountId],
    }));
  }

  useEffect(() => {
    // Con cuentas externas no hace falta el fetch propio: la página dueña
    // del sondeo ya mantiene la lista al día.
    if (!adminPassword || hasExternalAccounts) return;
    const timer = setTimeout(() => loadOpenAccounts(true), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPassword, hasExternalAccounts, orders.length]);

  const collapsed = collapsible && isCollapsed;

  const wrapperClass = compact
    ? "mt-4 rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_8px_0_rgba(var(--brand-primary-rgb),0.10)]"
    : "mt-4 rounded-[1.6rem] border-4 border-[var(--brand-primary)] bg-white p-4 shadow-[0_10px_0_rgba(var(--brand-primary-rgb),0.12)] sm:p-5";

  return (
    <section className={wrapperClass}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            <Store size={18} />
            {title}
          </p>
          <h2 className="mt-1 text-2xl font-black uppercase text-[var(--brand-ink-2)]">
            Consumo local por cuenta
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {collapsible && (
            <button
              type="button"
              onClick={() => setIsCollapsed((value) => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
            >
              {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              {collapsed ? "Mostrar cuentas" : "Ocultar cuentas"}
            </button>
          )}
          <button
            type="button"
            onClick={() => changeViewMode("open")}
            disabled={isLoading || viewMode === "open"}
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-yellow-50 disabled:bg-[var(--brand-primary)] disabled:text-white"
          >
            Abiertas
          </button>
          <button
            type="button"
            onClick={() => changeViewMode("all")}
            disabled={isLoading || viewMode === "all"}
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-yellow-50 disabled:bg-[var(--brand-primary)] disabled:text-white"
          >
            Historial
          </button>
          <button
            type="button"
            onClick={() => loadOpenAccounts()}
            disabled={isLoading || !adminPassword}
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Actualizar
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mt-4 rounded-2xl border-2 p-3 text-sm font-bold ${
            messageIsSuccess
              ? "border-green-600 bg-green-50 text-green-800"
              : "border-orange-300 bg-orange-50 text-orange-900"
          }`}
        >
          {message}
        </div>
      )}

      {collapsed && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MiniStat label="Abiertas" value={activeAccounts.length} small />
          <MiniStat
            label="Pedidos en cuenta"
            value={activeTotals.ordersCount}
            small
          />
          <MiniStat
            label="Pendiente total"
            value={formatUSD(activeTotals.pendingUSD)}
            small
            tone={activeTotals.pendingUSD > 0 ? "warning" : "success"}
          />
        </div>
      )}

      {!collapsed && (
        <>
      {canManage && cleanPreferredTableName && (
        <div className="mt-4 flex flex-col gap-2 rounded-[1.2rem] border-2 border-yellow-400 bg-yellow-50 p-3 text-xs font-bold text-[var(--brand-ink)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Mesa seleccionada en el mapa:{" "}
            <strong>{cleanPreferredTableName}</strong>. Puedes abrir la cuenta
            con esa mesa o cambiarla manualmente.
          </span>
          <button
            type="button"
            onClick={() => applyTableToForm(cleanPreferredTableName)}
            className="inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.10em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
          >
            Usar mesa
          </button>
        </div>
      )}

      {canManage && (
        <div className="mt-4 grid gap-3 rounded-[1.2rem] border-2 border-[var(--brand-primary)]/30 bg-[var(--brand-cream)] p-3 lg:grid-cols-[1fr_1fr_1fr_1.3fr_auto]">
          <div className="space-y-1">
            <input
              value={form.tableNumber}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  tableNumber: event.target.value,
                }))
              }
              list="open-account-table-options"
              placeholder="Mesa / ubicación"
              className="w-full rounded-2xl border-2 border-[var(--brand-primary)]/30 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
            />
            {knownTableOptions.length > 0 && (
              <datalist id="open-account-table-options">
                {knownTableOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            )}
          </div>
          <input
            value={form.customerName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                customerName: event.target.value,
              }))
            }
            placeholder="Cliente o referencia"
            className="rounded-2xl border-2 border-[var(--brand-primary)]/30 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
          />
          <input
            value={form.customerPhone}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                customerPhone: event.target.value,
              }))
            }
            placeholder="Teléfono opcional"
            className="rounded-2xl border-2 border-[var(--brand-primary)]/30 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
          />
          <input
            value={form.note}
            onChange={(event) =>
              setForm((current) => ({ ...current, note: event.target.value }))
            }
            placeholder="Nota opcional"
            className="rounded-2xl border-2 border-[var(--brand-primary)]/30 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
          />
          <button
            type="button"
            onClick={createOpenAccount}
            disabled={isScopeSaving("create") || !form.tableNumber.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[var(--brand-primary-dark)] disabled:opacity-50"
          >
            {isScopeSaving("create") ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            Abrir
          </button>
        </div>
      )}

      {canManage && knownTableOptions.length > 0 && (
        <div className="mt-3 rounded-[1.2rem] border-2 border-[var(--brand-primary)]/20 bg-white p-3">
          <p className="text-[0.66rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]/75">
            Mesas configuradas
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {knownTableOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    tableNumber: option,
                    customerName: current.customerName || option,
                  }))
                }
                className="shrink-0 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.10em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)]"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-5">
        <MiniStat label="Abiertas" value={activeAccounts.length} />
        <MiniStat label="Pedidos en cuenta" value={activeTotals.ordersCount} />
        <MiniStat
          label="Total estimado"
          value={formatUSD(activeTotals.totalEstimatedUSD)}
        />
        <MiniStat
          label="Cobrado real"
          value={formatUSD(activeTotals.totalCollectedUSD)}
          tone="success"
        />
        <MiniStat
          label="Pendiente total"
          value={formatUSD(activeTotals.pendingUSD)}
          tone={activeTotals.pendingUSD > 0 ? "warning" : "success"}
        />
      </div>

      <div className="mt-3 rounded-[1.2rem] border-2 border-[var(--brand-primary)]/20 bg-white p-3 text-xs font-bold leading-5 text-[#1a1a1a]/75">
        Cuentas abiertas organizan pedidos por mesa.{" "}
        <strong>
          Cerrar una cuenta no cobra, no marca pedidos como pagados y no cambia
          el cierre del día.
        </strong>{" "}
        Caja sigue registrando cada cobro real desde el pedido correspondiente.
      </div>

      {unlinkedEligibleOrders.length > 0 && canManage && (
        <div className="mt-4 rounded-[1.2rem] border-2 border-yellow-400 bg-yellow-50 p-3 text-xs font-bold text-[var(--brand-ink)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex items-center gap-2">
              <AlertTriangle size={16} />
              Hay {unlinkedEligibleOrders.length} pedido(s) locales sin cuenta
              abierta asociada.
            </p>
            <p className="text-[var(--brand-ink-2)]/65">
              Abre la cuenta correspondiente o usa el selector dentro de cada
              mesa para asociarlos.
            </p>
          </div>
        </div>
      )}

      {/* Cómo funciona el módulo se explica UNA vez, no en cada mesa: antes
          este párrafo se repetía dentro de cada tarjeta y con 6 mesas abiertas
          eran 6 tutoriales idénticos ocupando el panel. */}
      {canManage && visibleAccounts.length > 0 && (
        <p className="mt-4 text-[0.7rem] font-bold leading-5 text-[var(--brand-ink-2)]/55">
          {canCloseAccounts
            ? "Cobrar reparte el monto sobre los pedidos pendientes de la cuenta; cerrar solo la retira de la operación activa."
            : "Como mesonero puedes abrir cuentas y sumarles pedidos. Los cobros y el cierre los lleva caja."}
        </p>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {visibleAccounts.length === 0 ? (
          <div className="rounded-[1.2rem] border-2 border-dashed border-[var(--brand-primary)]/35 bg-white p-5 text-sm font-bold text-[#1a1a1a]/70 xl:col-span-2">
            {viewMode === "all"
              ? "No hay cuentas registradas en este momento."
              : "No hay cuentas abiertas activas en este momento."}
          </div>
        ) : (
          visibleAccounts.map((account) => {
            const accountOrders = mergeAccountOrders(account, orders);
            const accountOrderIds = new Set(
              accountOrders.map((order) => order.id),
            );
            const totals = getComputedAccountTotals(account, accountOrders);
            const expanded =
              expandedAccounts[account.id] || accountOrders.length <= 2;
            const suggestedOrders = unlinkedEligibleOrders.filter((order) =>
              isSameTable(account, order),
            );
            // H-4 camino B: los pedidos de ESTA mesa que están esperando el
            // visto bueno del personal para entrar en la cuenta.
            const pendingAttachOrders = suggestedOrders.filter(
              (order) => !dismissedAttachOrderIds.includes(order.id),
            );
            const otherAttachableOrders = unlinkedEligibleOrders.filter(
              (order) => !isSameTable(account, order),
            );
            const isClosed = account.status !== "Abierta";
            const isCardSaving = isScopeSaving(account.id);
            // El cliente pidió la cuenta desde su teléfono: badge + primero
            // en la lista. La nota siempre se muestra SIN el marcador.
            const billRequestedAt = isClosed
              ? ""
              : getBillRequestedAt(account.note);
            const displayNote = stripBillRequestMarker(account.note || "");
            const operationalTone = getAccountOperationalTone(
              totals,
              accountOrders,
            );
            const deliveryTone = getAccountDeliveryTone(accountOrders);
            const deliveryStats = getAccountDeliveryStats(accountOrders);
            const pendingOrdersCount =
              getAccountPendingOrdersCount(accountOrders);

            return (
              <article
                key={account.id}
                className={`rounded-[1.3rem] border-2 bg-white p-4 shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.10)] ${
                  isClosed
                    ? "border-zinc-300 opacity-85"
                    : "border-[var(--brand-primary)]"
                }`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                        {account.tableNumber}
                      </p>
                      <span
                        className={`rounded-full border px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] ${getAccountStatusClasses(account.status)}`}
                      >
                        {formatAccountStatusLabel(account.status)}
                      </span>
                      {billRequestedAt ? (
                        <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border-2 border-red-500 bg-red-500/10 px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-red-600">
                          🔔 Piden la cuenta · {formatAccountDate(billRequestedAt)}
                        </span>
                      ) : null}
                      {billRequestedAt && canManage ? (
                        <button
                          type="button"
                          onClick={() => clearBillRequest(account.id)}
                          disabled={isCardSaving}
                          className="rounded-full border border-[var(--brand-border)] bg-white px-2.5 py-1 text-[0.6rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/60 transition hover:text-[var(--brand-ink-2)] disabled:opacity-50"
                        >
                          Atendida
                        </button>
                      ) : null}
                    </div>
                    <h3 className="mt-1 text-xl font-black text-[var(--brand-ink-2)]">
                      {account.customerName || "Cuenta local"}
                    </h3>
                    <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/60">
                      {account.customerPhone
                        ? `Tel. ${account.customerPhone} · `
                        : ""}
                      Abierta {formatAccountDate(account.createdAt)}
                    </p>
                    {displayNote && (
                      <p className="mt-2 rounded-2xl bg-[var(--brand-cream)] px-3 py-2 text-xs font-bold text-[var(--brand-ink-2)]/75">
                        {displayNote}
                      </p>
                    )}
                    {isClosed && account.closedAt && (
                      <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.10em] text-zinc-700">
                        <Clock size={13} />
                        Cerrada por {account.closedBy || "Caja"}
                      </p>
                    )}
                  </div>

                  {/* Un vistazo = una decisión: el PENDIENTE manda (es lo que
                      caja resuelve) y el resto va en una línea compacta.
                      Antes eran 5 MiniStats por tarjeta. */}
                  <div className="text-center lg:w-[220px] lg:shrink-0">
                    <MiniStat
                      label="Pendiente"
                      value={formatUSD(totals.pendingUSD)}
                      tone={totals.pendingUSD > 0 ? "warning" : "success"}
                    />
                    <p className="mt-1.5 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/60">
                      {accountOrders.length}{" "}
                      {accountOrders.length === 1 ? "pedido" : "pedidos"} ·{" "}
                      {deliveryStats.delivered} entregados
                      {deliveryStats.ready > 0
                        ? ` · ${deliveryStats.ready} listos`
                        : ""}
                      {pendingOrdersCount > 0
                        ? ` · ${pendingOrdersCount} por cobrar`
                        : ""}
                    </p>
                  </div>
                </div>

                {/* Una sola caja de tono (dinero manda) con el estado de
                    entrega como chip al lado — antes eran dos párrafos. */}
                <div
                  className={`mt-4 rounded-2xl border-2 px-3 py-2 text-xs font-bold leading-5 ${operationalTone.className}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black uppercase tracking-[0.12em]">
                      {operationalTone.label}
                    </p>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.1em] ${deliveryTone.className}`}
                    >
                      {deliveryTone.label}
                    </span>
                  </div>
                  <p className="mt-1">{operationalTone.text}</p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAccountDetails(account.id)}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--brand-primary)]/30 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.10em] text-[var(--brand-primary)] transition hover:bg-yellow-50"
                  >
                    {expanded ? (
                      <ChevronUp size={15} />
                    ) : (
                      <ChevronDown size={15} />
                    )}
                    {expanded
                      ? "Ocultar pedidos"
                      : `Ver pedidos (${accountOrders.length})`}
                  </button>

                  {/* El chip de "N sugeridos" se fue: el botón "Asociar uno
                      existente (N)" de abajo ya lleva la misma cuenta. */}
                </div>

                {expanded && (
                  <div className="mt-4 space-y-2">
                    {accountOrders.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[var(--brand-primary)]/25 bg-[var(--brand-cream)] p-3 text-xs font-bold text-[var(--brand-ink-2)]/70">
                        Esta cuenta todavía no tiene pedidos asociados.
                      </div>
                    ) : (
                      accountOrders.map((order) => (
                        <div
                          key={order.id}
                          className="rounded-2xl border border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] p-3 text-xs font-bold text-[var(--brand-ink-2)]/80"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                              {order.displayNumber || order.id} ·{" "}
                              {order.customerName || "Cliente"}
                            </span>
                            <span>
                              {formatUSD(order.totalUSD)} ·{" "}
                              {order.paymentStatus}
                            </span>
                          </div>
                          {/* "Cocina" y "Entrega" eran el MISMO order.status
                              pintado dos veces: queda una sola pill. */}
                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            <OrderPill
                              label="Estado"
                              value={getOrderDeliveryLabel(order.status)}
                              tone={getOrderDeliveryTone(order.status)}
                            />
                            <OrderPill
                              label="Cobrado"
                              value={formatUSD(order.receivedEquivalentUSD)}
                            />
                            <OrderPill
                              label="Pendiente"
                              value={formatUSD(order.pendingUSD)}
                              tone={
                                order.pendingUSD > 0 ? "warning" : "success"
                              }
                            />
                          </div>
                          <OrderItemsPreview
                            order={order}
                            isTogglingDelivered={isCardSaving}
                            onToggleItemDelivered={
                              canManage &&
                              !isClosed &&
                              order.status !== "Cancelado" &&
                              // Mesonero (2026-07-28): tampoco marca productos
                              // hasta que el pedido esté LISTO (misma regla
                              // que aplica el servidor).
                              (!deliverRequiresReady ||
                                order.status === "Listo" ||
                                order.status === "Entregado")
                                ? (item, delivered) =>
                                    toggleAccountItemDelivered(
                                      account.id,
                                      order.id,
                                      item,
                                      delivered,
                                    )
                                : undefined
                            }
                          />
                          {canManage &&
                          !isClosed &&
                          order.status !== "Cancelado" ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {order.status !== "Entregado" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateAccountOrderStatus(
                                      account.id,
                                      order.id,
                                      "Entregado",
                                    )
                                  }
                                  disabled={
                                    isCardSaving ||
                                    (deliverRequiresReady && order.status !== "Listo")
                                  }
                                  title={
                                    deliverRequiresReady && order.status !== "Listo"
                                      ? "Cocina o caja deben marcar este pedido LISTO antes de entregarlo"
                                      : undefined
                                  }
                                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-green-700 bg-green-100 px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.10em] text-green-800 transition hover:bg-green-200 disabled:opacity-50"
                                >
                                  <CheckCircle2 size={14} />
                                  {deliverRequiresReady && order.status !== "Listo"
                                    ? "Esperando LISTO"
                                    : "Marcar entregado"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateAccountOrderStatus(
                                      account.id,
                                      order.id,
                                      "Listo",
                                    )
                                  }
                                  disabled={isCardSaving}
                                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-yellow-500 bg-yellow-50 px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.10em] text-[var(--brand-ink)] transition hover:bg-yellow-100 disabled:opacity-50"
                                >
                                  <RefreshCw size={14} />
                                  No entregado
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* H-4 camino B (decisión del dueño 2026-07-30): el pedido del
                    cliente ya no se suma solo a la cuenta — antes cualquiera
                    desde internet le cargaba comida a la mesa de otro. Entra a
                    cocina igual y aquí el personal decide. Sin esta tarjeta el
                    consumo se cobraría aparte sin que nadie se entere. */}
                {canManage && !isClosed && pendingAttachOrders.length > 0 && (
                  <div className="mt-4 rounded-2xl border-2 border-amber-400 bg-amber-50 p-3">
                    <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-amber-700">
                      ⏳ ¿Sumar {pendingAttachOrders.length === 1 ? "este pedido" : "estos pedidos"} a la cuenta de {account.tableNumber}?
                    </p>
                    <p className="mt-1 text-xs font-bold text-amber-900/80">
                      Ya están en cocina. NO entran en el pendiente de la cuenta
                      hasta que los sumes; si los dejas aparte, se cobran solos.
                    </p>
                    <div className="mt-2 flex flex-col gap-2">
                      {pendingAttachOrders.map((order) => {
                        const suggestedTotals = getOrderTotals(order);

                        return (
                          <div
                            key={order.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2"
                          >
                            <span className="min-w-0 text-xs font-black text-[var(--brand-ink-2)]">
                              {getDisplayOrderNumber(order)} ·{" "}
                              {order.customerName} ·{" "}
                              {formatUSD(suggestedTotals.totalUSD)}
                            </span>
                            <span className="flex shrink-0 flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => attachOrder(account.id, order.id)}
                                disabled={isCardSaving}
                                className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-3 py-1.5 text-[0.66rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
                              >
                                <Plus size={13} />
                                Sumar a la cuenta
                              </button>
                              <button
                                type="button"
                                onClick={() => dismissAttachSuggestion(order.id)}
                                className="rounded-2xl px-2.5 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/55 transition hover:text-[var(--brand-ink-2)]"
                              >
                                Dejarlo aparte
                              </button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {canManage && !isClosed && (
                  <div className="mt-4 flex flex-wrap items-stretch gap-2">
                    {/* Camino principal para sumar consumo: el menú se abre con
                        la mesa puesta. El pedido llega a la mesa y se confirma
                        arriba con "Sumar a la cuenta" (H-4 camino B). */}
                    <button
                      type="button"
                      onClick={() => openMenuForAccount(account)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)]"
                      title="Abre el menú con esta mesa puesta: lo que registres entra solo a esta cuenta"
                    >
                      <Plus size={15} />
                      Agregar pedido
                    </button>
                    {/* El asociador vive plegado: es el camino de excepción
                        (un pedido que ya existía sin cuenta). Se abre solo si
                        hace falta, y así la fila de acciones deja de estar
                        dominada por un desplegable del ancho de la tarjeta. */}
                    {!attachOpenAccounts[account.id] && (
                      <button
                        type="button"
                        onClick={() => toggleAttachPicker(account.id)}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl px-3 py-2 text-[0.66rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/55 transition hover:text-[var(--brand-primary)]"
                      >
                        <Link2 size={13} />
                        Asociar uno existente
                        {suggestedOrders.length > 0
                          ? ` (${suggestedOrders.length})`
                          : ""}
                      </button>
                    )}
                    {attachOpenAccounts[account.id] && (
                    <select
                      value={selectedOrderByAccount[account.id] || ""}
                      onChange={(event) =>
                        setSelectedOrderByAccount((current) => ({
                          ...current,
                          [account.id]: event.target.value,
                        }))
                      }
                      className="w-full min-w-0 flex-1 rounded-2xl border-2 border-[var(--brand-primary)]/30 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#1a1a1a] outline-none focus:border-[var(--brand-primary)] sm:w-auto sm:basis-[16rem]"
                    >
                      <option value="">
                        Asociar pedido local pendiente de cuenta
                      </option>
                      {suggestedOrders.length > 0 && (
                        <optgroup label="Sugeridos por mesa">
                          {suggestedOrders.map((order) => {
                            const payment = getOrderPayment(order);
                            const totals = getOrderTotals(order);
                            return (
                              <option key={order.id} value={order.id}>
                                {getDisplayOrderNumber(order)} ·{" "}
                                {order.customerName} ·{" "}
                                {formatUSD(totals.totalUSD)} · {payment.status}
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                      {otherAttachableOrders.length > 0 && (
                        <optgroup label="Otros pedidos locales sin cuenta">
                          {otherAttachableOrders.map((order) => {
                            const payment = getOrderPayment(order);
                            const totals = getOrderTotals(order);
                            return (
                              <option key={order.id} value={order.id}>
                                {getDisplayOrderNumber(order)} ·{" "}
                                {order.tableNumber} · {order.customerName} ·{" "}
                                {formatUSD(totals.totalUSD)} · {payment.status}
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                      {accountOrders.length > 0 && (
                        <optgroup label="Ya asociados a esta cuenta">
                          {accountOrders.map((order) => (
                            <option key={order.id} value="" disabled>
                              {order.displayNumber || order.id} · ya asociado
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {!suggestedOrders.length &&
                        !otherAttachableOrders.length &&
                        accountOrderIds.size === 0 && (
                          <option value="" disabled>
                            No hay pedidos locales disponibles
                          </option>
                        )}
                    </select>
                    )}
                    {attachOpenAccounts[account.id] && (
                      <button
                        type="button"
                        onClick={() => attachOrder(account.id)}
                        disabled={isCardSaving || !selectedOrderByAccount[account.id]}
                        className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:bg-[var(--brand-accent-200)] disabled:opacity-50"
                      >
                        <CreditCard size={15} />
                        Asociar pedido
                      </button>
                    )}
                    {/* UNA acción primaria según el estado del dinero: con
                        pendiente manda "Cobrar y cerrar" (el cobro trae el
                        auto-cierre activado); sin pendiente, "Cerrar cuenta".
                        Cerrar sin cobrar queda como camino secundario y pasa
                        por el modal que lo dice sin rodeos. */}
                    {canRegisterPayments && totals.pendingUSD > 0.01 && (
                      <button
                        type="button"
                        onClick={() =>
                          openAccountPayment(account, accountOrders)
                        }
                        disabled={isCardSaving}
                        className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[var(--brand-primary-dark)] disabled:opacity-50"
                      >
                        <CreditCard size={15} />
                        Cobrar y cerrar
                      </button>
                    )}
                    {canCloseAccounts && totals.pendingUSD <= 0.01 && (
                      <button
                        type="button"
                        onClick={() =>
                          requestCloseAccount(account, accountOrders)
                        }
                        disabled={isCardSaving}
                        className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border-2 border-green-700 bg-green-100 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-green-800 transition hover:bg-green-200 disabled:opacity-50"
                      >
                        <CheckCircle2 size={15} />
                        Cerrar cuenta
                      </button>
                    )}
                    {canCloseAccounts && totals.pendingUSD > 0.01 && (
                      <button
                        type="button"
                        onClick={() =>
                          requestCloseAccount(account, accountOrders)
                        }
                        disabled={isCardSaving}
                        className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-3 py-2 text-[0.66rem] font-black uppercase tracking-[0.12em] text-[var(--brand-ink-2)]/50 transition hover:text-[var(--brand-ink-2)] disabled:opacity-50"
                      >
                        Cerrar sin cobrar
                      </button>
                    )}
                  </div>
                )}

                {canRegisterPayments &&
                  paymentAccountId === account.id &&
                  !isClosed && (
                    <div className="mt-4 rounded-[1.4rem] border-2 border-[var(--brand-primary)] bg-white p-4 shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.08)]">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                            Cobro agrupado de cuenta
                          </p>
                          <p className="mt-1 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/70">
                            Este monto se reparte automáticamente sobre los
                            pedidos pendientes de {account.tableNumber}.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentAccountId("");
                            setAccountPaymentForm(EMPTY_ACCOUNT_PAYMENT_FORM);
                          }}
                          className="rounded-full border-2 border-[var(--brand-primary)] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                        >
                          Cancelar
                        </button>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <MiniStat
                          label="Pendiente"
                          value={formatUSD(totals.pendingUSD)}
                          small
                          tone={totals.pendingUSD > 0 ? "warning" : "success"}
                        />
                        <MiniStat
                          label="Total cuenta"
                          value={formatUSD(totals.totalEstimatedUSD)}
                          small
                        />
                        <MiniStat
                          label="Pedidos"
                          value={accountOrders.length}
                          small
                        />
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <PaymentInput
                          label="Recibido en divisas"
                          value={accountPaymentForm.amountReceivedUSD}
                          onChange={(value) =>
                            updateAccountPaymentForm("amountReceivedUSD", value)
                          }
                          placeholder="Ej: 35.00"
                        />
                        <PaymentSelect
                          label="Método divisas"
                          value={accountPaymentForm.paymentMethodUSD}
                          onChange={(value) =>
                            updateAccountPaymentForm("paymentMethodUSD", value)
                          }
                          options={PAYMENT_METHOD_USD_OPTIONS}
                          emptyLabel="Sin registrar"
                        />
                        <PaymentInput
                          label="Recibido en bolívares"
                          value={accountPaymentForm.amountReceivedVES}
                          onChange={(value) =>
                            updateAccountPaymentForm("amountReceivedVES", value)
                          }
                          placeholder="Ej: 1569.25"
                        />
                        <PaymentSelect
                          label="Método Bs"
                          value={accountPaymentForm.paymentMethodVES}
                          onChange={(value) =>
                            updateAccountPaymentForm("paymentMethodVES", value)
                          }
                          options={PAYMENT_METHOD_VES_OPTIONS}
                          emptyLabel="Sin registrar"
                        />
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                        <PaymentSelect
                          label="Delivery pagado en"
                          value={accountPaymentForm.deliveryPaymentIn}
                          onChange={(value) =>
                            updateAccountPaymentForm(
                              "deliveryPaymentIn",
                              value as AccountPaymentForm["deliveryPaymentIn"],
                            )
                          }
                          options={DELIVERY_PAYMENT_OPTIONS}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateAccountPaymentForm(
                              "amountReceivedUSD",
                              formatMoneyForInput(totals.pendingUSD),
                            )
                          }
                          disabled={totals.pendingUSD <= 0.01}
                          className="rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-50"
                        >
                          Completar en divisas
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const rate =
                              getAccountRepresentativeExchangeRate(
                                accountOrders,
                              );
                            if (rate > 0) {
                              updateAccountPaymentForm(
                                "amountReceivedVES",
                                formatMoneyForInput(totals.pendingUSD * rate),
                              );
                            }
                          }}
                          disabled={
                            totals.pendingUSD <= 0.01 ||
                            getAccountRepresentativeExchangeRate(
                              accountOrders,
                            ) <= 0
                          }
                          className="rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] disabled:opacity-50"
                        >
                          Completar en Bs
                        </button>
                      </div>

                      {canSplitBill && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setSplitOpen(true)}
                            disabled={totals.pendingUSD <= 0.01}
                            className="inline-flex items-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent-100)] disabled:opacity-50"
                          >
                            <Users size={15} /> Separar cuenta
                          </button>
                          <SepararCuentaModal
                            open={splitOpen}
                            onClose={() => setSplitOpen(false)}
                            totalUSD={totals.pendingUSD}
                            label={account.tableNumber}
                            onUseAmount={(usd) =>
                              updateAccountPaymentForm(
                                "amountReceivedUSD",
                                formatMoneyForInput(usd),
                              )
                            }
                          />
                        </div>
                      )}

                      <div className="mt-3">
                        <label className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                          Nota de pago
                        </label>
                        <textarea
                          value={accountPaymentForm.paymentNote}
                          onChange={(event) =>
                            updateAccountPaymentForm(
                              "paymentNote",
                              event.target.value,
                            )
                          }
                          rows={3}
                          className="mt-2 w-full resize-none rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-sm font-bold text-[#1a1a1a] outline-none focus:border-[var(--brand-primary)]"
                        />
                      </div>

                      <label className="mt-3 flex items-start gap-3 rounded-2xl border-2 border-[var(--brand-primary)]/20 bg-[var(--brand-cream)] px-4 py-3 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/75">
                        <input
                          type="checkbox"
                          checked={closeAfterAccountPayment}
                          onChange={(event) =>
                            setCloseAfterAccountPayment(event.target.checked)
                          }
                          className="mt-1 h-4 w-4"
                        />
                        <span>
                          Cerrar la cuenta automáticamente si queda totalmente
                          pagada.
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={() => saveAccountPayment(account)}
                        disabled={isCardSaving}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[var(--brand-primary-dark)] disabled:opacity-50"
                      >
                        {isCardSaving ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <CreditCard size={16} />
                        )}
                        Guardar cobro agrupado
                      </button>
                    </div>
                  )}
              </article>
            );
          })
        )}
      </div>
        </>
      )}

      {/* Modal de cierre (reemplaza el window.confirm): con dinero pendiente
          la salida recomendada es cobrar primero; cerrar sin cobrar y marcar
          Cancelada quedan como decisiones explícitas, no como un "Aceptar"
          apurado. */}
      {closeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[1.6rem] border-2 border-[var(--brand-border)] bg-white p-5 shadow-xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
              Cerrar cuenta · {closeModal.account.tableNumber}
            </p>

            {closeModal.pendingUSD > 0.01 ? (
              <>
                <p className="mt-3 rounded-2xl border-2 border-amber-500 bg-amber-500/10 px-4 py-3 text-sm font-black leading-5 text-amber-700">
                  Esta cuenta todavía tiene {formatUSD(closeModal.pendingUSD)}{" "}
                  pendiente. Cerrarla NO registra ningún cobro.
                </p>

                <button
                  type="button"
                  disabled={isModalSaving}
                  onClick={() => {
                    const target = closeModal;
                    setCloseModal(null);
                    if (canRegisterPayments && target) {
                      openAccountPayment(target.account, target.accountOrders);
                    }
                  }}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[var(--brand-primary-dark)] disabled:opacity-50"
                >
                  <CreditCard size={15} />
                  Mejor cobrar primero
                </button>

                <button
                  type="button"
                  disabled={isModalSaving}
                  onClick={() => confirmCloseAccount("Cerrada")}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-green-700 bg-green-100 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-green-800 transition hover:bg-green-200 disabled:opacity-50"
                >
                  <CheckCircle2 size={15} />
                  Ya se cobró por fuera: cerrar igual
                </button>

                <button
                  type="button"
                  disabled={isModalSaving}
                  onClick={() => confirmCloseAccount("Cancelada")}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-red-500 bg-red-500/10 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-red-600 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  No se va a cobrar: marcar Cancelada
                </button>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                  Todo el consumo está cobrado. La cuenta pasa al historial y
                  la mesa queda libre para una cuenta nueva.
                </p>

                <button
                  type="button"
                  disabled={isModalSaving}
                  onClick={() => confirmCloseAccount("Cerrada")}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-green-700 bg-green-100 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-green-800 transition hover:bg-green-200 disabled:opacity-50"
                >
                  {isModalSaving ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  Cerrar cuenta
                </button>
              </>
            )}

            <button
              type="button"
              disabled={isModalSaving}
              onClick={() => setCloseModal(null)}
              className="mt-3 w-full rounded-full px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-ink-2)]/50 transition hover:text-[var(--brand-ink-2)]"
            >
              Volver sin cerrar
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

