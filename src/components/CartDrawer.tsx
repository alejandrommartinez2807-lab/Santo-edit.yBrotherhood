"use client";

import {
  type CSSProperties,
  type ChangeEvent,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { BRAND } from "@/lib/brand";
import {
  CreditCard,
  ImagePlus,
  ShoppingCart,
  X,
  MessageCircle,
  BadgeCheck,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  Loader2,
  Table2,
} from "lucide-react";
import { formatUSD, formatVES } from "@/utils/formatCurrency";

import {
  type CartItem,
  type OrderType,
  type CreatedOrderSummary,
  type PublicBusinessConfig,
  type QrTableNotice,
  type PublicTableAccountNotice,
  type PublicOpenAccountSummary,
} from "@/components/cartTypes";
import {
  cleanSelectionOption,
  cleanSelectionOptions,
  getSelectionSummary,
} from "@/components/cartSelection";
import {
  isComboItem,
  getItemPaymentMode,
  getCartLineId,
  getOrderTypeSalesChannel,
  getSalesChannelLabel,
  getCartItemSalesChannels,
  itemSupportsOrderType,
  uniqueCartItemNames,
} from "@/components/cartItemHelpers";
import { cleanText } from "@/components/cartUtils";
import {
  ADDRESS_HELPERS,
  LOCATIONS_STORAGE_KEY,
  PAYMENT_METHOD_OPTIONS,
  cleanCustomerNoteWithStaffConfirmation,
  cleanStaffConfirmationProductLabel,
  normalizeDeliveryZones,
  normalizeFormMoney,
  readApiResponse,
  type DeliveryZone,
} from "@/components/cartDrawerDomain";
import {
  CartLineItem,
  CartSummaryFooter,
  EmptyCartState,
  OptionPicker,
} from "@/components/cartDrawerParts";
import { enqueueOrder, newClientOrderId } from "@/lib/offlineQueue";
import PublicBranchPicker, {
  usePublicBranchSelection,
} from "@/components/PublicBranchPicker";
import {
  doesPlanAllowLocalOrders,
  doesPlanAllowDelivery,
  getActivePublicLocalTableNames,
  getRequestedLocalTableContextFromUrl,
  resolveRequestedLocalTableName,
  normalizePublicTableAccountNotice,
  normalizePublicBusinessConfig,
  readCachedPublicBusinessConfig,
  writeCachedPublicBusinessConfig,
  DEFAULT_QUICK_PLACES,
} from "@/components/publicBusinessConfig";

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  totalPrice: number;
  removeItem: (cartLineId: string) => void;
  increaseQuantity: (cartLineId: string) => void;
  decreaseQuantity: (cartLineId: string) => void;
  updateItemNote?: (cartLineId: string, note: string) => void;
  updateItemNoteEnabled?: (cartLineId: string, enabled: boolean) => void;
  exchangeRate: number;
  exchangeSource?: string;
  exchangeValueDate?: string;
  exchangeFallback?: boolean;
  exchangeManual?: boolean;
  exchangeWarning?: string;
};

function formatAccountOrderDate(value: string | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  try {
    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Caracas",
    }).format(date);
  } catch {
    return "";
  }
}

function getPublicAccountDeliveryStats(
  orders: PublicOpenAccountSummary["orders"],
) {
  return orders.reduce(
    (summary, order) => {
      if (order.status === "Cancelado") {
        summary.cancelled += 1;
      } else if (order.status === "Entregado") {
        summary.delivered += 1;
      } else if (order.status === "Listo") {
        summary.ready += 1;
      } else {
        summary.inProgress += 1;
      }

      return summary;
    },
    { delivered: 0, ready: 0, inProgress: 0, cancelled: 0 },
  );
}

function getPublicOrderDeliveryLabel(status: string) {
  if (status === "Entregado") return "Entregado";
  if (status === "Listo") return "Listo para entregar";
  if (status === "Preparando") return "En preparación";
  if (status === "Cancelado") return "Cancelado";
  return "Recibido";
}

function getPublicOrderDeliveryClass(status: string) {
  if (status === "Entregado")
    return "border-green-600 bg-green-100 text-green-800";
  if (status === "Listo")
    return "border-yellow-500 bg-[rgba(var(--brand-primary-rgb),0.12)] text-[var(--brand-ink)]";
  if (status === "Cancelado")
    return "border-zinc-300 bg-zinc-100 text-zinc-700";
  return "border-orange-300 bg-orange-50 text-orange-900";
}

function PublicOpenAccountPanel({
  account,
  title,
  compact = false,
}: {
  account: PublicOpenAccountSummary;
  title: string;
  compact?: boolean;
}) {
  const orders = Array.isArray(account.orders) ? account.orders : [];
  const deliveryStats = getPublicAccountDeliveryStats(orders);

  return (
    <div
      className={`${compact ? "mt-4" : "mt-3"} rounded-[1.25rem] border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
            <Table2 size={15} />
            {title}
          </p>
          <p className="mt-1 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/75">
            {orders.length} pedido(s) asociados · Pendiente{" "}
            {formatUSD(account.pendingUSD)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right text-[0.7rem] font-black uppercase text-[var(--brand-primary)] sm:min-w-56">
          <span className="rounded-2xl bg-[var(--brand-cream)] px-3 py-2">
            Total {formatUSD(account.totalEstimatedUSD)}
          </span>
          <span className="rounded-2xl bg-[var(--brand-cream)] px-3 py-2">
            Cobrado {formatUSD(account.totalCollectedUSD)}
          </span>
          <span className="rounded-2xl bg-green-100 px-3 py-2 text-green-800">
            Entregados {deliveryStats.delivered}
          </span>
          <span className="rounded-2xl bg-[rgba(var(--brand-primary-rgb),0.12)] px-3 py-2 text-[var(--brand-ink)]">
            Listos {deliveryStats.ready}
          </span>
        </div>
      </div>

      {orders.length > 0 ? (
        <div className="mt-3 space-y-2">
          {orders.slice(0, compact ? 4 : 8).map((order) => {
            const itemLines =
              Array.isArray(order.items) && order.items.length > 0
                ? order.items.map((item) => {
                    const details = [
                      item.selectionSummary,
                      item.note ? `Nota: ${item.note}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return `${item.quantity}x ${item.name}${details ? ` — ${details}` : ""}`;
                  })
                : order.itemsText
                  ? order.itemsText
                      .split("|")
                      .map((line) => line.trim())
                      .filter(Boolean)
                  : [];

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-cream)] px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                      {order.displayNumber || order.id}
                    </p>
                    <span
                      className={`mt-1 inline-flex rounded-full border px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.10em] ${getPublicOrderDeliveryClass(order.status)}`}
                    >
                      {getPublicOrderDeliveryLabel(order.status)}
                    </span>
                  </div>
                  <p className="text-xs font-black text-[var(--brand-ink)]">
                    {formatUSD(order.totalUSD)} · {order.paymentStatus}
                  </p>
                </div>
                {formatAccountOrderDate(order.createdAt) ? (
                  <p className="mt-1 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
                    {formatAccountOrderDate(order.createdAt)}
                  </p>
                ) : null}
                {itemLines.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/75">
                    {itemLines.slice(0, 5).map((line, index) => (
                      <li key={`${order.id}-${index}`}>• {line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                    El detalle de productos aparecerá cuando el local actualice
                    la cuenta.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-cream)] px-3 py-3 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/70">
          Todavía no hay pedidos asociados a esta cuenta.
        </p>
      )}
    </div>
  );
}

export default function CartDrawer({
  isOpen,
  onClose,
  items,
  removeItem,
  increaseQuantity,
  decreaseQuantity,
  updateItemNote,
  updateItemNoteEnabled,
  exchangeRate,
  exchangeSource,
  exchangeValueDate,
  exchangeFallback,
  exchangeManual,
  exchangeWarning,
}: CartDrawerProps) {
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [qrTableNotice, setQrTableNotice] = useState<QrTableNotice>(null);
  const [tableAccountNotice, setTableAccountNotice] =
    useState<PublicTableAccountNotice>(null);
  const [isLoadingTableAccountNotice, setIsLoadingTableAccountNotice] =
    useState(false);
  const [attachToTableOpenAccount, setAttachToTableOpenAccount] =
    useState(false);
  const [isOpeningTableAccount, setIsOpeningTableAccount] = useState(false);
  const [openTableAccountError, setOpenTableAccountError] = useState("");
  const [orderAttachmentDataUrl, setOrderAttachmentDataUrl] = useState("");
  const [orderAttachmentFileName, setOrderAttachmentFileName] = useState("");
  const [orderAttachmentMimeType, setOrderAttachmentMimeType] = useState("");
  const [orderAttachmentError, setOrderAttachmentError] = useState("");
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const [paymentStartError, setPaymentStartError] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("Comer aquí");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryReference, setDeliveryReference] = useState("");
  const [deliveryZone, setDeliveryZone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [lastCreatedOrder, setLastCreatedOrder] =
    useState<CreatedOrderSummary | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isPaymentProofFormOpen, setIsPaymentProofFormOpen] = useState(false);
  const [isSubmittingPaymentProof, setIsSubmittingPaymentProof] =
    useState(false);
  const [paymentProofMethod, setPaymentProofMethod] = useState("");
  const [paymentProofAmountUSD, setPaymentProofAmountUSD] = useState("");
  const [paymentProofAmountVES, setPaymentProofAmountVES] = useState("");
  const [paymentProofReference, setPaymentProofReference] = useState("");
  const [paymentProofNote, setPaymentProofNote] = useState("");
  const [paymentProofDataUrl, setPaymentProofDataUrl] = useState("");
  const [paymentProofFileName, setPaymentProofFileName] = useState("");
  const [paymentProofMimeType, setPaymentProofMimeType] = useState("");
  const [paymentProofError, setPaymentProofError] = useState<string | null>(
    null,
  );
  const [paymentProofSuccess, setPaymentProofSuccess] = useState<string | null>(
    null,
  );
  const [quickPlaces, setQuickPlaces] = useState(DEFAULT_QUICK_PLACES);
  const [isZonePickerOpen, setIsZonePickerOpen] = useState(false);
  const [isPaymentPickerOpen, setIsPaymentPickerOpen] = useState(false);
  // Arranca vacío: las zonas reales llegan de /api/delivery-zones. Un default
  // local mostraría zonas de otro negocio mientras carga.
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [isLoadingDeliveryZones, setIsLoadingDeliveryZones] = useState(false);
  const [deliveryZonesError, setDeliveryZonesError] = useState<string | null>(
    null,
  );
  const [publicConfig, setPublicConfig] = useState<PublicBusinessConfig>(() =>
    readCachedPublicBusinessConfig(),
  );
  // Sede elegida por el cliente (Fase 3): scopea mesas, cuentas y el pedido.
  const branchSelection = usePublicBranchSelection();
  const needsBranchSelection = branchSelection.needsSelection;

  const canRegisterOrdersInPanel = doesPlanAllowLocalOrders(
    publicConfig.membershipPlan,
  );
  const isPublicDeliveryAvailable =
    publicConfig.deliveryEnabled &&
    publicConfig.deliveryModuleEnabled &&
    doesPlanAllowDelivery(publicConfig.membershipPlan);
  const isPaymentProofPublicAvailable = publicConfig.paymentProofsEnabled;

  useEffect(() => {
    let ignore = false;

    async function loadPublicConfig() {
      try {
        const response = await fetch("/api/public/business-config", {
          cache: "no-store",
        });

        const data = await readApiResponse(response);

        if (!response.ok) {
          throw new Error(
            data.error || "No se pudo cargar la configuración pública",
          );
        }

        const cleanConfig = normalizePublicBusinessConfig(data);

        if (!ignore) {
          setPublicConfig(cleanConfig);
          writeCachedPublicBusinessConfig(cleanConfig);
        }
      } catch {
        // Si la configuración pública tarda o falla, se conserva la última configuración válida guardada en este dispositivo.
      }
    }

    loadPublicConfig();

    return () => {
      ignore = true;
    };
    // Se recarga al cambiar la sede: las mesas y la configuración pública
    // son distintas por sucursal (AuthBridge adjunta x-branch-id al fetch).
  }, [branchSelection.selectedBranchId]);

  // Al cambiar de sede, la mesa elegida deja de tener sentido: se limpia la
  // selección y los avisos de cuenta abierta de la sede anterior.
  const previousBranchIdRef = useRef(branchSelection.selectedBranchId);
  useEffect(() => {
    const previousBranchId = previousBranchIdRef.current;
    previousBranchIdRef.current = branchSelection.selectedBranchId;

    if (!previousBranchId || previousBranchId === branchSelection.selectedBranchId) {
      return;
    }

    setTableNumber((current) =>
      current === "Para llevar" || current === "Delivery" ? current : "",
    );
    setQrTableNotice(null);
    setTableAccountNotice(null);
    setAttachToTableOpenAccount(false);
  }, [branchSelection.selectedBranchId]);

  useEffect(() => {
    // Difiere los setState un tick para no hacerlos síncronos dentro del
    // efecto (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      const nextQuickPlaces = getActivePublicLocalTableNames(
        publicConfig.localTables,
      );

      setQuickPlaces(nextQuickPlaces);
    }, 0);
    return () => clearTimeout(timer);
  }, [publicConfig.localTables]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const requestedTableContext = getRequestedLocalTableContextFromUrl();
      const resolvedTable = resolveRequestedLocalTableName(
        requestedTableContext.requestedTable,
        publicConfig.localTables,
      );

      if (!requestedTableContext.requestedTable) {
        setQrTableNotice(null);
        return;
      }

      if (resolvedTable) {
        setOrderType("Comer aquí");
        setTableNumber(resolvedTable);
        setQrTableNotice({
          requestedTable: requestedTableContext.requestedTable,
          tableName: resolvedTable,
          isQrLink: requestedTableContext.isQrLink,
          status: "valid",
        });
        return;
      }

      if (publicConfig.localTables.length > 0) {
        setQrTableNotice({
          requestedTable: requestedTableContext.requestedTable,
          tableName: "",
          isQrLink: requestedTableContext.isQrLink,
          status: "invalid",
        });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [publicConfig.localTables]);

  useEffect(() => {
    const cleanTable = tableNumber.trim();

    if (orderType !== "Comer aquí" || !cleanTable) {
      const resetTimer = setTimeout(() => {
        setTableAccountNotice(null);
        setAttachToTableOpenAccount(false);
        setIsLoadingTableAccountNotice(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    let ignore = false;

    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoadingTableAccountNotice(true);
        setTableAccountNotice(null);

        const response = await fetch(
          `/api/public/table-account-status?mesa=${encodeURIComponent(cleanTable)}`,
          { cache: "no-store" },
        );
        const data = await readApiResponse(response);

        if (!response.ok || data.ok === false) {
          throw new Error(
            data.error || "No se pudo consultar la cuenta de la mesa",
          );
        }

        const notice = normalizePublicTableAccountNotice(data);

        if (!ignore) {
          setTableAccountNotice(notice);
          setAttachToTableOpenAccount(notice?.status === "open");
        }
      } catch {
        if (!ignore) {
          setTableAccountNotice(null);
          setAttachToTableOpenAccount(false);
        }
      } finally {
        if (!ignore) {
          setIsLoadingTableAccountNotice(false);
        }
      }
    }, 300);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
    // La sede en deps: la misma mesa puede tener cuenta abierta en una sede
    // y estar libre en otra.
  }, [orderType, tableNumber, branchSelection.selectedBranchId]);

  async function handleOpenTableAccount() {
    const cleanTable = tableNumber.trim();

    if (!cleanTable || isOpeningTableAccount) return;

    try {
      setIsOpeningTableAccount(true);
      setOpenTableAccountError("");

      const response = await fetch("/api/public/open-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          mesa: cleanTable,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
        }),
      });
      const data = await readApiResponse(response);

      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "No se pudo abrir la cuenta de la mesa");
      }

      // La mesa ahora tiene cuenta abierta: reflejarlo y sumar este pedido.
      setTableAccountNotice((current) =>
        current
          ? { ...current, hasOpenAccount: true, status: "open" }
          : {
              requestedTable: cleanTable,
              tableName: cleanText(data.tableName) || cleanTable,
              hasOpenAccount: true,
              openAccountsAvailable: true,
              status: "open",
            },
      );
      setAttachToTableOpenAccount(true);
    } catch (error) {
      setOpenTableAccountError(
        error instanceof Error
          ? error.message
          : "No se pudo abrir la cuenta de la mesa",
      );
    } finally {
      setIsOpeningTableAccount(false);
    }
  }

  function clearOrderAttachment() {
    setOrderAttachmentDataUrl("");
    setOrderAttachmentFileName("");
    setOrderAttachmentMimeType("");
  }

  function handleOrderAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setOrderAttachmentError("");

    if (!file) {
      clearOrderAttachment();
      return;
    }

    if (!file.type.startsWith("image/")) {
      setOrderAttachmentError("El adjunto debe ser una imagen.");
      clearOrderAttachment();
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setOrderAttachmentError("La imagen es muy pesada. Usa una más liviana.");
      clearOrderAttachment();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        setOrderAttachmentError("No se pudo leer la imagen.");
        clearOrderAttachment();
        return;
      }
      setOrderAttachmentDataUrl(result);
      setOrderAttachmentFileName(file.name || "adjunto.jpg");
      setOrderAttachmentMimeType(file.type || "image/jpeg");
    };
    reader.onerror = () => {
      setOrderAttachmentError("No se pudo leer la imagen.");
      clearOrderAttachment();
    };
    reader.readAsDataURL(file);
  }

  const requestCloseOrderModal = useEffectEvent(() => closeOrderModal());

  useEffect(() => {
    if (!canRegisterOrdersInPanel && isOrderModalOpen) {
      const timer = setTimeout(requestCloseOrderModal, 0);
      return () => clearTimeout(timer);
    }
  }, [canRegisterOrdersInPanel, isOrderModalOpen]);

  useEffect(() => {
    if (!isPublicDeliveryAvailable && orderType === "Delivery") {
      const timer = setTimeout(() => {
        setOrderType("Comer aquí");
        setTableNumber("");
        setAttachToTableOpenAccount(false);
        setDeliveryAddress("");
        setDeliveryReference("");
        setDeliveryZone("");
        setPaymentMethod("");
        setIsZonePickerOpen(false);
        setIsPaymentPickerOpen(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isPublicDeliveryAvailable, orderType]);

  useEffect(() => {
    if (publicConfig.localTables.length > 0) return;

    const timer = setTimeout(() => {
      try {
        const storedLocations = window.localStorage.getItem(
          LOCATIONS_STORAGE_KEY,
        );

        if (!storedLocations) return;

        const parsedLocations = JSON.parse(storedLocations);

        if (!Array.isArray(parsedLocations)) return;

        const cleanLocations = parsedLocations
          .map((location) => String(location || "").trim())
          .filter(Boolean);

        if (cleanLocations.length > 0) {
          setQuickPlaces(cleanLocations);
        }
      } catch {
        setQuickPlaces(DEFAULT_QUICK_PLACES);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [publicConfig.localTables.length]);

  useEffect(() => {
    if (!isOpen) return;

    if (!isPublicDeliveryAvailable) {
      const resetTimer = setTimeout(() => {
        setDeliveryZones([]);
        setDeliveryZonesError(null);
        setIsLoadingDeliveryZones(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    let ignore = false;

    async function loadDeliveryZones() {
      try {
        if (ignore) return;
        setIsLoadingDeliveryZones(true);
        setDeliveryZonesError(null);

        const response = await fetch("/api/delivery-zones", {
          cache: "no-store",
        });

        const data = await readApiResponse(response);

        if (!response.ok) {
          throw new Error(
            data.error || "No se pudieron cargar las zonas de delivery",
          );
        }

        const cleanZones = normalizeDeliveryZones(data.deliveryZones);

        if (!ignore) {
          setDeliveryZones(cleanZones);
        }
      } catch (error) {
        if (!ignore) {
          setDeliveryZones([]);
          setDeliveryZonesError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las zonas de delivery",
          );
        }
      } finally {
        if (!ignore) {
          setIsLoadingDeliveryZones(false);
        }
      }
    }

    const timer = setTimeout(loadDeliveryZones, 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [isOpen, isPublicDeliveryAvailable]);

  const hasItems = items.length > 0;

  const comboItems = items.filter(isComboItem);
  const regularItems = items.filter((item) => !isComboItem(item));

  const comboTotalPrice = comboItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  const regularTotalPrice = regularItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  const regularTotalVES = regularTotalPrice * exchangeRate;
  const productsTotalUSD = comboTotalPrice + regularTotalPrice;
  const isDeliveryOrder = orderType === "Delivery";
  const selectedDeliveryZone = deliveryZones.find(
    (zone) => zone.name === deliveryZone && zone.isActive !== false,
  );
  const deliveryZoneOptions = deliveryZones.map((zone) => ({
    label: `${zone.name} — ${formatUSD(zone.costUSD)}`,
    value: zone.name,
    helper: `Delivery ${formatUSD(zone.costUSD)}`,
  }));
  const paymentMethodOptions = PAYMENT_METHOD_OPTIONS.map((method) => ({
    label: method,
    value: method,
  }));
  const deliveryCostValue =
    isDeliveryOrder && selectedDeliveryZone ? selectedDeliveryZone.costUSD : 0;
  const totalUSD = productsTotalUSD + deliveryCostValue;

  const hasCombos = comboTotalPrice > 0;
  const hasRegularProducts = regularTotalPrice > 0;
  const unavailableItemsForOrderType = items.filter(
    (item) => !itemSupportsOrderType(item, orderType),
  );
  const hasUnavailableItemsForOrderType =
    unavailableItemsForOrderType.length > 0;
  const orderTypeChannelLabel = getSalesChannelLabel(
    getOrderTypeSalesChannel(orderType),
  );
  const unavailableItemsMessage = hasUnavailableItemsForOrderType
    ? `Hay productos del carrito que no están disponibles para ${orderTypeChannelLabel}: ${unavailableItemsForOrderType
        .map((item) => item.name)
        .join(", ")}.`
    : "";
  const staffConfirmationItems = items.filter(
    (item) => item.requiresWaiterConfirmation,
  );
  const staffConfirmationProductNames = uniqueCartItemNames(
    staffConfirmationItems,
  );
  const hasStaffConfirmationItems = staffConfirmationProductNames.length > 0;
  const staffConfirmationProductsLabel = cleanStaffConfirmationProductLabel(
    staffConfirmationProductNames,
  );
  const staffConfirmationMessage = hasStaffConfirmationItems
    ? `El personal debe confirmar ${staffConfirmationProductsLabel} antes de prepararlo o entregarlo.`
    : "";
  const hasValidQrTableNotice =
    qrTableNotice?.status === "valid" &&
    tableNumber.trim() === qrTableNotice.tableName;
  const hasInvalidQrTableNotice = qrTableNotice?.status === "invalid";
  const hasOpenAccountTableNotice = tableAccountNotice?.status === "open";
  const hasFreeTableNotice = tableAccountNotice?.status === "free";
  // Mesa reservada en su franja: se bloquea el registro, salvo que ya tenga
  // cuenta abierta (esa cuenta ES la de la reserva sentada).
  const isTableReservedNow =
    orderType === "Comer aquí" &&
    tableAccountNotice?.reservedNow === true &&
    !hasOpenAccountTableNotice;
  const canAttachToTableOpenAccount =
    orderType === "Comer aquí" && hasOpenAccountTableNotice;
  const tableOpenAccount = hasOpenAccountTableNotice
    ? tableAccountNotice?.openAccount || null
    : null;

  // Etiqueta de la tasa activa: el cliente debe saber si es la oficial del
  // BCV (automática) o una fijada por el negocio en su panel.
  const isManualRate = Boolean(exchangeManual) || exchangeSource === "Negocio";
  const sourceLabel = isManualRate
    ? "Tasa del negocio"
    : exchangeSource === "BCV"
      ? "Tasa BCV (automática)"
      : exchangeSource === "DolarApi"
        ? "Tasa oficial (respaldo)"
        : `Tasa ${exchangeSource || "BCV"}`;
  const isOfficialBcv =
    (exchangeSource === "BCV" && !exchangeFallback) || isManualRate;
  const totalVES = totalUSD * exchangeRate;

  const canRegisterLocalOrder =
    hasItems &&
    !hasUnavailableItemsForOrderType &&
    !isSubmittingOrder &&
    !needsBranchSelection &&
    (isDeliveryOrder
      ? customerName.trim().length > 0 &&
        customerPhone.trim().length > 0 &&
        deliveryAddress.trim().length > 0 &&
        deliveryReference.trim().length > 0 &&
        deliveryZone.trim().length > 0 &&
        paymentMethod.trim().length > 0
      : tableNumber.trim().length > 0 && !isTableReservedNow);
  const paymentProofReportedUSD = normalizeFormMoney(paymentProofAmountUSD);
  const paymentProofReportedVES = normalizeFormMoney(paymentProofAmountVES);
  const canSubmitPaymentProof = Boolean(
    lastCreatedOrder?.id &&
    isPaymentProofPublicAvailable &&
    paymentProofDataUrl &&
    !isSubmittingPaymentProof &&
    (paymentProofReportedUSD > 0 || paymentProofReportedVES > 0),
  );

  function appendAddressHelper(text: string) {
    setDeliveryAddress((current) => {
      const cleanCurrent = current.trimEnd();

      if (!cleanCurrent) {
        return `${text} `;
      }

      return `${cleanCurrent} ${text} `;
    });
  }

  function buildWhatsAppMessage() {
    function buildWhatsAppProductLine(item: CartItem, baseLine: string) {
      const detailLines: string[] = [];
      const selectionSummary = getSelectionSummary(item);
      const basePrice = Number(item.basePrice || item.price || 0);
      const unitOptionsPrice = Number(item.unitOptionsPrice || 0);

      if (selectionSummary) {
        detailLines.push(`Detalles: ${selectionSummary}`);
      }

      if (unitOptionsPrice > 0) {
        detailLines.push(`Base ${formatUSD(basePrice)} + extras`);
      }

      if (item.noteEnabled && item.note?.trim()) {
        detailLines.push(`Nota: ${item.note.trim()}`);
      }

      if (!detailLines.length) return baseLine;

      return `${baseLine}\n${detailLines.map((line) => `  ${line}`).join("\n")}`;
    }

    const comboLines = comboItems.map((item) => {
      const subtotal = item.price * item.quantity;

      const baseLine = `• ${item.name} x${item.quantity} — ${formatUSD(
        subtotal,
      )} / Solo divisas`;

      return buildWhatsAppProductLine(item, baseLine);
    });

    const regularLines = regularItems.map((item) => {
      const subtotal = item.price * item.quantity;
      const subtotalVES = subtotal * exchangeRate;

      const baseLine = `• ${item.name} x${item.quantity} — ${formatUSD(
        subtotal,
      )} / Bs ${formatVES(subtotalVES)}`;

      return buildWhatsAppProductLine(item, baseLine);
    });

    const sourceLine = isManualRate
      ? "Fuente: tasa fijada por el negocio"
      : exchangeSource === "BCV" && !exchangeFallback
        ? `Fuente: BCV${
            exchangeValueDate ? `\nFecha valor: ${exchangeValueDate}` : ""
          }`
        : `Fuente: ${sourceLabel}`;

    const currentBusinessName = publicConfig.businessName || BRAND.name;

    const messageParts = [
      `Hola, quiero hacer este pedido en ${currentBusinessName}:`,
      "",
      "DATOS DEL PEDIDO",
      `Tipo: ${orderType}`,
    ];

    if (customerName.trim()) {
      messageParts.push(`Cliente: ${customerName.trim()}`);
    }

    if (orderType === "Delivery") {
      messageParts.push(`Teléfono: ${customerPhone.trim() || "Por confirmar"}`);
      messageParts.push(
        `Dirección: ${deliveryAddress.trim() || "Por confirmar"}`,
      );
      messageParts.push(
        `Punto de referencia: ${deliveryReference.trim() || "Por confirmar"}`,
      );
      messageParts.push(`Zona: ${deliveryZone.trim() || "Por confirmar"}`);
      messageParts.push(
        `Método de pago: ${paymentMethod.trim() || "Por confirmar"}`,
      );
      messageParts.push(`Costo delivery: ${formatUSD(deliveryCostValue)}`);
    } else {
      messageParts.push(`Ubicación: ${tableNumber.trim() || "Por confirmar"}`);
    }

    if (customerNote.trim()) {
      messageParts.push(`Nota general: ${customerNote.trim()}`);
    }

    messageParts.push("");

    if (comboLines.length > 0) {
      messageParts.push("COMBOS — SOLO DIVISAS");
      messageParts.push(...comboLines);
      messageParts.push(`Subtotal combos: ${formatUSD(comboTotalPrice)}`);
      messageParts.push("");
    }

    if (regularLines.length > 0) {
      messageParts.push("PRODUCTOS NORMALES");
      messageParts.push(...regularLines);
      messageParts.push(
        `Subtotal productos normales: ${formatUSD(
          regularTotalPrice,
        )} / Bs ${formatVES(regularTotalVES)}`,
      );
      messageParts.push("");
    }

    if (hasStaffConfirmationItems) {
      messageParts.push("PRODUCTOS POR CONFIRMAR");
      messageParts.push(staffConfirmationMessage);
      messageParts.push("");
    }

    messageParts.push("TOTAL");
    messageParts.push(`Productos: ${formatUSD(productsTotalUSD)}`);

    if (isDeliveryOrder) {
      messageParts.push(`Delivery: ${formatUSD(deliveryCostValue)}`);
    }

    messageParts.push(`Total final en divisas: ${formatUSD(totalUSD)}`);
    messageParts.push(`Referencia en bolívares: Bs ${formatVES(totalVES)}`);

    if (hasCombos) {
      messageParts.push(`Combos solo divisas: ${formatUSD(comboTotalPrice)}`);
    }

    if (hasRegularProducts) {
      messageParts.push(
        `Productos normales: ${formatUSD(regularTotalPrice)} / Bs ${formatVES(
          regularTotalVES,
        )}`,
      );
    }

    messageParts.push("");
    messageParts.push(`Tasa usada: Bs ${formatVES(exchangeRate)}`);
    messageParts.push(sourceLine);

    return encodeURIComponent(messageParts.join("\n"));
  }

  function resetPaymentProofForm() {
    setIsPaymentProofFormOpen(false);
    setIsSubmittingPaymentProof(false);
    setPaymentProofMethod("");
    setPaymentProofAmountUSD("");
    setPaymentProofAmountVES("");
    setPaymentProofReference("");
    setPaymentProofNote("");
    setPaymentProofDataUrl("");
    setPaymentProofFileName("");
    setPaymentProofMimeType("");
    setPaymentProofError(null);
    setPaymentProofSuccess(null);
  }

  function handlePaymentProofFileChange(file: File | undefined) {
    setPaymentProofError(null);
    setPaymentProofSuccess(null);

    if (!file) {
      setPaymentProofDataUrl("");
      setPaymentProofFileName("");
      setPaymentProofMimeType("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setPaymentProofError("El comprobante debe ser una imagen.");
      setPaymentProofDataUrl("");
      setPaymentProofFileName("");
      setPaymentProofMimeType("");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPaymentProofError(
        "La imagen es muy pesada. Usa una captura más liviana.",
      );
      setPaymentProofDataUrl("");
      setPaymentProofFileName("");
      setPaymentProofMimeType("");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";

      if (!result.startsWith("data:image/")) {
        setPaymentProofError("No se pudo leer la imagen del comprobante.");
        setPaymentProofDataUrl("");
        setPaymentProofFileName("");
        setPaymentProofMimeType("");
        return;
      }

      setPaymentProofDataUrl(result);
      setPaymentProofFileName(file.name || "comprobante.jpg");
      setPaymentProofMimeType(file.type || "image/jpeg");
    };

    reader.onerror = () => {
      setPaymentProofError("No se pudo leer la imagen del comprobante.");
      setPaymentProofDataUrl("");
      setPaymentProofFileName("");
      setPaymentProofMimeType("");
    };

    reader.readAsDataURL(file);
  }

  async function handleSubmitPaymentProof() {
    if (!canSubmitPaymentProof || !lastCreatedOrder) return;

    setIsSubmittingPaymentProof(true);
    setPaymentProofError(null);
    setPaymentProofSuccess(null);

    try {
      const response = await fetch("/api/payment-proofs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: lastCreatedOrder.id,
          customerName: lastCreatedOrder.customerName,
          customerPhone: lastCreatedOrder.customerPhone,
          reportedMethod: paymentProofMethod.trim(),
          amountReportedUSD: paymentProofReportedUSD,
          amountReportedVES: paymentProofReportedVES,
          paymentReference: paymentProofReference.trim(),
          customerNote: paymentProofNote.trim(),
          dataUrl: paymentProofDataUrl,
          fileName:
            paymentProofFileName || `comprobante-${lastCreatedOrder.id}.jpg`,
          mimeType: paymentProofMimeType || "image/jpeg",
        }),
      });

      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "No se pudo enviar el comprobante");
      }

      setPaymentProofSuccess(
        "Comprobante enviado. Caja revisará la captura antes de registrar el cobro real.",
      );
      setIsPaymentProofFormOpen(false);
      setPaymentProofDataUrl("");
      setPaymentProofFileName("");
      setPaymentProofMimeType("");
      setPaymentProofReference("");
      setPaymentProofNote("");
    } catch (error) {
      setPaymentProofError(
        error instanceof Error
          ? error.message
          : "No se pudo enviar el comprobante",
      );
    } finally {
      setIsSubmittingPaymentProof(false);
    }
  }

  async function handleRegisterLocalOrder() {
    if (hasUnavailableItemsForOrderType) {
      setOrderError(unavailableItemsMessage);
      return;
    }

    if (!canRegisterLocalOrder) return;

    setIsSubmittingOrder(true);
    setOrderError(null);

    await new Promise((resolve) => requestAnimationFrame(resolve));

    let pendingPayload: unknown = null;

    try {
      const normalizedItems = items.map((item) => ({
        cartLineId: getCartLineId(item),
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        basePrice: Number(item.basePrice || item.price || 0),
        unitOptionsPrice: Number(item.unitOptionsPrice || 0),
        image: item.image,
        quantity: item.quantity,
        note: item.note || "",
        noteEnabled: Boolean(item.noteEnabled),
        paymentMode: getItemPaymentMode(item),
        productType: item.productType || "normal",
        selectedVariation: cleanSelectionOption(item.selectedVariation),
        selectedAddons: cleanSelectionOptions(item.selectedAddons),
        removedIngredients: cleanSelectionOptions(item.removedIngredients),
        selectionSummary: getSelectionSummary(item),
        requiresWaiterConfirmation: Boolean(item.requiresWaiterConfirmation),
        salesChannels: getCartItemSalesChannels(item),
        ivaRate: item.ivaRate ?? null,
      }));

      const finalCustomerNote = cleanCustomerNoteWithStaffConfirmation(
        customerNote,
        staffConfirmationProductNames,
      );

      const orderPayload = {
        // Clave de idempotencia: si el envío se reintenta (cola offline), el
        // servidor reconoce este id y no duplica el pedido. Ver 0018.
        clientOrderId: newClientOrderId(),
        customerName: customerName.trim() || "Cliente",
        customerPhone: customerPhone.trim(),
        tableNumber: isDeliveryOrder
          ? `Delivery${deliveryZone.trim() ? ` - ${deliveryZone.trim()}` : ""}`
          : tableNumber.trim(),
        orderType,
        customerNote: finalCustomerNote,
        deliveryAddress: deliveryAddress.trim(),
        deliveryReference: deliveryReference.trim(),
        deliveryZone: deliveryZone.trim(),
        paymentMethod: paymentMethod.trim(),
        deliveryCostUSD: deliveryCostValue,
        totalBeforeDeliveryUSD: productsTotalUSD,
        items: normalizedItems,
        exchangeRate,
        exchangeSource,
        exchangeValueDate,
        totalUSD,
        totalCombosUSD: comboTotalPrice,
        totalRegularUSD: regularTotalPrice,
        totalRegularVES: regularTotalVES,
        attachToOpenAccountByTable:
          canAttachToTableOpenAccount && attachToTableOpenAccount,
        attachmentDataUrl: orderAttachmentDataUrl,
        attachmentFileName: orderAttachmentFileName,
        attachmentMimeType: orderAttachmentMimeType,
      };
      pendingPayload = orderPayload;

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderPayload),
      });

      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "No se pudo registrar el pedido");
      }

      const orderId = cleanText(data.order?.id) || "Pedido registrado";
      const attachedToOpenAccount = Boolean(
        orderPayload.attachToOpenAccountByTable ||
        cleanText(data.order?.openAccountId),
      );
      const createdOrder: CreatedOrderSummary = {
        id: orderId,
        customerName:
          cleanText(data.order?.customerName) ||
          customerName.trim() ||
          "Cliente",
        customerPhone:
          cleanText(data.order?.customerPhone) || customerPhone.trim(),
        totalUSD: Number(
          data.order?.totalUSD || data.order?.totalPrice || totalUSD || 0,
        ),
        hasStaffConfirmationItems,
        staffConfirmationProductNames,
        attachedToOpenAccount,
        openAccountTable:
          cleanText(data.order?.openAccountTable) || tableNumber.trim(),
      };
      const nextTableNumberAfterSubmit =
        !isDeliveryOrder &&
        (createdOrder.attachedToOpenAccount || hasValidQrTableNotice)
          ? tableNumber.trim()
          : "";

      items.forEach((item) => {
        removeItem(getCartLineId(item));
      });

      setLastCreatedOrder(createdOrder);
      resetPaymentProofForm();
      setPaymentProofMethod(paymentMethod.trim());
      setPaymentProofAmountUSD(
        createdOrder.totalUSD > 0 ? createdOrder.totalUSD.toFixed(2) : "",
      );
      setCustomerName("");
      setCustomerPhone("");
      setTableNumber(nextTableNumberAfterSubmit);
      setDeliveryAddress("");
      setDeliveryReference("");
      setDeliveryZone("");
      setPaymentMethod("");
      setCustomerNote("");
      clearOrderAttachment();
      setOrderAttachmentError("");
      setOrderType("Comer aquí");
      setAttachToTableOpenAccount(
        Boolean(
          nextTableNumberAfterSubmit && createdOrder.attachedToOpenAccount,
        ),
      );
      setIsZonePickerOpen(false);
      setIsPaymentPickerOpen(false);
    } catch (error) {
      const isNetwork =
        (typeof navigator !== "undefined" && !navigator.onLine) ||
        error instanceof TypeError;

      if (isNetwork && pendingPayload) {
        // Sin conexión: guardamos el pedido localmente; OfflineSync lo enviará
        // al reconectar. No perdemos la venta.
        await enqueueOrder(pendingPayload);
        items.forEach((item) => removeItem(getCartLineId(item)));
        setLastCreatedOrder({
          id: "Guardado sin conexión",
          customerName: customerName.trim() || "Cliente",
          customerPhone: customerPhone.trim(),
          totalUSD,
          hasStaffConfirmationItems,
          staffConfirmationProductNames,
          offline: true,
        });
        setCustomerName("");
        setCustomerPhone("");
        setTableNumber("");
        setDeliveryAddress("");
        setDeliveryReference("");
        setDeliveryZone("");
        setPaymentMethod("");
        setCustomerNote("");
        clearOrderAttachment();
        setOrderType("Comer aquí");
      } else {
        setOrderError(
          error instanceof Error
            ? error.message
            : "No se pudo registrar el pedido",
        );
      }
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  async function handlePayOnline() {
    if (!lastCreatedOrder || isStartingPayment) return;
    setIsStartingPayment(true);
    setPaymentStartError("");
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: lastCreatedOrder.id }),
      });
      const data = await readApiResponse(res);
      if (!res.ok || !data.url) {
        throw new Error(data.error || "No se pudo iniciar el pago");
      }
      window.location.href = data.url;
    } catch (error) {
      setPaymentStartError(
        error instanceof Error ? error.message : "No se pudo iniciar el pago",
      );
      setIsStartingPayment(false);
    }
  }

  function closeOrderModal() {
    if (isSubmittingOrder || isSubmittingPaymentProof) return;

    setIsOrderModalOpen(false);
    setLastCreatedOrder(null);
    setOrderError(null);
    setIsZonePickerOpen(false);
    setIsPaymentPickerOpen(false);
    resetPaymentProofForm();
  }

  function finishCreatedOrderFlow() {
    if (isSubmittingOrder || isSubmittingPaymentProof) return;

    closeOrderModal();
    onClose();
  }

  function selectOrderType(type: OrderType) {
    if (type === "Delivery" && !isPublicDeliveryAvailable) return;

    setOrderType(type);
    setIsZonePickerOpen(false);
    setIsPaymentPickerOpen(false);

    if (type === "Para llevar") {
      setTableNumber("Para llevar");
      setAttachToTableOpenAccount(false);
    }

    if (type === "Delivery") {
      setTableNumber("Delivery");
      setAttachToTableOpenAccount(false);
    }

    if (
      type === "Comer aquí" &&
      (tableNumber === "Para llevar" || tableNumber === "Delivery")
    ) {
      setTableNumber("");
    }
  }

  const businessName = publicConfig.businessName || BRAND.name;
  const whatsappNumber =
    isDeliveryOrder && publicConfig.deliveryWhatsapp
      ? publicConfig.deliveryWhatsapp
      : publicConfig.mainWhatsapp;
  const whatsappHref =
    whatsappNumber && !hasUnavailableItemsForOrderType
      ? `https://wa.me/${whatsappNumber}?text=${buildWhatsAppMessage()}`
      : "";
  const whatsappButtonLabel = hasUnavailableItemsForOrderType
    ? "Ajusta el tipo de pedido"
    : whatsappHref
      ? publicConfig.publicCartWhatsappButtonText || "Enviar por WhatsApp"
      : "WhatsApp no configurado";
  const orderTypes: OrderType[] = isPublicDeliveryAvailable
    ? ["Comer aquí", "Para llevar", "Delivery"]
    : ["Comer aquí", "Para llevar"];
  const lastOrderAttachedToOpenAccount = Boolean(
    lastCreatedOrder?.attachedToOpenAccount,
  );
  const lastOrderCanReportPayment = Boolean(
    lastCreatedOrder && !lastOrderAttachedToOpenAccount,
  );
  const productCardStyle = {
    "--product-card-bg": publicConfig.productCardBackgroundColor || "#ffffff",
    "--product-card-text": publicConfig.productCardTextColor || "#4a0000",
    "--product-card-border": publicConfig.productCardBorderColor || "#a00000",
    "--product-card-button": publicConfig.productCardButtonColor || "#ffd23c",
  } as CSSProperties;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90]" style={productCardStyle}>
      <button
        type="button"
        aria-label="Cerrar carrito"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-hidden border-l-4 border-[var(--brand-primary)] bg-[var(--brand-cream)] text-[var(--brand-ink-3)] shadow-2xl shadow-black/40 sm:w-[92%]">
        <div className="h-1.5 shrink-0 bg-[linear-gradient(90deg,var(--brand-primary),var(--brand-accent))]" />

        <div className="relative shrink-0 overflow-hidden border-b-4 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-5 py-5 sm:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--brand-accent-rgb),0.32),transparent_42%)]" />

          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[var(--brand-primary)]">
                {businessName}
              </p>

              <div className="mt-2 flex min-w-0 items-center gap-3">
                <ShoppingCart
                  className="shrink-0 text-[var(--brand-primary)]"
                  size={32}
                />

                <h2 className="pb-1 text-[2.35rem] font-black uppercase leading-[1.02] text-[var(--brand-primary)] drop-shadow-[0_4px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-5xl">
                  {publicConfig.publicCartTitle || "Tu pedido"}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar carrito"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-black shadow-[0_5px_0_rgba(var(--brand-primary-rgb),0.18)] transition hover:scale-105"
            >
              <X size={28} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          {!hasItems ? (
            <EmptyCartState
              businessName={businessName}
              onClose={onClose}
              title={publicConfig.publicCartEmptyTitle}
              text={publicConfig.publicCartEmptyText}
              buttonText={publicConfig.publicCartEmptyButtonText}
            />
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <CartLineItem
                  key={getCartLineId(item)}
                  item={item}
                  orderType={orderType}
                  exchangeRate={exchangeRate}
                  removeItem={removeItem}
                  increaseQuantity={increaseQuantity}
                  decreaseQuantity={decreaseQuantity}
                  updateItemNote={updateItemNote}
                  updateItemNoteEnabled={updateItemNoteEnabled}
                  availabilityLabel={publicConfig.publicAvailabilityLabel}
                  divisaOnlyBadge={publicConfig.publicDivisaOnlyBadge}
                />
              ))}
            </div>
          )}

          {hasItems && hasUnavailableItemsForOrderType ? (
            <div className="mt-4 rounded-[1.25rem] border-2 border-red-500/30 bg-red-500/15 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-red-300">
                Revisa el tipo de pedido
              </p>
              <p className="mt-1 text-sm font-bold leading-6 text-red-200/85">
                {unavailableItemsMessage}
              </p>
            </div>
          ) : null}

          {hasItems && hasStaffConfirmationItems ? (
            <div className="mt-4 rounded-[1.25rem] border-2 border-[var(--brand-border)] bg-[rgba(var(--brand-primary-rgb),0.12)] px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                Confirmación del personal
              </p>
              <p className="mt-1 text-sm font-bold leading-6 text-[var(--brand-ink)]/80">
                {staffConfirmationMessage}
              </p>
            </div>
          ) : null}

          {tableOpenAccount ? (
            <PublicOpenAccountPanel
              account={tableOpenAccount}
              title={`Cuenta abierta de ${tableOpenAccount.tableNumber || tableNumber.trim()}`}
              compact
            />
          ) : null}
        </div>

        {hasItems && (
          <CartSummaryFooter
            items={items}
            publicConfig={publicConfig}
            totalUSD={totalUSD}
            hasCombos={hasCombos}
            hasRegularProducts={hasRegularProducts}
            comboTotalPrice={comboTotalPrice}
            regularTotalPrice={regularTotalPrice}
            regularTotalVES={regularTotalVES}
            totalVES={totalVES}
            isOfficialBcv={isOfficialBcv}
            sourceLabel={sourceLabel}
            exchangeValueDate={exchangeValueDate}
            exchangeRate={exchangeRate}
            exchangeWarning={exchangeWarning}
            canRegisterOrdersInPanel={canRegisterOrdersInPanel}
            onOpenOrderModal={() => setIsOrderModalOpen(true)}
            whatsappHref={whatsappHref}
            whatsappButtonLabel={whatsappButtonLabel}
          />
        )}
      </aside>

      {isOrderModalOpen && canRegisterOrdersInPanel && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/75 px-4 py-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border-4 border-[var(--brand-primary)] bg-[var(--brand-cream)] text-[var(--brand-ink-3)] shadow-2xl shadow-black/45">
            <div className="h-1.5 shrink-0 bg-[linear-gradient(90deg,var(--brand-primary),var(--brand-accent))]" />

            <div className="relative bg-[var(--brand-surface-2)] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--brand-primary)]">
                    Pedido del cliente
                  </p>

                  <h3 className="mt-2 text-3xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.75)]">
                    Identificar pedido
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={closeOrderModal}
                  disabled={isSubmittingOrder || isSubmittingPaymentProof}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-black disabled:opacity-50"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {lastCreatedOrder ? (
              <div className="space-y-5 px-6 py-7">
                <div className="text-center">
                  <CheckCircle2
                    size={58}
                    className="mx-auto text-[var(--brand-primary)]"
                    strokeWidth={2.2}
                  />

                  <p className="mt-5 text-sm font-black uppercase tracking-[0.24em] text-[var(--brand-primary)]">
                    {lastOrderAttachedToOpenAccount
                      ? "Agregado a la cuenta"
                      : "Pedido registrado"}
                  </p>

                  <h4 className="mt-2 text-3xl font-black text-[var(--brand-ink-3)]">
                    {lastOrderAttachedToOpenAccount
                      ? "Cuenta actualizada"
                      : lastCreatedOrder.hasStaffConfirmationItems
                        ? "Pendiente de confirmación"
                        : "Listo para preparar"}
                  </h4>

                  <p className="mx-auto mt-4 max-w-sm text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                    {lastOrderAttachedToOpenAccount
                      ? `Este pedido se sumó a la cuenta abierta de ${lastCreatedOrder.openAccountTable || "la mesa"}. Caja lo verá junto con el resto de consumos cuando se cierre la cuenta.`
                      : lastCreatedOrder.hasStaffConfirmationItems
                        ? `El pedido fue enviado al panel interno. El personal debe confirmar ${cleanStaffConfirmationProductLabel(lastCreatedOrder.staffConfirmationProductNames || [])} antes de prepararlo.`
                        : "El pedido fue enviado al panel interno del local."}
                  </p>

                  <p className="mt-3 text-[0.7rem] font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]/70">
                    Referencia interna: {lastCreatedOrder.id}
                  </p>
                </div>

                {lastOrderCanReportPayment &&
                  publicConfig.onlinePaymentsEnabled &&
                  lastCreatedOrder.totalUSD > 0 &&
                  !lastCreatedOrder.offline && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={handlePayOnline}
                        disabled={isStartingPayment}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-emerald-700 bg-emerald-600 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <CreditCard size={18} />
                        {isStartingPayment
                          ? "Abriendo pago…"
                          : `Pagar en línea ${formatUSD(lastCreatedOrder.totalUSD)}`}
                      </button>
                      {paymentStartError ? (
                        <p className="mt-2 text-[0.7rem] font-bold text-red-300">
                          {paymentStartError}
                        </p>
                      ) : null}
                    </div>
                  )}

                {lastOrderAttachedToOpenAccount ? (
                  <div className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3 text-left">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                      Cuenta abierta
                    </p>
                    <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                      Esto no registra ningún cobro individual. El pago se
                      maneja desde Caja cuando el personal cierre o cobre la
                      cuenta de la mesa.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3 text-left">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                      Importante
                    </p>
                    <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                      Enviar una captura solo reporta el pago para revisión.
                      Caja debe confirmar el cobro real antes de marcar el
                      pedido como pagado.
                    </p>
                  </div>
                )}

                {paymentProofSuccess && (
                  <div className="rounded-2xl border-2 border-emerald-600/35 bg-emerald-50 px-4 py-3 text-left">
                    <p className="text-sm font-black leading-6 text-emerald-800">
                      {paymentProofSuccess}
                    </p>
                  </div>
                )}

                {lastOrderCanReportPayment &&
                  isPaymentProofPublicAvailable &&
                  !paymentProofSuccess && (
                    <div className="rounded-[1.5rem] border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentProofError(null);
                          setIsPaymentProofFormOpen((current) => !current);
                        }}
                        className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3.5 text-sm font-black uppercase tracking-[0.12em] text-black shadow-[0_5px_0_rgba(var(--brand-primary-rgb),0.18)] transition active:translate-y-1 active:shadow-none"
                      >
                        <BadgeCheck size={20} />
                        Ya pagué / enviar comprobante
                      </button>

                      {isPaymentProofFormOpen && (
                        <div className="mt-4 space-y-4">
                          <div>
                            <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                              Método reportado
                            </label>
                            <select
                              value={paymentProofMethod}
                              onChange={(event) =>
                                setPaymentProofMethod(event.target.value)
                              }
                              className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
                            >
                              <option value="">Selecciona método</option>
                              {PAYMENT_METHOD_OPTIONS.map((method) => (
                                <option key={method} value={method}>
                                  {method}
                                </option>
                              ))}
                              <option value="Otro">Otro</option>
                            </select>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                                Monto divisas
                              </label>
                              <input
                                value={paymentProofAmountUSD}
                                onChange={(event) =>
                                  setPaymentProofAmountUSD(event.target.value)
                                }
                                inputMode="decimal"
                                placeholder="0.00"
                                className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                                Monto Bs
                              </label>
                              <input
                                value={paymentProofAmountVES}
                                onChange={(event) =>
                                  setPaymentProofAmountVES(event.target.value)
                                }
                                inputMode="decimal"
                                placeholder="0,00"
                                className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                              Referencia opcional
                            </label>
                            <input
                              value={paymentProofReference}
                              onChange={(event) =>
                                setPaymentProofReference(event.target.value)
                              }
                              placeholder="Número de referencia, banco o dato útil"
                              className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                              Captura del pago
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) =>
                                handlePaymentProofFileChange(
                                  event.target.files?.[0],
                                )
                              }
                              className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-sm font-bold text-[var(--brand-ink)] file:mr-4 file:rounded-full file:border-0 file:bg-[var(--brand-primary)] file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-[0.08em] file:text-white"
                            />
                            {paymentProofFileName && (
                              <p className="mt-2 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/65">
                                Archivo seleccionado: {paymentProofFileName}
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                              Nota opcional
                            </label>
                            <textarea
                              value={paymentProofNote}
                              onChange={(event) =>
                                setPaymentProofNote(event.target.value)
                              }
                              placeholder="Aclara cualquier detalle del pago"
                              className="mt-2 min-h-20 w-full resize-none rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                            />
                          </div>

                          {paymentProofError && (
                            <div className="rounded-2xl border-2 border-red-500/35 bg-red-500/15 px-4 py-3">
                              <p className="text-sm font-bold leading-6 text-red-300">
                                {paymentProofError}
                              </p>
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={!canSubmitPaymentProof}
                            onClick={handleSubmitPaymentProof}
                            className={`flex w-full items-center justify-center gap-3 rounded-full border-2 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.18)] transition active:translate-y-1 active:shadow-none ${
                              canSubmitPaymentProof
                                ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-accent)] hover:text-black"
                                : "border-[var(--brand-border)] bg-[#ddd3c4] text-[var(--brand-ink-2)]/35"
                            }`}
                          >
                            {isSubmittingPaymentProof ? (
                              <Loader2 size={21} className="animate-spin" />
                            ) : (
                              <ClipboardList size={21} />
                            )}
                            Enviar comprobante
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                {lastOrderCanReportPayment &&
                  !isPaymentProofPublicAvailable && (
                    <div className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3 text-left">
                      <p className="text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                        El pedido ya quedó registrado. Si ya pagaste, comunícate
                        con el local por el canal indicado.
                      </p>
                    </div>
                  )}

                <button
                  type="button"
                  disabled={isSubmittingPaymentProof}
                  onClick={finishCreatedOrderFlow}
                  className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-black shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.18)] transition active:translate-y-1 active:shadow-none disabled:opacity-50"
                >
                  Finalizar
                </button>
              </div>
            ) : isSubmittingOrder ? (
              <div className="px-6 py-12 text-center">
                <Loader2
                  size={58}
                  className="mx-auto animate-spin text-[var(--brand-primary)]"
                />

                <p className="mt-6 text-sm font-black uppercase tracking-[0.24em] text-[var(--brand-primary)]">
                  Enviando pedido
                </p>

                <h4 className="mt-2 text-3xl font-black uppercase leading-tight text-[var(--brand-ink-3)]">
                  Registrando en el panel
                </h4>

                <p className="mx-auto mt-4 max-w-sm text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                  Espera un momento. El pedido se está guardando para el local.
                </p>
              </div>
            ) : (
              <div className="space-y-4 px-6 py-6">
                <PublicBranchPicker
                  selection={branchSelection}
                  label="¿En qué sede estás pidiendo?"
                />

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    {isDeliveryOrder
                      ? "Nombre del cliente"
                      : "Nombre del cliente opcional"}
                  </label>

                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Ejemplo: Carlos"
                    autoComplete="name"
                    className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Tipo de pedido
                  </label>

                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {orderTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => selectOrderType(type)}
                        className={`rounded-2xl border-2 px-4 py-4 text-sm font-black uppercase transition ${
                          orderType === type
                            ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-black"
                            : "border-[var(--brand-primary)] bg-[var(--brand-surface-2)] text-[var(--brand-primary)]"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {orderType === "Comer aquí" && needsBranchSelection && (
                  <div className="rounded-2xl border-2 border-[var(--brand-border)] bg-[rgba(var(--brand-primary-rgb),0.08)] px-4 py-3">
                    <p className="inline-flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                      <Table2 size={15} />
                      Elige tu sede primero
                    </p>
                    <p className="mt-1 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/70">
                      Las mesas dependen de la sede. Selecciona arriba la sede
                      donde estás y aparecerán sus mesas.
                    </p>
                  </div>
                )}

                {orderType === "Comer aquí" && !needsBranchSelection && (
                  <div>
                    <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      {publicConfig.locationLabel} o ubicación
                    </label>

                    {hasValidQrTableNotice && (
                      <div className="mt-2 rounded-2xl border-2 border-[var(--brand-border)] bg-[rgba(var(--brand-primary-rgb),0.08)] px-4 py-3">
                        <p className="inline-flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                          <Table2 size={15} />
                          Mesa preseleccionada
                        </p>
                        <p className="mt-1 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/70">
                          Estás pidiendo para {tableNumber}. El pedido quedará
                          marcado con esta mesa para que el personal lo ubique
                          rápido.
                        </p>
                      </div>
                    )}

                    {hasInvalidQrTableNotice && (
                      <div className="mt-2 rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
                        <p className="inline-flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-amber-800">
                          <AlertTriangle size={15} />
                          Mesa no encontrada
                        </p>
                        <p className="mt-1 text-sm font-bold leading-5 text-amber-900/80">
                          Este QR ya no coincide con una mesa activa. Selecciona
                          una mesa disponible o avisa al personal antes de
                          registrar el pedido.
                        </p>
                      </div>
                    )}

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {quickPlaces.map((place) => (
                        <button
                          key={place}
                          type="button"
                          onClick={() => {
                            setTableNumber(place);
                            setOrderType("Comer aquí");
                            if (qrTableNotice?.status === "invalid") {
                              setQrTableNotice(null);
                            }
                          }}
                          className={`rounded-xl border-2 px-3 py-3 text-xs font-black uppercase transition ${
                            tableNumber === place
                              ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-black"
                              : "border-[var(--brand-primary)] bg-[var(--brand-surface-2)] text-[var(--brand-primary)]"
                          }`}
                        >
                          {place}
                        </button>
                      ))}
                    </div>

                    <input
                      value={tableNumber}
                      onChange={(event) => {
                        setTableNumber(event.target.value);
                        if (qrTableNotice?.status === "invalid") {
                          setQrTableNotice(null);
                        }
                      }}
                      placeholder="O escribe otra ubicación..."
                      className="mt-3 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                    />

                    {isLoadingTableAccountNotice && tableNumber.trim() ? (
                      <div className="mt-3 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3">
                        <p className="inline-flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                          <Loader2 size={15} className="animate-spin" />
                          Consultando mesa
                        </p>
                        <p className="mt-1 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/65">
                          Estamos preparando el pedido para esta mesa y
                          revisando si ya tiene una cuenta abierta.
                        </p>
                      </div>
                    ) : null}

                    {!isLoadingTableAccountNotice &&
                    hasOpenAccountTableNotice ? (
                      <div className="mt-3 rounded-2xl border-2 border-[var(--brand-border)] bg-[rgba(var(--brand-primary-rgb),0.08)] px-4 py-3">
                        <p className="inline-flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                          <Table2 size={15} />
                          Mesa con cuenta abierta
                        </p>
                        <p className="mt-1 text-sm font-bold leading-5 text-[var(--brand-ink-2)]/70">
                          Esta mesa ya tiene una cuenta abierta. Puedes agregar
                          este pedido a esa cuenta o registrarlo como pedido
                          separado.
                        </p>

                        {tableOpenAccount ? (
                          <PublicOpenAccountPanel
                            account={tableOpenAccount}
                            title="Lo que va en esta cuenta"
                          />
                        ) : null}

                        <button
                          type="button"
                          onClick={() =>
                            setAttachToTableOpenAccount((current) => !current)
                          }
                          className={`mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${
                            attachToTableOpenAccount
                              ? "border-[var(--brand-primary)] bg-[var(--brand-surface-2)] text-[var(--brand-ink)]"
                              : "border-[var(--brand-border)] bg-[var(--brand-cream)] text-[var(--brand-ink)]/70"
                          }`}
                        >
                          <span>
                            <span className="block text-[0.68rem] font-black uppercase tracking-[0.12em]">
                              {attachToTableOpenAccount
                                ? "Agregar a la cuenta de la mesa"
                                : "Registrar como pedido separado"}
                            </span>
                            <span className="mt-1 block text-sm font-bold leading-5">
                              {attachToTableOpenAccount
                                ? "El personal verá este pedido dentro de la cuenta abierta. Esto no registra ningún cobro."
                                : "El pedido entrará con la mesa, pero no se sumará a la cuenta abierta."}
                            </span>
                          </span>
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black ${
                              attachToTableOpenAccount
                                ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-black"
                                : "border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink)]/45"
                            }`}
                          >
                            {attachToTableOpenAccount ? "✓" : ""}
                          </span>
                        </button>
                      </div>
                    ) : null}

                    {!isLoadingTableAccountNotice && isTableReservedNow ? (
                      <div className="mt-3 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3">
                        <p className="inline-flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-red-700">
                          <Table2 size={15} />
                          Mesa reservada
                        </p>
                        <p className="mt-1 text-sm font-bold leading-5 text-red-900/75">
                          Esta mesa tiene una reserva
                          {tableAccountNotice?.reservationStart
                            ? ` de ${tableAccountNotice.reservationStart} a ${tableAccountNotice.reservationEnd}`
                            : ""}
                          . Elige otra mesa o pregunta al personal.
                        </p>
                      </div>
                    ) : null}

                    {!isLoadingTableAccountNotice && hasFreeTableNotice && !isTableReservedNow ? (
                      <div className="mt-3 rounded-2xl border-2 border-emerald-600/20 bg-emerald-50 px-4 py-3">
                        <p className="inline-flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-emerald-800">
                          <CheckCircle2 size={15} />
                          Mesa sin cuenta abierta
                        </p>
                        <p className="mt-1 text-sm font-bold leading-5 text-emerald-900/75">
                          Esta mesa no tiene cuenta abierta activa. Abre la
                          cuenta para ir sumando todo lo que pidas y pagar al
                          final, o registra este pedido por separado.
                        </p>

                        <button
                          type="button"
                          onClick={handleOpenTableAccount}
                          disabled={isOpeningTableAccount}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-700 bg-emerald-600 px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.12em] text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Table2 size={15} />
                          {isOpeningTableAccount
                            ? "Abriendo cuenta…"
                            : "Abrir cuenta de la mesa"}
                        </button>

                        {openTableAccountError ? (
                          <p className="mt-2 text-[0.7rem] font-bold text-red-700">
                            {openTableAccountError}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <p className="mt-2 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
                      Revisa que la mesa sea correcta antes de registrar el
                      pedido.
                    </p>
                  </div>
                )}

                {isDeliveryOrder && (
                  <div className="space-y-4 rounded-[1.5rem] border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4">
                    <div>
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={customerPhone}
                        onChange={(event) =>
                          setCustomerPhone(event.target.value)
                        }
                        placeholder="Ejemplo: 0412-0000000"
                        className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                        Dirección
                      </label>
                      <textarea
                        value={deliveryAddress}
                        onChange={(event) =>
                          setDeliveryAddress(event.target.value)
                        }
                        placeholder="Ejemplo: Urb. La Trigaleña, calle 3, edificio Torre Azul, apto 4B"
                        autoComplete="street-address"
                        className="mt-2 min-h-24 w-full resize-none rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                      />
                      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {ADDRESS_HELPERS.map((helper) => (
                          <button
                            key={helper}
                            type="button"
                            onClick={() => appendAddressHelper(helper)}
                            className="shrink-0 rounded-full border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-1.5 text-[0.68rem] font-black uppercase text-[var(--brand-primary)] transition hover:border-[var(--brand-primary)] hover:bg-[rgba(var(--brand-primary-rgb),0.12)]"
                          >
                            + {helper}
                          </button>
                        ))}
                      </div>

                      <p className="mt-2 text-[0.68rem] font-bold leading-4 text-[var(--brand-ink-2)]/55">
                        Usa los botones rápidos para armar la dirección y luego
                        completa los datos faltantes.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                        Punto de referencia
                      </label>
                      <input
                        value={deliveryReference}
                        onChange={(event) =>
                          setDeliveryReference(event.target.value)
                        }
                        placeholder="Ejemplo: frente a la farmacia, portón negro, al lado del colegio..."
                        className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <OptionPicker
                        label="Zona"
                        value={deliveryZone}
                        placeholder={
                          isLoadingDeliveryZones
                            ? "Cargando zonas..."
                            : "Selecciona una zona"
                        }
                        options={deliveryZoneOptions}
                        isOpen={isZonePickerOpen}
                        onToggle={() => {
                          setIsZonePickerOpen((current) => !current);
                          setIsPaymentPickerOpen(false);
                        }}
                        onSelect={(value) => {
                          setDeliveryZone(value);
                          setIsZonePickerOpen(false);
                        }}
                      />

                      <OptionPicker
                        label="Método de pago"
                        value={paymentMethod}
                        placeholder="Selecciona método"
                        options={paymentMethodOptions}
                        isOpen={isPaymentPickerOpen}
                        onToggle={() => {
                          setIsPaymentPickerOpen((current) => !current);
                          setIsZonePickerOpen(false);
                        }}
                        onSelect={(value) => {
                          setPaymentMethod(value);
                          setIsPaymentPickerOpen(false);
                        }}
                      />
                    </div>

                    {!isLoadingDeliveryZones &&
                      !deliveryZonesError &&
                      deliveryZones.length === 0 && (
                        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
                          <p className="inline-flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-amber-800">
                            <AlertTriangle size={15} />
                            Delivery no disponible por ahora
                          </p>
                          <p className="mt-1 text-sm font-bold leading-5 text-amber-900/80">
                            El local todavía no cargó sus zonas de delivery, así
                            que no se puede registrar este tipo de pedido. Elige
                            Comer aquí o Para llevar mientras tanto.
                          </p>
                        </div>
                      )}

                    {deliveryZonesError && (
                      <div className="rounded-2xl border-2 border-orange-400/35 bg-orange-100 px-4 py-3">
                        <p className="text-sm font-bold leading-5 text-orange-800">
                          {deliveryZonesError}. Revisa tu conexión e intenta
                          de nuevo en unos segundos.
                        </p>
                      </div>
                    )}

                    <div className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                        Costo de delivery
                      </p>
                      <p className="mt-1 text-2xl font-black text-[var(--brand-ink-3)]">
                        {selectedDeliveryZone
                          ? formatUSD(deliveryCostValue)
                          : "Selecciona zona"}
                      </p>
                      <p className="mt-2 text-[0.68rem] font-bold leading-4 text-[var(--brand-ink-2)]/55">
                        El cliente no puede escribir este monto. El costo se
                        calcula automáticamente según la zona.
                      </p>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Resumen de cobro
                  </p>

                  <div className="mt-3 space-y-2 text-sm font-black text-[var(--brand-ink-3)]">
                    {hasCombos && (
                      <p>
                        Combos solo divisas:{" "}
                        <span className="text-[var(--brand-primary)]">
                          {formatUSD(comboTotalPrice)}
                        </span>
                      </p>
                    )}

                    {hasRegularProducts && (
                      <p>
                        Productos normales:{" "}
                        <span className="text-[var(--brand-primary)]">
                          {formatUSD(regularTotalPrice)}
                        </span>{" "}
                        / Bs {formatVES(regularTotalVES)}
                      </p>
                    )}

                    {isDeliveryOrder && (
                      <p>
                        Delivery:{" "}
                        <span className="text-[var(--brand-primary)]">
                          {formatUSD(deliveryCostValue)}
                        </span>
                      </p>
                    )}

                    <p>
                      Total final en divisas:{" "}
                      <span className="text-[var(--brand-primary)]">
                        {formatUSD(totalUSD)}
                      </span>
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Nota general opcional
                  </label>

                  <textarea
                    value={customerNote}
                    onChange={(event) => setCustomerNote(event.target.value)}
                    placeholder="Ejemplo: cliente espera afuera, entregar rápido..."
                    className="mt-2 min-h-20 w-full resize-none rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Adjuntar imagen (opcional)
                  </label>
                  <p className="mt-1 text-xs font-bold leading-5 text-[var(--brand-ink)]/55">
                    Sube una foto o captura (comprobante, referencia). Llegará a
                    Caja y al panel de Pedidos junto a tu pedido.
                  </p>

                  {orderAttachmentDataUrl ? (
                    <div className="mt-2 flex items-center gap-3 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-3 py-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={orderAttachmentDataUrl}
                        alt="Adjunto del pedido"
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                      <span className="flex-1 truncate text-sm font-bold text-[var(--brand-ink)]">
                        {orderAttachmentFileName}
                      </span>
                      <button
                        type="button"
                        onClick={clearOrderAttachment}
                        className="rounded-full border-2 border-[var(--brand-primary)] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3 text-sm font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] transition hover:bg-[rgba(var(--brand-primary-rgb),0.08)]">
                      <ImagePlus size={18} />
                      Elegir imagen
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleOrderAttachmentChange}
                        className="hidden"
                      />
                    </label>
                  )}

                  {orderAttachmentError ? (
                    <p className="mt-2 text-[0.7rem] font-bold text-red-300">
                      {orderAttachmentError}
                    </p>
                  ) : null}
                </div>

                {hasUnavailableItemsForOrderType && (
                  <div className="rounded-2xl border-2 border-red-500/35 bg-red-500/15 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-red-300">
                      Productos no disponibles para {orderTypeChannelLabel}
                    </p>
                    <p className="mt-1 text-sm font-bold leading-6 text-red-200/85">
                      Cambia el tipo de pedido o retira esos productos del
                      carrito.
                    </p>
                    <p className="mt-1 text-sm font-black leading-6 text-red-300">
                      {unavailableItemsForOrderType
                        .map((item) => item.name)
                        .join(", ")}
                    </p>
                  </div>
                )}

                {hasStaffConfirmationItems && (
                  <div className="rounded-2xl border-2 border-[var(--brand-border)] bg-[rgba(var(--brand-primary-rgb),0.12)] px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                      Confirmación del personal
                    </p>
                    <p className="mt-1 text-sm font-bold leading-6 text-[var(--brand-ink)]/80">
                      {staffConfirmationMessage}
                    </p>
                  </div>
                )}

                {needsBranchSelection && (
                  <div className="rounded-2xl border-2 border-[var(--brand-border)] bg-[rgba(var(--brand-primary-rgb),0.12)] px-4 py-3">
                    <p className="text-sm font-bold leading-6 text-[var(--brand-ink)]/80">
                      Para registrar el pedido, primero elige la sede donde
                      estás.
                    </p>
                  </div>
                )}

                {orderError && (
                  <div className="rounded-2xl border-2 border-red-500/35 bg-red-500/15 px-4 py-3">
                    <p className="text-sm font-bold leading-6 text-red-300">
                      {orderError}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!canRegisterLocalOrder}
                  onClick={handleRegisterLocalOrder}
                  className={`mt-2 flex w-full items-center justify-center gap-3 rounded-full border-2 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.18)] transition active:translate-y-1 active:shadow-none ${
                    canRegisterLocalOrder
                      ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-black"
                      : "border-[var(--brand-border)] bg-[#ddd3c4] text-[var(--brand-ink-2)]/35"
                  }`}
                >
                  <ClipboardList size={21} />
                  Registrar pedido
                </button>

                <a
                  href={whatsappHref || "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!whatsappHref}
                  onClick={(event) => {
                    if (!whatsappHref) event.preventDefault();
                  }}
                  className={`flex w-full items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.18)] transition active:translate-y-1 active:shadow-none ${
                    whatsappHref
                      ? "bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-accent)] hover:text-black"
                      : "cursor-not-allowed bg-[#ddd3c4] text-[var(--brand-ink-2)]/45"
                  }`}
                >
                  <MessageCircle size={21} />
                  {whatsappButtonLabel}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
