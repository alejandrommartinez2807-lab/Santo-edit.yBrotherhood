"use client";

import {
  type CSSProperties,
  type ChangeEvent,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { BRAND } from "@/lib/brand";
import {
  ArrowLeft,
  CreditCard,
  ImagePlus,
  ShoppingCart,
  X,
  MessageCircle,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  Crosshair,
  LifeBuoy,
  Loader2,
  MapPin,
  Pencil,
  Table2,
} from "lucide-react";
import { formatPublicUSD as formatUSD, formatVES } from "@/utils/formatCurrency";
import {
  isElectronicPaymentMethod,
  isVesPaymentMethod,
} from "@/lib/paymentOptions";
import { usePublicCurrencySymbol } from "@/hooks/usePublicCurrencySymbol";

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
  LOCATIONS_STORAGE_KEY,
  PAYMENT_METHOD_OPTIONS,
  cleanCustomerNoteWithStaffConfirmation,
  cleanStaffConfirmationProductLabel,
  normalizeFormMoney,
  readApiResponse,
} from "@/components/cartDrawerDomain";
import {
  looksLikeMapsLink,
  parseCoordsFromText,
} from "@/lib/deliveryDistance";
import PaymentMethodDetailsList from "@/components/PaymentMethodDetailsList";
import { PublicHelpGuide } from "@/components/PublicHelpButton";
import PublicOrderPaymentSection from "@/components/PublicOrderPaymentSection";
import DeliveryMapPicker from "@/components/DeliveryMapPicker";
import DeliveryPointPreviewMap from "@/components/DeliveryPointPreviewMap";
import {
  fetchRecentOrdersLiveInfo,
  readRecentPublicOrders,
  removeRecentPublicOrders,
  saveRecentPublicOrder,
  type RecentOrderLiveInfo,
  type RecentPublicOrder,
} from "@/components/recentPublicOrders";
import {
  readPublicCustomerProfile,
  savePublicCustomerProfile,
} from "@/components/publicCustomerProfile";
import {
  CartLineItem,
  CartSummaryFooter,
  EmptyCartState,
  OptionPicker,
} from "@/components/cartDrawerParts";
import { enqueueOrder, newClientOrderId } from "@/lib/offlineQueue";
import {
  useOrderReadyAlert,
  usePublicOrderStatus,
} from "@/components/PublicOrderStatusNotifier";
import { readLastOrderSnapshot, saveLastOrderSnapshot } from "@/hooks/useCart";
import PublicBranchPicker, {
  usePublicBranchSelection,
} from "@/components/PublicBranchPicker";
import {
  PublicCheckoutSteps,
  PublicPrepayNotice,
} from "@/components/PublicCheckoutGuide";
import { readImageFileForUpload } from "@/lib/clientImage";
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
  onRestoreLastOrder?: () => number;
  exchangeRate: number;
  exchangeSource?: string;
  exchangeValueDate?: string;
  exchangeFallback?: boolean;
  exchangeManual?: boolean;
  exchangeWarning?: string;
};

// Cupones desactivados por ahora (pedido del dueño 2026-07-11): la lógica
// queda intacta; poner en true para volver a mostrar el campo en el carrito.
const SHOW_COUPON_FIELD: boolean = false;

// Etiquetas públicas de los tipos de pedido: "Para llevar" se muestra como
// "Pick up" (pedido del dueño 2026-07-12). El valor interno NO cambia: el
// servidor, el panel y los tickets siguen manejando "Para llevar".
const ORDER_TYPE_PUBLIC_LABELS: Record<OrderType, string> = {
  "Comer aquí": "Comer aquí",
  "Para llevar": "Pick up",
  Delivery: "Delivery",
};

function getOrderTypePublicLabel(type: OrderType) {
  return ORDER_TYPE_PUBLIC_LABELS[type] || type;
}


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
  onRestoreLastOrder,
  exchangeRate,
  exchangeSource,
  exchangeValueDate,
  exchangeFallback,
  exchangeManual,
  exchangeWarning,
}: CartDrawerProps) {
  usePublicCurrencySymbol();
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
  const [deliveryReference, setDeliveryReference] = useState("");
  // El campo de referencia vive oculto tras una casilla: la mayoría no lo
  // necesita (la ubicación ya es exacta) y así el formulario respira más.
  const [wantsDeliveryReference, setWantsDeliveryReference] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  // Efectivo: con cuánto va a pagar el cliente, para calcular su vuelto y
  // que caja lo tenga listo (pedido del dueño 2026-07-21).
  const [cashGivenAmount, setCashGivenAmount] = useState("");
  // Aviso GRANDE de validación: al tocar "Registrar" con datos pendientes se
  // explica qué falta y se hace scroll a esa sección (sistema a prueba de
  // apuros, pedido del dueño 2026-07-21).
  const [validationAlert, setValidationAlert] = useState<string | null>(null);
  // Modo "pago antes de registrar": captura o referencia adjuntada EN el
  // checkout (métodos electrónicos). Se reporta sola al crear el pedido.
  const [checkoutProofDataUrl, setCheckoutProofDataUrl] = useState("");
  const [checkoutProofFileName, setCheckoutProofFileName] = useState("");
  const [checkoutProofMimeType, setCheckoutProofMimeType] = useState("");
  const [checkoutProofReference, setCheckoutProofReference] = useState("");
  const [checkoutProofError, setCheckoutProofError] = useState<string | null>(null);
  // Confirmación: cuándo el pago sigue pendiente de reporte (para la
  // advertencia llamativa y la ventana emergente post-registro).
  const [lastOrderProofReported, setLastOrderProofReported] = useState(false);
  // Guía de ayuda accesible DENTRO del carrito/checkout (el botón flotante
  // queda tapado por el drawer): pedido del dueño 2026-07-22.
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  // Modo "antes": el comprobante del checkout se está reportando solo; no
  // auto-abrir el formulario manual mientras tanto (evita duplicados).
  const [lastOrderUsedCheckoutProof, setLastOrderUsedCheckoutProof] =
    useState(false);
  const [showPostRegisterPaymentModal, setShowPostRegisterPaymentModal] =
    useState(false);
  const [customerNote, setCustomerNote] = useState("");
  // El cupón vive plegado: solo un enlace discreto, para no estorbar a la
  // mayoría que no tiene código.
  const [isCouponOpen, setIsCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    percent: number;
  } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);
  const [lastCreatedOrder, setLastCreatedOrder] =
    useState<CreatedOrderSummary | null>(null);
  const [hasLastOrderSnapshot, setHasLastOrderSnapshot] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [quickPlaces, setQuickPlaces] = useState(DEFAULT_QUICK_PLACES);
  const [isPaymentPickerOpen, setIsPaymentPickerOpen] = useState(false);
  // Envío por distancia: el cliente pega su link de Google Maps y el costo
  // sale por km (cotizado en el servidor con las tarifas del negocio).
  const [isDistancePricingEnabled, setIsDistancePricingEnabled] =
    useState(false);
  const [distanceMaxKm, setDistanceMaxKm] = useState(0);
  // Rangos publicados ("hasta 10 km → $6"): dan el precio de referencia que
  // ve el cliente antes de compartir su ubicación.
  const [distanceTiers, setDistanceTiers] = useState<
    { upToKm: number; costUSD: number }[]
  >([]);
  const [customerMapsUrl, setCustomerMapsUrl] = useState("");
  // Pedidos previos guardados en este dispositivo: camino de vuelta al
  // seguimiento (y al reporte de pago) si el cliente cerró la página.
  const [recentPublicOrders, setRecentPublicOrders] = useState<
    RecentPublicOrder[]
  >([]);
  // Estado en vivo de cada pedido reciente (número visible + avance): permite
  // mostrar "En preparación" y sacar de la lista los que ya terminaron.
  const [recentOrderLive, setRecentOrderLive] = useState<
    Record<string, RecentOrderLiveInfo>
  >({});
  // Confirmación de dirección antes de registrar (estilo apps grandes):
  // mapa de solo lectura + "Ajustar" que abre el mapa interactivo.
  const [isAddressConfirmOpen, setIsAddressConfirmOpen] = useState(false);
  const [isAdjustMapOpen, setIsAdjustMapOpen] = useState(false);
  // Pago mixto: una parte en bolívares y otra en divisas, cada una con su
  // método y monto (los botones "Completar" rellenan lo que falta).
  const [mixedBsMethod, setMixedBsMethod] = useState("");
  const [mixedBsAmount, setMixedBsAmount] = useState("");
  const [mixedUsdMethod, setMixedUsdMethod] = useState("");
  const [mixedUsdAmount, setMixedUsdAmount] = useState("");
  const [distanceQuote, setDistanceQuote] = useState<{
    distanceKm: number;
    costUSD: number;
  } | null>(null);
  const [isQuotingDistance, setIsQuotingDistance] = useState(false);
  // Aviso (no error) cuando el GPS entregó una lectura poco precisa: el
  // pedido puede seguir, pero el cliente debe verificar el punto en el mapa.
  const [gpsAccuracyNotice, setGpsAccuracyNotice] = useState<string | null>(
    null,
  );
  const [distanceQuoteError, setDistanceQuoteError] = useState<string | null>(
    null,
  );
  const autoQuoteTimerRef = useRef<number | null>(null);
  const [publicConfig, setPublicConfig] = useState<PublicBusinessConfig>(() =>
    readCachedPublicBusinessConfig(),
  );
  // Sede elegida por el cliente (Fase 3): scopea mesas, cuentas y el pedido.
  const branchSelection = usePublicBranchSelection();
  const needsBranchSelection = branchSelection.needsSelection;

  // Estado en vivo del pedido recién creado: da el número visible (#07) y el
  // avance (Recibido → Preparando → Listo) para la pantalla de confirmación.
  const createdOrderTrackingId =
    lastCreatedOrder &&
    !lastCreatedOrder.offline &&
    !lastCreatedOrder.attachedToOpenAccount
      ? lastCreatedOrder.id
      : "";
  const createdOrderLive = usePublicOrderStatus(createdOrderTrackingId);
  // Vibración al pasar a "Listo" mientras la confirmación siga abierta.
  useOrderReadyAlert({
    orderId: createdOrderTrackingId,
    status: createdOrderLive.status,
    displayNumber: createdOrderLive.displayNumber,
    notifyEnabled: false,
  });

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
    // La cotización por km depende de la sede (cada una tiene su ubicación).
    setDistanceQuote(null);
    setDistanceQuoteError(null);

    // Si el cliente YA marcó su punto de entrega, se recotiza solo contra la
    // sede nueva (pedido del cliente 2026-07-21: antes quedaba sin costo y
    // había que volver a marcar la ubicación a mano).
    const savedMapsUrl = customerMapsUrl.trim();
    if (savedMapsUrl) {
      void requestDistanceQuote({ mapsUrl: savedMapsUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar de sede
  }, [branchSelection.selectedBranchId]);

  useEffect(() => {
    if (!isOpen) return;

    // ¿Hay un pedido anterior guardado para "repetir"? Se re-chequea al abrir
    // el carrito (difiere el setState un tick: react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      setHasLastOrderSnapshot(readLastOrderSnapshot().length > 0);
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen]);

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

  async function handleOrderAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setOrderAttachmentError("");

    if (!file) {
      clearOrderAttachment();
      return;
    }

    // Compresión en el navegador antes de subir (fotos de cámara pesadas y
    // HEIC de iPhone pasan a JPEG liviano). Ver lib/clientImage.
    try {
      const image = await readImageFileForUpload(file, {
        fallbackName: "adjunto",
      });
      setOrderAttachmentDataUrl(image.dataUrl);
      setOrderAttachmentFileName(image.fileName);
      setOrderAttachmentMimeType(image.mimeType);
    } catch (error) {
      clearOrderAttachment();
      setOrderAttachmentError(
        error instanceof Error ? error.message : "No se pudo leer la imagen.",
      );
    }
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
        setDeliveryReference("");
        setWantsDeliveryReference(false);
        setCustomerMapsUrl("");
        setDistanceQuote(null);
        setDistanceQuoteError(null);
        setPaymentMethod("");
        setMixedBsMethod("");
        setMixedBsAmount("");
        setMixedUsdMethod("");
        setMixedUsdAmount("");
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
        setIsDistancePricingEnabled(false);
        setDistanceMaxKm(0);
        setDistanceTiers([]);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    let ignore = false;

    async function loadDistancePricing() {
      // Si el negocio activó el envío por distancia, el carrito muestra el
      // campo para pegar el link de Maps. Si no está configurado, el pedido
      // sale igual y el costo del envío se confirma por WhatsApp.
      try {
        const response = await fetch("/api/public/delivery-quote", {
          cache: "no-store",
        });
        const data = await readApiResponse(response);

        if (!ignore && response.ok) {
          setIsDistancePricingEnabled(data.enabled === true);
          setDistanceMaxKm(Number(data.maxKm || 0));
          setDistanceTiers(
            Array.isArray(data.tiers)
              ? data.tiers
                  .map((tier: { upToKm?: unknown; costUSD?: unknown }) => ({
                    upToKm: Number(tier?.upToKm || 0),
                    costUSD: Number(tier?.costUSD || 0),
                  }))
                  .filter(
                    (tier: { upToKm: number; costUSD: number }) =>
                      Number.isFinite(tier.upToKm) &&
                      tier.upToKm > 0 &&
                      Number.isFinite(tier.costUSD) &&
                      tier.costUSD >= 0,
                  )
              : [],
          );
        }
      } catch {
        if (!ignore) {
          setIsDistancePricingEnabled(false);
          setDistanceMaxKm(0);
          setDistanceTiers([]);
        }
      }
    }

    const timer = setTimeout(() => {
      loadDistancePricing();
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
    // La sede define enabled/tiers del envío por km: al cambiarla se recargan.
  }, [isOpen, isPublicDeliveryAvailable, branchSelection.selectedBranchId]);

  // Al abrir el carrito se refrescan los pedidos recientes del dispositivo y
  // se consulta su estado: los que el local ya marcó listos/entregados (o
  // canceló) se eliminan de la lista, y los activos muestran su avance.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      const orders = readRecentPublicOrders();
      setRecentPublicOrders(orders);

      if (orders.length === 0) return;

      const { live, finishedIds } = await fetchRecentOrdersLiveInfo(orders);

      if (cancelled) return;

      setRecentOrderLive(live);

      if (finishedIds.length > 0) {
        removeRecentPublicOrders(finishedIds);
        setRecentPublicOrders(readRecentPublicOrders());
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen]);

  // Al abrir el formulario de pedido se rellenan solos el nombre y el
  // teléfono que el cliente usó la última vez (guardados en su dispositivo).
  const prefillCustomerProfile = useEffectEvent(() => {
    const profile = readPublicCustomerProfile();

    if (profile.name && !customerName.trim()) setCustomerName(profile.name);
    if (profile.phone && !customerPhone.trim()) setCustomerPhone(profile.phone);
  });

  useEffect(() => {
    if (!isOrderModalOpen) return;
    const timer = setTimeout(prefillCustomerProfile, 0);
    return () => clearTimeout(timer);
  }, [isOrderModalOpen]);

  // Al entrar al paso de Delivery se pide la ubicación de una vez (como las
  // páginas que preguntan al abrir): si el cliente ya dio el permiso antes,
  // el costo sale solo sin tocar nada; si no, le aparece la pregunta del
  // navegador. Solo un intento por apertura del formulario. Si el cliente ya
  // tiene una dirección guardada de un pedido anterior, se usa esa primero
  // (puede cambiarla con "Usar mi ubicación" o pegando otro link).
  const autoGpsAttemptedRef = useRef(false);
  const attemptAutoGpsQuote = useEffectEvent(() => {
    const profile = readPublicCustomerProfile();

    // El punto de referencia guardado también vuelve solo (y se muestra el
    // campo para que el cliente lo vea y pueda corregirlo).
    if (profile.deliveryReference && !deliveryReference.trim()) {
      setDeliveryReference(profile.deliveryReference);
      setWantsDeliveryReference(true);
    }

    if (!isDistancePricingEnabled) return;
    if (distanceQuote || customerMapsUrl.trim() || isQuotingDistance) return;

    const savedMapsUrl = profile.mapsUrl;

    if (savedMapsUrl && looksLikeMapsLink(savedMapsUrl)) {
      setCustomerMapsUrl(savedMapsUrl);
      void requestDistanceQuote({ mapsUrl: savedMapsUrl });
      return;
    }

    handleQuoteFromGps();
  });

  useEffect(() => {
    if (!isOrderModalOpen) {
      autoGpsAttemptedRef.current = false;
      return;
    }

    if (orderType !== "Delivery" || autoGpsAttemptedRef.current) return;

    autoGpsAttemptedRef.current = true;
    // Pequeña espera para que primero se vea el formulario y la pregunta del
    // navegador no caiga sobre una pantalla a medio pintar.
    const timer = setTimeout(attemptAutoGpsQuote, 350);
    return () => clearTimeout(timer);
  }, [isOrderModalOpen, orderType]);

  const hasItems = items.length > 0;

  // Cupón aplicado: se descuenta el % en el precio de cada línea. Todo lo
  // demás (totales, payload, tickets, cierres) hereda el precio ya descontado,
  // así el pedido cuadra sin tocar el esquema de dinero. basePrice y
  // unitOptionsPrice se escalan igual para mantener price = base + opciones.
  const effectiveItems = useMemo(() => {
    if (!appliedCoupon) return items;

    const factor = 1 - appliedCoupon.percent / 100;
    const discount = (value: number) =>
      Math.round((Number(value || 0) * factor + Number.EPSILON) * 100) / 100;

    return items.map((item) => ({
      ...item,
      price: discount(item.price),
      basePrice: discount(Number(item.basePrice ?? item.price)),
      unitOptionsPrice: discount(Number(item.unitOptionsPrice ?? 0)),
    }));
  }, [items, appliedCoupon]);

  const comboItems = effectiveItems.filter(isComboItem);
  const regularItems = effectiveItems.filter((item) => !isComboItem(item));

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
  // Métodos de pago que definió el dueño en Configuración (con fallback fijo).
  const availablePaymentMethods = publicConfig.publicPaymentMethods?.length
    ? publicConfig.publicPaymentMethods
    : PAYMENT_METHOD_OPTIONS;
  const paymentMethodOptions = [
    ...availablePaymentMethods.map((method) => ({
      label: method,
      value: method,
    })),
    // Pago dividido: una parte en bolívares y otra en divisas.
    {
      label: "Mixto (Bs + divisas)",
      value: "Mixto",
      helper: "Paga una parte en bolívares y otra en divisas",
    },
  ];
  // El costo del envío sale de la cotización por km. Si el negocio no tiene
  // configurado el envío por distancia, va en 0 y se confirma por WhatsApp.
  const deliveryCostValue =
    isDeliveryOrder && distanceQuote ? distanceQuote.costUSD : 0;
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

  // Vuelto para efectivo: si el método elegido es efectivo, el cliente puede
  // indicar con cuánto paga y el sistema calcula el cambio en su moneda.
  const cashMethodName =
    paymentMethod !== "Mixto" && paymentMethod.toLowerCase().includes("efectivo")
      ? paymentMethod
      : "";
  const cashIsVes =
    cashMethodName.toLowerCase().includes("bs") ||
    cashMethodName.toLowerCase().includes("bol");
  const cashGivenValue = normalizeFormMoney(cashGivenAmount);

  // Pago mixto: parte en Bs + parte en divisas. El método que viaja al
  // pedido es la composición legible de ambas partes.
  const isMixedPayment = paymentMethod === "Mixto";
  const mixedBsValue = normalizeFormMoney(mixedBsAmount);
  const mixedUsdValue = normalizeFormMoney(mixedUsdAmount);
  const isMixedPaymentComplete =
    mixedBsMethod.trim().length > 0 &&
    mixedUsdMethod.trim().length > 0 &&
    mixedBsValue > 0 &&
    mixedUsdValue > 0;
  const effectivePaymentMethod = isMixedPayment
    ? `Mixto: ${mixedBsMethod} Bs ${formatVES(mixedBsValue)} + ${mixedUsdMethod} ${formatUSD(mixedUsdValue)}`
    : paymentMethod.trim();
  // Métodos realmente elegidos (2 si es mixto): los "Datos para pagar" se
  // filtran a estos; sin selección se muestran todos para poder comparar.
  const selectedPaymentMethods = isMixedPayment
    ? [mixedBsMethod.trim(), mixedUsdMethod.trim()].filter(Boolean)
    : paymentMethod.trim() && paymentMethod !== "Mixto"
      ? [paymentMethod.trim()]
      : [];
  const allPaymentMethodDetails = publicConfig.publicPaymentMethodDetails || {};
  const checkoutPaymentMethodDetails = selectedPaymentMethods.length
    ? Object.fromEntries(
        Object.entries(allPaymentMethodDetails).filter(([method]) =>
          selectedPaymentMethods.includes(method),
        ),
      )
    : allPaymentMethodDetails;
  // Punto de entrega ya elegido (GPS, link o mapa): coordenadas para el
  // mini-mapa de la sección y la confirmación de dirección.
  const deliveryPointCoords = parseCoordsFromText(customerMapsUrl);

  // Datos del cliente por tipo de pedido:
  // - Delivery: nombre y teléfono obligatorios (más ubicación y pago).
  // - Para llevar: nombre y teléfono obligatorios (el local avisa por ahí).
  // - Comer aquí: nombre obligatorio y teléfono opcional, SALVO que el pedido
  //   se sume a una cuenta abierta (ahí ya se identificó la primera vez).
  const isAttachingToOpenAccount =
    canAttachToTableOpenAccount && attachToTableOpenAccount;
  const isTakeawayOrder = orderType === "Para llevar";
  const requiresCustomerName = isDeliveryOrder
    ? true
    : isTakeawayOrder
      ? true
      : !isAttachingToOpenAccount;
  const requiresCustomerPhone = isDeliveryOrder || isTakeawayOrder;

  // Modo "pago antes de registrar" (configurable por el dueño): con métodos
  // electrónicos, la captura o la referencia completa se adjunta EN el
  // checkout y sin ella no se puede registrar.
  const requiresProofBeforeRegister =
    publicConfig.publicPaymentBeforeRegisterEnabled &&
    isPaymentProofPublicAvailable &&
    (isDeliveryOrder || isTakeawayOrder) &&
    selectedPaymentMethods.some(isElectronicPaymentMethod);
  const checkoutProofDigits = checkoutProofReference.replace(/[^0-9]/g, "");
  const hasCheckoutProof =
    Boolean(checkoutProofDataUrl) || checkoutProofDigits.length >= 6;

  // Requisitos del pedido con DESTINO: al tocar "Registrar" con algo
  // pendiente se muestra el aviso grande y se hace scroll a esa sección.
  const missingOrderChecks = [
    {
      label: "tu nombre",
      targetId: "checkout-nombre",
      missing: requiresCustomerName && !customerName.trim(),
    },
    {
      label: "tu teléfono",
      targetId: "checkout-telefono",
      missing: requiresCustomerPhone && !customerPhone.trim(),
    },
    ...(isDeliveryOrder
      ? [
          {
            label:
              "tu ubicación (toca “Usar mi ubicación actual” o pega tu link de Maps)",
            targetId: "checkout-ubicacion",
            // La ubicación de Maps ES la dirección; el punto de referencia es
            // opcional. El método de pago siempre obligatorio en delivery.
            missing: isDistancePricingEnabled && !distanceQuote,
          },
          {
            label: "el método de pago",
            targetId: "checkout-pago",
            missing: !paymentMethod.trim(),
          },
          {
            label: "los dos montos del pago mixto",
            targetId: "checkout-pago",
            missing: isMixedPayment && !isMixedPaymentComplete,
          },
        ]
      : []),
    ...(isTakeawayOrder
      ? [
          // Pick up: el método de pago es obligatorio igual que en delivery.
          {
            label: "el método de pago",
            targetId: "checkout-pago",
            missing: !paymentMethod.trim(),
          },
          {
            label: "los dos montos del pago mixto",
            targetId: "checkout-pago",
            missing: isMixedPayment && !isMixedPaymentComplete,
          },
        ]
      : [
          {
            label: `tu ${(publicConfig.locationLabel || "mesa").toLowerCase()} o ubicación en el local`,
            targetId: "checkout-mesa",
            missing: !tableNumber.trim(),
          },
        ]),
    {
      label: "la captura o la referencia completa de tu pago",
      targetId: "checkout-comprobante",
      missing: requiresProofBeforeRegister && !hasCheckoutProof,
    },
  ].filter((check) => check.missing);

  const canRegisterLocalOrder =
    hasItems &&
    !hasUnavailableItemsForOrderType &&
    !isSubmittingOrder &&
    !needsBranchSelection &&
    missingOrderChecks.length === 0 &&
    !isTableReservedNow;
  const missingOrderFields = missingOrderChecks.map((check) => check.label);

  // El aviso grande de validación se apaga solo cuando el cliente completa
  // lo que faltaba (para no dejar un regaño viejo en pantalla).
  useEffect(() => {
    if (!validationAlert || !canRegisterLocalOrder) return;
    // Diferido un tick para no hacer setState síncrono dentro del efecto.
    const timer = setTimeout(() => setValidationAlert(null), 0);
    return () => clearTimeout(timer);
  }, [validationAlert, canRegisterLocalOrder]);

  async function requestDistanceQuote(input: {
    mapsUrl?: string;
    lat?: number;
    lng?: number;
  }) {
    try {
      setIsQuotingDistance(true);
      setDistanceQuoteError(null);
      setGpsAccuracyNotice(null);
      setDistanceQuote(null);

      const response = await fetch("/api/public/delivery-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await readApiResponse(response);

      if (!response.ok || data.ok !== true) {
        throw new Error(
          data.error ||
            "No se pudo calcular el costo del delivery con esa ubicación.",
        );
      }

      setDistanceQuote({
        distanceKm: Number(data.distanceKm || 0),
        costUSD: Number(data.costUSD || 0),
      });
    } catch (error) {
      setDistanceQuote(null);
      setDistanceQuoteError(
        error instanceof Error
          ? error.message
          : "No se pudo calcular el costo del delivery con esa ubicación.",
      );
    } finally {
      setIsQuotingDistance(false);
    }
  }

  function handleQuoteFromMapsUrl() {
    const cleanUrl = customerMapsUrl.trim();

    if (!cleanUrl) {
      setDistanceQuoteError(
        "Pega el link de Google Maps de tu punto de entrega.",
      );
      return;
    }

    void requestDistanceQuote({ mapsUrl: cleanUrl });
  }

  // Al pegar un link de Maps, el costo se calcula solo (sin botón extra),
  // como en las apps grandes. Pequeño debounce por si sigue escribiendo.
  function scheduleAutoQuote(value: string) {
    if (autoQuoteTimerRef.current) {
      window.clearTimeout(autoQuoteTimerRef.current);
      autoQuoteTimerRef.current = null;
    }

    const cleanUrl = value.trim();

    if (!looksLikeMapsLink(cleanUrl)) return;

    autoQuoteTimerRef.current = window.setTimeout(() => {
      void requestDistanceQuote({ mapsUrl: cleanUrl });
    }, 500);
  }

  function handleQuoteFromGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setDistanceQuoteError(
        "Tu navegador no permite compartir la ubicación. Pega el link de Google Maps.",
      );
      return;
    }

    // El GPS solo funciona en https: en pruebas locales (http) el navegador
    // ni siquiera deja pedir el permiso.
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setDistanceQuoteError(
        "La ubicación solo funciona en la página publicada (https). Mientras tanto, pega el link de Google Maps.",
      );
      return;
    }

    const blockedMessage =
      "Tu navegador tiene bloqueada la ubicación, por eso no aparece la pregunta. Toca el ícono a la izquierda de la dirección web (candado, ⓘ o los controles) → Permisos → Ubicación → Permitir, y vuelve a intentar. Si abriste desde WhatsApp o Instagram, usa “Abrir en el navegador”. Mientras tanto puedes pegar tu link de Google Maps aquí abajo.";

    const startGpsRequest = () => {
      setIsQuotingDistance(true);
      setDistanceQuoteError(null);
      // En iPhone/Safari el primer fix suele ser burdo: se avisa que estamos
      // afinando para que el cliente no crea que ya quedó marcado.
      setGpsAccuracyNotice(
        "Leyendo tu GPS para afinar el punto (puede tardar unos segundos)…",
      );

      // getCurrentPosition entrega el PRIMER fix disponible, que en teléfonos
      // suele ser la posición aproximada por wifi/antena (±500–2000 m) antes
      // de que el GPS real enganche: por eso a veces cotizaba con una
      // ubicación errada. Ahora observamos el GPS unos segundos y nos
      // quedamos con la lectura MÁS precisa (o cortamos apenas baja de 35 m).
      const GOOD_ACCURACY_M = 35;
      const MAX_WAIT_MS = 14_000;
      let bestPosition: GeolocationPosition | null = null;
      let finished = false;
      let watchId = 0;
      let waitTimer = 0;

      const finishWithBest = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(waitTimer);
        navigator.geolocation.clearWatch(watchId);

        if (!bestPosition) {
          setIsQuotingDistance(false);
          setDistanceQuoteError(
            "No se pudo leer tu ubicación. Pega el link de Google Maps de tu punto de entrega.",
          );
          return;
        }

        const lat = bestPosition.coords.latitude;
        const lng = bestPosition.coords.longitude;
        const accuracy = Math.round(Number(bestPosition.coords.accuracy || 0));

        // Se guarda como link para que el repartidor pueda abrirlo en Maps.
        setCustomerMapsUrl(`https://www.google.com/maps?q=${lat},${lng}`);
        void requestDistanceQuote({ lat, lng });

        // Con precisión pobre (interiores, GPS apagado, laptop) el punto
        // puede caer lejos: se avisa para que lo verifique en el mapa. Con
        // precisión media (35–150 m, típico en iPhone dentro de casa) también
        // se pide confirmar el pin, que es donde más se equivocaba.
        if (accuracy > 150) {
          setGpsAccuracyNotice(
            `Tu ubicación llegó con precisión baja (±${accuracy} m). Revisa en el mapa que el punto marcado sea tu dirección; si no coincide, tócalo y ajústalo, o pega tu link de Google Maps.`,
          );
        } else if (accuracy > GOOD_ACCURACY_M) {
          setGpsAccuracyNotice(
            `Punto marcado con precisión de ±${accuracy} m. Confirma en el mini-mapa que sea tu dirección exacta y ajústalo si hace falta.`,
          );
        } else {
          setGpsAccuracyNotice(null);
        }
      };

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (
            !bestPosition ||
            position.coords.accuracy < bestPosition.coords.accuracy
          ) {
            bestPosition = position;
          }

          if (position.coords.accuracy <= GOOD_ACCURACY_M) {
            finishWithBest();
          }
        },
        (gpsError) => {
          // Si ya hay alguna lectura, se usa esa en vez de fallar.
          if (bestPosition) {
            finishWithBest();
            return;
          }

          finished = true;
          window.clearTimeout(waitTimer);
          navigator.geolocation.clearWatch(watchId);
          setIsQuotingDistance(false);
          // 1 = permiso denegado: el navegador ya no vuelve a preguntar, así
          // que se explica cómo desbloquearlo (más el plan B del link).
          setDistanceQuoteError(
            gpsError?.code === 1
              ? blockedMessage
              : "No se pudo leer tu ubicación. Pega el link de Google Maps de tu punto de entrega.",
          );
        },
        { enableHighAccuracy: true, timeout: MAX_WAIT_MS, maximumAge: 0 },
      );

      waitTimer = window.setTimeout(finishWithBest, MAX_WAIT_MS);
    };

    // Si el permiso ya quedó bloqueado, el navegador ni muestra la pregunta
    // ("este sitio no puede solicitar el permiso"): se detecta antes para dar
    // instrucciones claras en vez de fallar en silencio.
    if (!navigator.permissions?.query) {
      startGpsRequest();
      return;
    }

    void navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (status.state === "denied") {
          setDistanceQuoteError(blockedMessage);
          return;
        }
        startGpsRequest();
      })
      .catch(() => {
        // Navegadores sin soporte de la consulta: se intenta directo.
        startGpsRequest();
      });
  }


  // "Completar" del pago mixto: rellena lo que falta de esa parte según lo
  // ya escrito en la otra, usando la tasa activa.
  function completeMixedBsAmount() {
    const remainingUSD = Math.max(
      0,
      totalUSD - normalizeFormMoney(mixedUsdAmount),
    );
    setMixedBsAmount((remainingUSD * exchangeRate).toFixed(2));
  }

  function completeMixedUsdAmount() {
    const bsPart = normalizeFormMoney(mixedBsAmount);
    const remainingUSD = Math.max(
      0,
      totalUSD - (exchangeRate > 0 ? bsPart / exchangeRate : 0),
    );
    setMixedUsdAmount(remainingUSD.toFixed(2));
  }

  // Comprobante EN el checkout (modo "pago antes de registrar"): sin captura
  // o referencia completa no se puede registrar con métodos electrónicos.
  async function handleCheckoutProofFile(file: File | undefined) {
    setCheckoutProofError(null);

    if (!file) {
      setCheckoutProofDataUrl("");
      setCheckoutProofFileName("");
      setCheckoutProofMimeType("");
      return;
    }

    try {
      const image = await readImageFileForUpload(file, {
        fallbackName: "comprobante",
      });
      setCheckoutProofDataUrl(image.dataUrl);
      setCheckoutProofFileName(image.fileName);
      setCheckoutProofMimeType(image.mimeType);
    } catch (error) {
      setCheckoutProofDataUrl("");
      setCheckoutProofFileName("");
      setCheckoutProofMimeType("");
      setCheckoutProofError(
        error instanceof Error
          ? error.message
          : "No se pudo leer la imagen del comprobante.",
      );
    }
  }

  function renderCheckoutProofSection() {
    if (!requiresProofBeforeRegister) return null;

    return (
      <div
        id="checkout-comprobante"
        className="rounded-2xl border-[3px] border-amber-500 bg-amber-50 px-4 py-4"
      >
        <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-amber-800">
          <AlertTriangle size={17} className="shrink-0" />
          Falta tu comprobante
        </p>
        <p className="mt-1.5 text-[0.85rem] font-black leading-5 text-amber-900">
          Cancela (paga) con los datos de arriba y adjunta AQUÍ la captura o
          escribe la referencia completa. Sin eso no se puede registrar el
          pedido (así lo configuró el negocio).
        </p>

        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-500/70 bg-white px-4 py-4 text-sm font-bold text-amber-900/80 transition hover:border-amber-600">
          <ImagePlus size={17} />
          {checkoutProofFileName || "Toca para adjuntar la captura"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) =>
              void handleCheckoutProofFile(event.target.files?.[0])
            }
          />
        </label>

        <input
          value={checkoutProofReference}
          onChange={(event) => setCheckoutProofReference(event.target.value)}
          inputMode="numeric"
          placeholder="O escribe la referencia completa (todos los dígitos)"
          className="mt-2 w-full rounded-2xl border-2 border-amber-500/50 bg-white px-4 py-3 text-sm font-bold text-amber-950 outline-none placeholder:text-amber-900/40 focus:border-amber-600"
        />

        {checkoutProofError ? (
          <p className="mt-2 text-[0.75rem] font-bold leading-4 text-red-600">
            {checkoutProofError}
          </p>
        ) : null}

        {hasCheckoutProof ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-green-600/15 px-3 py-1.5 text-[0.7rem] font-black uppercase tracking-[0.08em] text-green-700">
            <CheckCircle2 size={14} />
            Listo: ya puedes registrar tu pedido
          </p>
        ) : null}
      </div>
    );
  }

  // Vuelto: pagando en efectivo, el cliente indica con cuánto paga y ve su
  // cambio al momento; caja recibe la nota con el vuelto listo. Se usa tanto
  // en Pick up (sección compartida) como en el formulario de Delivery.
  function renderCashChangeSection() {
    if (!cashMethodName) return null;

    // Botones rápidos de billete (nada que escribir). En divisas se muestran
    // SIEMPRE los 5 billetes 5/10/20/50/100 (pedido del dueño 2026-07-22), aunque
    // alguno no cubra el total (abajo se avisa si falta). En Bs se acotan a los
    // que cubren el total para no llenar la pantalla de opciones.
    const cashDue = cashIsVes ? totalVES : totalUSD;
    const quickBills = cashIsVes
      ? [100, 200, 500, 1000, 2000, 5000, 10000, 20000]
          .filter((bill) => bill >= cashDue)
          .slice(0, 4)
      : [5, 10, 20, 50, 100];

    return (
      <div className="rounded-2xl border-2 border-[var(--brand-primary)]/40 bg-[var(--brand-cream)] px-4 py-4">
        <p className="text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
          ¿Con cuánto vas a pagar?
        </p>
        <p className="mt-1 text-[0.72rem] font-bold leading-4 text-[var(--brand-ink-2)]/70">
          Toca el billete con el que vas a pagar (o escribe el monto abajo) y
          tendremos tu vuelto listo. Total a pagar:{" "}
          <span className="font-black text-[var(--brand-ink-3)]">
            {cashIsVes ? `Bs ${formatVES(totalVES)}` : formatUSD(totalUSD)}
            {cashIsVes ? ` (≈ ${formatUSD(totalUSD)})` : ""}
          </span>
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          {quickBills.map((bill) => (
            <button
              key={bill}
              type="button"
              onClick={() => setCashGivenAmount(String(bill))}
              className={`rounded-full border-2 px-3.5 py-2 text-[0.68rem] font-black uppercase tracking-[0.06em] transition active:scale-95 ${
                normalizeFormMoney(cashGivenAmount) === bill
                  ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-black"
                  : "border-[var(--brand-primary)]/40 bg-white text-[var(--brand-ink)]"
              }`}
            >
              {cashIsVes ? `Bs ${formatVES(bill)}` : formatUSD(bill)}
            </button>
          ))}
        </div>

        <input
          inputMode="decimal"
          value={cashGivenAmount}
          onChange={(event) => setCashGivenAmount(event.target.value)}
          placeholder={
            cashIsVes ? "O escribe otro monto en Bs" : "O escribe otro monto en $"
          }
          className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-primary)]/45 bg-white px-4 py-3 text-sm font-bold text-[var(--brand-ink-3)] outline-none placeholder:text-[var(--brand-ink-3)]/45 focus:border-[var(--brand-primary)]"
        />
        {(() => {
          if (cashGivenValue <= 0) return null;
          const cashDue = cashIsVes ? totalVES : totalUSD;
          const change = Math.round((cashGivenValue - cashDue) * 100) / 100;

          if (change < 0) {
            return (
              <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-[0.7rem] font-bold leading-4 text-red-500">
                Ese monto no cubre el total: faltan{" "}
                {cashIsVes
                  ? `Bs ${formatVES(Math.abs(change))}`
                  : formatUSD(Math.abs(change))}
                .
              </p>
            );
          }

          return (
            <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-[0.7rem] font-bold leading-4 text-[var(--brand-ink-2)]/75">
              {change > 0
                ? `Tu vuelto será ${cashIsVes ? `Bs ${formatVES(change)}` : formatUSD(change)}.`
                : "Pago exacto: sin vuelto."}
            </p>
          );
        })()}
      </div>
    );
  }

  // Pago mixto paso a paso ("para tontos", pedido del dueño 2026-07-22):
  // Paso 1 = cuánto en bolívares, Paso 2 = cuánto en divisas, con el total
  // siempre a la vista y "Completar lo que falta" bien visible. El helper de
  // abajo dice en cristiano qué falta. Compartido por Delivery y Pick up.
  function renderMixedPaymentSection() {
    if (!isMixedPayment) return null;

    const rate = Number(exchangeRate || 0);
    const coveredUSD = mixedUsdValue + (rate > 0 ? mixedBsValue / rate : 0);
    const missingUSD = Math.round((totalUSD - coveredUSD) * 100) / 100;
    const isOver = missingUSD < -0.01;
    const isExact = Math.abs(missingUSD) <= 0.01;

    return (
      <div className="rounded-2xl border-2 border-[var(--brand-primary)]/50 bg-[var(--brand-cream)] px-4 py-4">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          Pago mixto: parte en Bs y parte en $
        </p>
        <div className="mt-2 rounded-2xl border-2 border-[var(--brand-primary)]/30 bg-white px-3 py-2.5 text-center">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[var(--brand-ink-2)]/55">
            Total a repartir
          </p>
          <p className="text-lg font-black leading-none text-[var(--brand-ink-3)]">
            {formatUSD(totalUSD)}{" "}
            <span className="text-[var(--brand-ink-2)]/55">≈</span> Bs{" "}
            {formatVES(totalVES)}
          </p>
        </div>

        <div className="mt-4">
          <span className="inline-flex rounded-full bg-[var(--brand-primary)] px-2.5 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.12em] text-black">
            Paso 1
          </span>
          <label className="mt-1.5 block text-[0.78rem] font-black uppercase tracking-[0.08em] text-[var(--brand-ink-3)]">
            ¿Cuánto pagas en bolívares?
          </label>
          <select
            value={mixedBsMethod}
            onChange={(event) => setMixedBsMethod(event.target.value)}
            className="mt-1.5 w-full rounded-2xl border-2 border-[var(--brand-primary)]/45 bg-white px-4 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
          >
            <option value="">Método para los bolívares…</option>
            {availablePaymentMethods.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
          <div className="mt-2 flex gap-2">
            <input
              inputMode="decimal"
              value={mixedBsAmount}
              onChange={(event) => setMixedBsAmount(event.target.value)}
              placeholder="Monto en Bs"
              className="min-w-0 flex-1 rounded-2xl border-2 border-[var(--brand-primary)]/45 bg-white px-4 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
            />
            <button
              type="button"
              onClick={completeMixedBsAmount}
              className="shrink-0 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-3.5 py-2 text-[0.64rem] font-black uppercase tracking-[0.08em] text-black transition active:scale-95"
            >
              Completar lo que falta
            </button>
          </div>
        </div>

        <div className="mt-4">
          <span className="inline-flex rounded-full bg-[var(--brand-primary)] px-2.5 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.12em] text-black">
            Paso 2
          </span>
          <label className="mt-1.5 block text-[0.78rem] font-black uppercase tracking-[0.08em] text-[var(--brand-ink-3)]">
            ¿Cuánto pagas en divisas?
          </label>
          <select
            value={mixedUsdMethod}
            onChange={(event) => setMixedUsdMethod(event.target.value)}
            className="mt-1.5 w-full rounded-2xl border-2 border-[var(--brand-primary)]/45 bg-white px-4 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
          >
            <option value="">Método para las divisas…</option>
            {availablePaymentMethods.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
          <div className="mt-2 flex gap-2">
            <input
              inputMode="decimal"
              value={mixedUsdAmount}
              onChange={(event) => setMixedUsdAmount(event.target.value)}
              placeholder="Monto en $"
              className="min-w-0 flex-1 rounded-2xl border-2 border-[var(--brand-primary)]/45 bg-white px-4 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
            />
            <button
              type="button"
              onClick={completeMixedUsdAmount}
              className="shrink-0 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-3.5 py-2 text-[0.64rem] font-black uppercase tracking-[0.08em] text-black transition active:scale-95"
            >
              Completar lo que falta
            </button>
          </div>
        </div>

        {/* Helper "en cristiano": dice si falta, sobra o está completo. */}
        {isExact ? (
          <p className="mt-3 rounded-xl border-2 border-green-600 bg-green-600/10 px-3 py-2 text-[0.75rem] font-black leading-4 text-green-700">
            ¡Listo! Cubres el total: Bs {formatVES(mixedBsValue)} con{" "}
            {mixedBsMethod || "…"} y {formatUSD(mixedUsdValue)} con{" "}
            {mixedUsdMethod || "…"}.
          </p>
        ) : isOver ? (
          <p className="mt-3 rounded-xl border-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-[0.75rem] font-black leading-4 text-amber-700">
            Te pasaste del total por {formatUSD(Math.abs(missingUSD))}. Baja uno
            de los dos montos.
          </p>
        ) : (
          <p className="mt-3 rounded-xl border-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-[0.75rem] font-black leading-4 text-amber-700">
            Todavía falta {formatUSD(missingUSD)}
            {rate > 0 ? ` (Bs ${formatVES(missingUSD * rate)})` : ""}. Escribe el
            otro monto o toca «Completar lo que falta».
          </p>
        )}
      </div>
    );
  }

  // Sección de pago del checkout, compartida por Delivery y Pick up: método de
  // pago (obligatorio), pago mixto con botones "Completar" y los datos para
  // pagar (pago móvil, Zelle…) de los métodos elegidos. Así Pick up pide el
  // método igual que Delivery y el reporte de pago luego lo pre-carga.
  function renderCheckoutPaymentSection() {
    return (
      <>
        <div id="checkout-pago">
          <OptionPicker
            label={
              <>
                Método de pago{" "}
                <span className="font-black text-red-400">* obligatorio</span>
              </>
            }
            value={paymentMethod}
            placeholder="Selecciona método"
            options={paymentMethodOptions}
            isOpen={isPaymentPickerOpen}
            onToggle={() => {
              setIsPaymentPickerOpen((current) => !current);
            }}
            onSelect={(value) => {
              setPaymentMethod(value);
              setIsPaymentPickerOpen(false);
            }}
          />
        </div>

        {renderCashChangeSection()}

        {renderMixedPaymentSection()}

        {Object.keys(checkoutPaymentMethodDetails).length > 0 && (
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
              Datos para pagar
              {selectedPaymentMethods.length > 0 && (
                <span className="text-[var(--brand-ink-2)]/45">
                  {" "}
                  ({selectedPaymentMethods.join(" + ")})
                </span>
              )}
            </p>
            <div className="mt-2">
              <PaymentMethodDetailsList details={checkoutPaymentMethodDetails} />
            </div>
          </div>
        )}

        {renderCheckoutProofSection()}
      </>
    );
  }

  // Ajustar el marcador desde la vista previa o la confirmación: reabre el
  // mapa interactivo y re-cotiza con el punto nuevo.
  function handleAdjustMapConfirm(coords: { lat: number; lng: number }) {
    setIsAdjustMapOpen(false);

    const lat = Number(coords.lat.toFixed(6));
    const lng = Number(coords.lng.toFixed(6));

    setCustomerMapsUrl(`https://www.google.com/maps?q=${lat},${lng}`);
    void requestDistanceQuote({ lat, lng });
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
      // La ubicación es el link de Maps (línea de abajo); el punto de
      // referencia solo se agrega si el cliente escribió algo.
      if (deliveryReference.trim()) {
        messageParts.push(`Punto de referencia: ${deliveryReference.trim()}`);
      }
      if (customerMapsUrl.trim()) {
        messageParts.push(`Ubicación (Maps): ${customerMapsUrl.trim()}`);
      }
      if (distanceQuote) {
        messageParts.push(
          `Distancia: ~${distanceQuote.distanceKm.toFixed(1)} km`,
        );
      }
      messageParts.push(
        `Método de pago: ${effectivePaymentMethod || "Por confirmar"}`,
      );
      messageParts.push(
        `Costo delivery: ${distanceQuote ? formatUSD(deliveryCostValue) : "Por confirmar"}`,
      );
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

  // El reporte de pago de la confirmación vive en PublicOrderPaymentSection
  // (el mismo formulario que la página de seguimiento /pedido/[id]).

  async function handleApplyCoupon() {
    const code = couponInput.trim();

    if (!code || isCheckingCoupon) return;

    setIsCheckingCoupon(true);
    setCouponError("");

    try {
      const response = await fetch("/api/public/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await readApiResponse(response);

      if (!response.ok || !data.ok) {
        setAppliedCoupon(null);
        setCouponError(cleanText(data.error) || "Cupón no válido");
        return;
      }

      setAppliedCoupon({
        code: cleanText(data.code) || code.toUpperCase(),
        percent: Math.min(99, Math.max(1, Math.round(Number(data.percent) || 0))),
      });
      setCouponInput("");
    } catch {
      setCouponError("No se pudo validar el cupón. Revisa tu conexión.");
    } finally {
      setIsCheckingCoupon(false);
    }
  }

  // Modo "pago antes de registrar": el comprobante adjuntado en el checkout
  // se reporta solo al crear el pedido (best-effort: si falla, la
  // confirmación deja el reporte manual a un toque).
  async function submitCheckoutProofForOrder(orderId: string) {
    try {
      const singleMethod =
        selectedPaymentMethods.length === 1 ? selectedPaymentMethods[0] : "";
      const singleIsVes = singleMethod ? isVesPaymentMethod(singleMethod) : false;
      // Pago mixto: el comprobante reporta SOLO las patas electrónicas (la
      // parte en efectivo se entrega al retirar/recibir; reportarla haría que
      // caja marque cobrado el total con un clic sin haber recibido el cash).
      const mixedUsdIsElectronic =
        isMixedPayment && isElectronicPaymentMethod(mixedUsdMethod);
      const mixedBsIsElectronic =
        isMixedPayment && isElectronicPaymentMethod(mixedBsMethod);
      const amountReportedUSD = isMixedPayment
        ? mixedUsdIsElectronic
          ? mixedUsdValue
          : 0
        : singleIsVes
          ? 0
          : totalUSD;
      const amountReportedVES = isMixedPayment
        ? mixedBsIsElectronic
          ? mixedBsValue
          : 0
        : singleIsVes
          ? Math.round(totalVES * 100) / 100
          : 0;
      const mixedCashPart = isMixedPayment
        ? [
            !mixedUsdIsElectronic && mixedUsdValue > 0
              ? `${mixedUsdMethod || "Efectivo"} ${formatUSD(mixedUsdValue)} se paga al entregar`
              : "",
            !mixedBsIsElectronic && mixedBsValue > 0
              ? `${mixedBsMethod || "Efectivo"} Bs ${formatVES(mixedBsValue)} se paga al entregar`
              : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : "";
      const reportedMethod = isMixedPayment
        ? `${effectivePaymentMethod}${mixedCashPart ? ` · ${mixedCashPart}` : ""}`
        : singleMethod
          ? `${singleMethod} (${singleIsVes ? `Bs ${formatVES(amountReportedVES)}` : formatUSD(amountReportedUSD)})`
          : effectivePaymentMethod;

      const response = await fetch("/api/payment-proofs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          reportedMethod,
          amountReportedUSD,
          amountReportedVES,
          paymentReference: checkoutProofReference.trim(),
          customerNote: "Comprobante adjuntado al registrar el pedido",
          dataUrl: checkoutProofDataUrl,
          fileName: checkoutProofFileName,
          mimeType: checkoutProofMimeType,
          confirmDuplicate: false,
        }),
      });

      if (response.ok) {
        setLastOrderProofReported(true);
      } else {
        // Si el envío automático falla, la confirmación muestra el flujo de
        // reporte manual (advertencia grande + formulario abierto).
        setLastOrderUsedCheckoutProof(false);
        setShowPostRegisterPaymentModal(true);
      }
    } catch {
      setLastOrderUsedCheckoutProof(false);
      setShowPostRegisterPaymentModal(true);
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

    // Deja pintar la pantalla de "enviando" antes del fetch. Con la página en
    // segundo plano requestAnimationFrame nunca dispara, así que el setTimeout
    // garantiza que el pedido salga igual (gana el primero que resuelva).
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
      setTimeout(resolve, 150);
    });

    let pendingPayload: unknown = null;

    try {
      const normalizedItems = effectiveItems.map((item) => ({
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

      // El cupón queda registrado en la nota: caja ve por qué los precios
      // vienen rebajados (los montos del pedido ya llegan con el descuento).
      const couponNote = appliedCoupon
        ? `Cupón ${appliedCoupon.code} aplicado (-${appliedCoupon.percent}%)`
        : "";
      // Efectivo con vuelto: caja ve con cuánto paga el cliente y el cambio
      // que debe tener listo.
      const cashDueForNote = cashIsVes ? totalVES : totalUSD;
      const cashChangeForNote =
        Math.round((cashGivenValue - cashDueForNote) * 100) / 100;
      const cashNote =
        cashMethodName && cashGivenValue > 0
          ? `Paga con ${
              cashIsVes ? `Bs ${formatVES(cashGivenValue)}` : formatUSD(cashGivenValue)
            }${
              cashChangeForNote > 0
                ? ` (vuelto: ${
                    cashIsVes
                      ? `Bs ${formatVES(cashChangeForNote)}`
                      : formatUSD(cashChangeForNote)
                  })`
                : " (pago exacto)"
            }`
          : "";
      const noteWithCoupon = [customerNote.trim(), cashNote, couponNote]
        .filter(Boolean)
        .join(" | ");
      const finalCustomerNote = cleanCustomerNoteWithStaffConfirmation(
        noteWithCoupon,
        staffConfirmationProductNames,
      );

      // El link de Maps y la distancia viajan dentro de la dirección: el
      // repartidor lo abre directo sin tocar el esquema. Ya no hay dirección
      // escrita; el punto de referencia viaja aparte como referencia.
      const deliveryAddressWithLocation =
        isDeliveryOrder && distanceQuote && customerMapsUrl.trim()
          ? `Ubicación (Maps): ${customerMapsUrl.trim()} · ~${distanceQuote.distanceKm.toFixed(1)} km`
          : "";
      const deliveryZoneLabel = distanceQuote
        ? `~${distanceQuote.distanceKm.toFixed(1)} km`
        : "";

      const orderPayload = {
        // Clave de idempotencia: si el envío se reintenta (cola offline), el
        // servidor reconoce este id y no duplica el pedido. Ver 0018.
        clientOrderId: newClientOrderId(),
        customerName: customerName.trim() || "Cliente",
        // El teléfono viaja en todos los tipos: el servidor ya no lo usa como
        // señal de delivery cuando el tipo llega explícito.
        customerPhone: customerPhone.trim(),
        tableNumber: isDeliveryOrder
          ? `Delivery${deliveryZoneLabel ? ` - ${deliveryZoneLabel}` : ""}`
          : tableNumber.trim(),
        orderType,
        customerNote: finalCustomerNote,
        deliveryAddress: deliveryAddressWithLocation,
        deliveryReference: deliveryReference.trim(),
        deliveryZone: deliveryZoneLabel,
        // El servidor re-cotiza el envío con esta ubicación (el precio nunca
        // viaja del cliente): mismo link que ya se cotizó en el carrito.
        deliveryMapsUrl: customerMapsUrl.trim(),
        paymentMethod: effectivePaymentMethod,
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
        orderType,
        totalUSD: Number(
          data.order?.totalUSD || data.order?.totalPrice || totalUSD || 0,
        ),
        hasStaffConfirmationItems,
        staffConfirmationProductNames,
        attachedToOpenAccount,
        openAccountTable:
          cleanText(data.order?.openAccountTable) || tableNumber.trim(),
        paymentMethods: selectedPaymentMethods,
      };
      const nextTableNumberAfterSubmit =
        !isDeliveryOrder &&
        (createdOrder.attachedToOpenAccount || hasValidQrTableNotice)
          ? tableNumber.trim()
          : "";

      saveLastOrderSnapshot(items);
      setHasLastOrderSnapshot(true);
      items.forEach((item) => {
        removeItem(getCartLineId(item));
      });

      // Se guarda en el dispositivo del cliente: si cierra la página puede
      // volver al seguimiento y reportar su pago desde "Pedidos recientes".
      saveRecentPublicOrder({
        id: orderId,
        totalUSD: createdOrder.totalUSD,
        label: `${getOrderTypePublicLabel(orderType)} · ${createdOrder.customerName}`,
        paymentMethods: selectedPaymentMethods,
      });
      setRecentPublicOrders(readRecentPublicOrders());

      // Nombre, teléfono y ubicación quedan guardados en este dispositivo
      // para rellenarse solos en el próximo pedido.
      savePublicCustomerProfile({
        name: customerName.trim(),
        phone: customerPhone.trim(),
        mapsUrl: isDeliveryOrder ? customerMapsUrl.trim() : "",
        deliveryReference: isDeliveryOrder ? deliveryReference.trim() : "",
      });

      // Flujo de pago tras el registro:
      // - Modo "antes": el comprobante adjuntado en el checkout se reporta
      //   solo (el cliente no repite nada).
      // - Modo normal: si el pago queda pendiente, la confirmación abre con
      //   la advertencia grande + ventana emergente recordándolo.
      const orderNeedsPrepayReport =
        !attachedToOpenAccount &&
        (orderType === "Para llevar" || orderType === "Delivery") &&
        publicConfig.publicPrepayNoticeEnabled &&
        isPaymentProofPublicAvailable;

      setLastOrderProofReported(false);
      setLastOrderUsedCheckoutProof(requiresProofBeforeRegister && hasCheckoutProof);
      if (requiresProofBeforeRegister && hasCheckoutProof) {
        void submitCheckoutProofForOrder(orderId);
      } else if (orderNeedsPrepayReport) {
        setShowPostRegisterPaymentModal(true);
      }

      setLastCreatedOrder(createdOrder);
      setCustomerName("");
      setCustomerPhone("");
      setCashGivenAmount("");
      setTableNumber(nextTableNumberAfterSubmit);
      setDeliveryReference("");
      setWantsDeliveryReference(false);
      setCustomerMapsUrl("");
      setDistanceQuote(null);
      setDistanceQuoteError(null);
      setPaymentMethod("");
      setMixedBsMethod("");
      setMixedBsAmount("");
      setMixedUsdMethod("");
      setMixedUsdAmount("");
      setCheckoutProofDataUrl("");
      setCheckoutProofFileName("");
      setCheckoutProofMimeType("");
      setCheckoutProofReference("");
      setCheckoutProofError(null);
      setCustomerNote("");
      setCouponInput("");
      setAppliedCoupon(null);
      setCouponError("");
      clearOrderAttachment();
      setOrderAttachmentError("");
      setOrderType("Comer aquí");
      setAttachToTableOpenAccount(
        Boolean(
          nextTableNumberAfterSubmit && createdOrder.attachedToOpenAccount,
        ),
      );
      setIsPaymentPickerOpen(false);
    } catch (error) {
      const isNetwork =
        (typeof navigator !== "undefined" && !navigator.onLine) ||
        error instanceof TypeError;

      if (isNetwork && pendingPayload) {
        // Sin conexión: guardamos el pedido localmente; OfflineSync lo enviará
        // al reconectar. No perdemos la venta.
        await enqueueOrder(pendingPayload);
        savePublicCustomerProfile({
          name: customerName.trim(),
          phone: customerPhone.trim(),
          mapsUrl: isDeliveryOrder ? customerMapsUrl.trim() : "",
          deliveryReference: isDeliveryOrder ? deliveryReference.trim() : "",
        });
        saveLastOrderSnapshot(items);
        setHasLastOrderSnapshot(true);
        items.forEach((item) => removeItem(getCartLineId(item)));
        setLastCreatedOrder({
          id: "Guardado sin conexión",
          customerName: customerName.trim() || "Cliente",
          customerPhone: customerPhone.trim(),
          orderType,
          totalUSD,
          hasStaffConfirmationItems,
          staffConfirmationProductNames,
          offline: true,
        });
        setCustomerName("");
        setCustomerPhone("");
        setTableNumber("");
        setDeliveryReference("");
        setWantsDeliveryReference(false);
        setCustomerMapsUrl("");
        setDistanceQuote(null);
        setDistanceQuoteError(null);
        setPaymentMethod("");
        setMixedBsMethod("");
        setMixedBsAmount("");
        setMixedUsdMethod("");
        setMixedUsdAmount("");
        setCustomerNote("");
        setCouponInput("");
        setAppliedCoupon(null);
        setCouponError("");
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
    if (isSubmittingOrder) return;

    setIsOrderModalOpen(false);
    setLastCreatedOrder(null);
    setOrderError(null);
    setIsPaymentPickerOpen(false);
  }

  function finishCreatedOrderFlow() {
    if (isSubmittingOrder) return;

    closeOrderModal();
    onClose();
  }

  function selectOrderType(type: OrderType) {
    if (type === "Delivery" && !isPublicDeliveryAvailable) return;

    setOrderType(type);
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
  // Botón "¿Dudas con tu pedido? Escríbenos" (apagable por el dueño): abre el
  // WhatsApp del negocio con un mensaje listo que incluye los pedidos activos
  // del cliente (número visible y referencia) para que el local los ubique.
  const orderHelpWhatsappNumber = (
    publicConfig.deliveryWhatsapp ||
    publicConfig.mainWhatsapp ||
    BRAND.whatsapp ||
    ""
  ).replace(/[^0-9]/g, "");
  const showOrderHelpButton =
    publicConfig.orderHelpWhatsappEnabled && Boolean(orderHelpWhatsappNumber);
  const orderHelpWhatsappHref = (() => {
    if (!showOrderHelpButton) return "";

    const lines = [
      `Hola ${publicConfig.businessName || BRAND.name}! Tengo una duda sobre mi pedido.`,
    ];

    recentPublicOrders.slice(0, 3).forEach((order) => {
      const live = recentOrderLive[order.id];
      const numberLabel = live?.displayNumber
        ? `${live.displayNumber} · `
        : "";

      lines.push(
        `• ${numberLabel}${order.label || "Pedido"} · ${formatUSD(order.totalUSD)}`,
      );
    });

    if (recentPublicOrders.length === 0) {
      const profileName = readPublicCustomerProfile().name;
      if (profileName) lines.push(`Mi nombre: ${profileName}`);
    }

    lines.push("¿Me pueden ayudar?");

    return `https://wa.me/${orderHelpWhatsappNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
  })();
  const orderTypes: OrderType[] = isPublicDeliveryAvailable
    ? ["Comer aquí", "Para llevar", "Delivery"]
    : ["Comer aquí", "Para llevar"];
  const lastOrderAttachedToOpenAccount = Boolean(
    lastCreatedOrder?.attachedToOpenAccount,
  );
  const lastOrderCanReportPayment = Boolean(
    lastCreatedOrder && !lastOrderAttachedToOpenAccount,
  );
  // El pedido recién creado fue ANULADO (anulación automática por falta de
  // pago, cancelación del cliente en otra pestaña, o caja): la confirmación
  // deja de pedir plata y lo dice en rojo.
  const lastOrderCancelled = createdOrderLive.status === "Cancelado";
  // Pago pendiente de reporte tras el registro (pick up / delivery con aviso
  // de pago anticipado O con el modo "comprobante antes de registrar", que
  // son banderas independientes): manda la advertencia grande de la
  // confirmación, el formulario abierto y la ventana emergente.
  const lastOrderPaymentPending =
    lastOrderCanReportPayment &&
    !lastOrderProofReported &&
    !lastOrderCancelled &&
    !lastCreatedOrder?.offline &&
    isPaymentProofPublicAvailable &&
    (publicConfig.publicPrepayNoticeEnabled ||
      publicConfig.publicPaymentBeforeRegisterEnabled) &&
    (lastCreatedOrder?.orderType === "Para llevar" ||
      lastCreatedOrder?.orderType === "Delivery");
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

          <div className="relative flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2.5">
              <ShoppingCart
                className="shrink-0 text-[var(--brand-primary)]"
                size={26}
              />
              <div className="min-w-0">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.3em] text-[var(--brand-primary)]">
                  {businessName}
                </p>
                {/* "Tu pedido" más chico (pedido del dueño 2026-07-22) para
                    dejar aire al botón de ayuda. */}
                <h2 className="truncate text-2xl font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_2px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-3xl">
                  {publicConfig.publicCartTitle || "Tu pedido"}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar carrito"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-black shadow-[0_4px_0_rgba(var(--brand-primary-rgb),0.18)] transition hover:scale-105"
            >
              <X size={24} />
            </button>
          </div>

          {/* Ayuda grande y llamativa dentro del carrito (el botón flotante
              queda tapado por el drawer). Pedido del dueño 2026-07-22. */}
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="relative mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-black shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.6)] transition hover:bg-[var(--brand-accent)] active:translate-y-0.5 active:shadow-none"
          >
            <LifeBuoy size={18} />
            ¿Necesitas ayuda con tu pedido?
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          {!hasItems ? (
            <EmptyCartState
              businessName={businessName}
              onClose={onClose}
              title={publicConfig.publicCartEmptyTitle}
              text={publicConfig.publicCartEmptyText}
              buttonText={publicConfig.publicCartEmptyButtonText}
              onRestoreLastOrder={
                hasLastOrderSnapshot && onRestoreLastOrder
                  ? () => onRestoreLastOrder()
                  : undefined
              }
            />
          ) : (
            <div className="space-y-4">
              {effectiveItems.map((item) => (
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

          {hasItems && SHOW_COUPON_FIELD ? (
            appliedCoupon ? (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.25rem] border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-2.5">
                <p className="text-sm font-black text-[var(--brand-primary)]">
                  Cupón {appliedCoupon.code}: −{appliedCoupon.percent}% aplicado
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponError("");
                  }}
                  className="text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/60 underline underline-offset-2 transition hover:text-red-300"
                >
                  Quitar
                </button>
              </div>
            ) : !isCouponOpen ? (
              // Plegado: un enlace discreto en vez de una caja completa.
              <button
                type="button"
                onClick={() => setIsCouponOpen(true)}
                className="mt-3 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/55 underline underline-offset-4 transition hover:text-[var(--brand-primary)]"
              >
                ¿Tienes un cupón?
              </button>
            ) : (
              <div className="mt-4 rounded-[1.25rem] border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink-2)]/70">
                    ¿Tienes un cupón?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCouponOpen(false);
                      setCouponInput("");
                      setCouponError("");
                    }}
                    className="text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/50 underline underline-offset-2 transition hover:text-[var(--brand-primary)]"
                  >
                    Ocultar
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(event) => setCouponInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleApplyCoupon();
                      }
                    }}
                    placeholder="Escribe tu código"
                    maxLength={20}
                    className="w-full rounded-xl border-2 border-[var(--brand-border)] bg-transparent px-3 py-2 text-sm font-bold uppercase text-[var(--brand-ink-3)] outline-none transition focus:border-[var(--brand-primary)] placeholder:normal-case placeholder:text-[var(--brand-ink-2)]/40"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={isCheckingCoupon || !couponInput.trim()}
                    className="shrink-0 rounded-xl border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-black transition hover:opacity-90 disabled:opacity-50"
                  >
                    {isCheckingCoupon ? "..." : "Aplicar"}
                  </button>
                </div>
                {couponError ? (
                  <p className="mt-2 text-xs font-bold text-red-300">
                    {couponError}
                  </p>
                ) : null}
              </div>
            )
          ) : null}

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

          {/* Pedidos hechos desde este dispositivo (últimos 7 días): el
              cliente vuelve al seguimiento y puede reportar su pago aunque
              haya cerrado la página de confirmación. Los que el local ya
              marcó listos/entregados salen solos de la lista. */}
          {recentPublicOrders.length > 0 && (
            <div className="mx-5 mb-4 mt-8 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                Tus pedidos en curso
              </p>
              <p className="mt-1 text-[0.68rem] font-bold leading-4 text-[var(--brand-ink-2)]/55">
                Toca tu pedido para ver cómo va o enviar tu comprobante de
                pago. Al entregarse, sale solo de esta lista.
              </p>
              <div className="mt-3 space-y-2">
                {recentPublicOrders.map((recentOrder) => {
                  const live = recentOrderLive[recentOrder.id];

                  return (
                    <a
                      key={recentOrder.id}
                      href={`/pedido/${encodeURIComponent(recentOrder.id)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-3 py-3 transition hover:border-[var(--brand-primary)]"
                    >
                      {live?.displayNumber ? (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary)] text-sm font-black text-black">
                          {live.displayNumber}
                        </span>
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--brand-border)] text-[var(--brand-primary)]">
                          <ClipboardList size={18} />
                        </span>
                      )}

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-black text-[var(--brand-ink)]">
                          {recentOrder.label || "Pedido"}
                        </span>
                        <span className="mt-0.5 block text-[0.66rem] font-bold text-[var(--brand-ink-2)]/55">
                          {new Date(recentOrder.createdAt).toLocaleDateString(
                            "es-VE",
                            { day: "2-digit", month: "short" },
                          )}{" "}
                          · {formatUSD(recentOrder.totalUSD)}
                        </span>
                        {live?.status ? (
                          <span
                            className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.08em] ${getPublicOrderDeliveryClass(live.status)}`}
                          >
                            {getPublicOrderDeliveryLabel(live.status)}
                          </span>
                        ) : null}
                      </span>

                      <span className="shrink-0 text-[0.66rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)]">
                        Ver →
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Camino directo para el que no quiere revisar nada: escribirle al
              negocio con el mensaje ya armado (incluye número y referencia de
              sus pedidos activos). El dueño lo activa/apaga en Configuración. */}
          {showOrderHelpButton && (
            <div className="mx-5 mb-5">
              <a
                href={orderHelpWhatsappHref}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2.5 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-5 py-3.5 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-accent)] hover:text-black"
              >
                <MessageCircle size={17} />
                ¿Dudas con tu pedido? Escríbenos
              </a>
            </div>
          )}
        </div>

        {hasItems && (
          <CartSummaryFooter
            items={effectiveItems}
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

      {/* Guía de ayuda: se abre desde el header del carrito y del checkout;
          su overlay (z-[130]) queda por encima de ambos. */}
      <PublicHelpGuide open={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {isOrderModalOpen && canRegisterOrdersInPanel && (
        // En el teléfono el formulario ocupa toda la pantalla (como una página
        // más, estilo apps grandes); la tarjeta flotante queda para escritorio.
        <div className="fixed inset-0 z-[110] flex items-stretch justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:px-4 sm:py-4">
          <div className="h-full max-h-full w-full overflow-y-auto bg-[var(--brand-cream)] text-[var(--brand-ink-3)] shadow-none sm:h-auto sm:max-h-[94vh] sm:max-w-lg sm:rounded-[2rem] sm:border-4 sm:border-[var(--brand-primary)] sm:shadow-2xl sm:shadow-black/45">
            <div className="hidden h-1.5 shrink-0 bg-[linear-gradient(90deg,var(--brand-primary),var(--brand-accent))] sm:block" />

            {/* Barra superior tipo app: fija arriba, COMPACTA (sin el eyebrow
                "Pedido del cliente", pedido del dueño 2026-07-22). El botón de
                Ayuda grande va en su propia fila, abajo, para que se vea. */}
            <div className="sticky top-0 z-30 border-b-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-2.5 sm:relative sm:border-b-0 sm:px-6 sm:py-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={closeOrderModal}
                  disabled={isSubmittingOrder}
                  aria-label="Volver"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] text-[var(--brand-ink)] disabled:opacity-50 sm:hidden"
                >
                  <ArrowLeft size={18} />
                </button>

                <h3 className="min-w-0 flex-1 truncate text-lg font-black uppercase leading-none text-[var(--brand-primary)] drop-shadow-[0_2px_0_rgba(var(--brand-accent-rgb),0.75)] sm:text-xl">
                  {lastOrderPaymentPending
                    ? "Pedido sin pagar"
                    : lastCreatedOrder
                      ? "Pedido confirmado"
                      : isSubmittingOrder
                        ? "Enviando pedido"
                        : "Confirma tu pedido"}
                </h3>

                <button
                  type="button"
                  onClick={closeOrderModal}
                  disabled={isSubmittingOrder}
                  aria-label="Cerrar"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] text-black disabled:opacity-50 sm:h-10 sm:w-10"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Ayuda grande y llamativa: imposible de ignorar para quien se
                  pierde en el pago (pedido del dueño 2026-07-22). */}
              <button
                type="button"
                onClick={() => setIsHelpOpen(true)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-black shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.6)] transition hover:bg-[var(--brand-accent)] active:translate-y-0.5 active:shadow-none"
              >
                <LifeBuoy size={18} />
                ¿Necesitas ayuda con tu pedido?
              </button>
            </div>

            {lastCreatedOrder ? (
              <div className="space-y-5 px-6 py-7">
                <div className="text-center">
                  {lastOrderPaymentPending ? (
                    <AlertTriangle
                      size={58}
                      className="mx-auto animate-pulse text-amber-500"
                      strokeWidth={2.2}
                    />
                  ) : (
                    <CheckCircle2
                      size={58}
                      className="mx-auto text-[var(--brand-primary)]"
                      strokeWidth={2.2}
                    />
                  )}

                  <p className="mt-5 text-sm font-black uppercase tracking-[0.24em] text-[var(--brand-primary)]">
                    {lastOrderCancelled
                      ? "Pedido cancelado"
                      : lastOrderAttachedToOpenAccount
                        ? "Agregado a la cuenta"
                        : lastOrderPaymentPending
                          ? "Pedido sin pagar"
                          : "¡Pedido enviado!"}
                  </p>

                  <h4 className="mt-2 text-3xl font-black text-[var(--brand-ink-3)]">
                    {lastOrderCancelled
                      ? "Este pedido fue cancelado"
                      : lastOrderAttachedToOpenAccount
                        ? "Cuenta actualizada"
                        : lastCreatedOrder.offline
                          ? "Guardado sin conexión"
                          : lastOrderPaymentPending
                            ? "Falta tu pago para prepararlo"
                            : lastCreatedOrder.hasStaffConfirmationItems
                              ? "Pendiente de confirmación"
                              : "El local ya lo recibió"}
                  </h4>

                  <p className="mx-auto mt-4 max-w-sm text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
                    {lastOrderCancelled
                      ? "Ya NO pagues este pedido. Si aún lo quieres, vuelve a pedirlo o escríbenos por WhatsApp y te ayudamos."
                      : lastOrderAttachedToOpenAccount
                        ? `Este pedido se sumó a la cuenta abierta de ${lastCreatedOrder.openAccountTable || "la mesa"}. Caja lo verá junto con el resto de consumos cuando se cierre la cuenta.`
                        : lastCreatedOrder.offline
                          ? "Tu pedido quedó guardado en este teléfono y se enviará solo apenas vuelva el internet. No hace falta repetirlo."
                          : lastOrderPaymentPending
                            ? "Cancela (paga) con los datos de abajo y reporta tu captura o referencia. Apenas caja lo confirme, tu pedido entra a cocina."
                            : lastCreatedOrder.hasStaffConfirmationItems
                              ? `El pedido fue enviado al local. El personal debe confirmar ${cleanStaffConfirmationProductLabel(lastCreatedOrder.staffConfirmationProductNames || [])} antes de prepararlo.`
                              : "Tu pedido ya aparece en la pantalla del local y pronto entra a cocina."}
                  </p>
                </div>

                {/* Número visible del pedido, bien grande: es lo que el
                    cliente menciona por WhatsApp o en el mostrador para que
                    el local lo ubique al instante. */}
                {createdOrderTrackingId ? (
                  <div className="rounded-[1.5rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] px-4 py-5 text-center">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--brand-primary)]">
                      Tu número de pedido
                    </p>

                    <p className="mt-2 text-6xl font-black leading-none text-[var(--brand-ink-3)]">
                      {createdOrderLive.displayNumber || "…"}
                    </p>

                    {lastOrderCancelled ? (
                      <div className="mt-4 rounded-2xl border-2 border-red-500/60 bg-red-500/10 px-4 py-3 text-left">
                        <p className="text-sm font-black leading-5 text-red-500">
                          Este pedido fue cancelado.
                        </p>
                        {createdOrderLive.cancelReason ? (
                          <p className="mt-1 text-[0.78rem] font-bold leading-5 text-red-400/90">
                            Motivo: {createdOrderLive.cancelReason}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[0.72rem] font-bold leading-4 text-red-400/70">
                          NO pagues este pedido. Si lo quieres, vuelve a pedirlo
                          o escríbenos por WhatsApp.
                        </p>
                      </div>
                    ) : createdOrderLive.status === "Listo" ? (
                      <p className="mt-4 rounded-2xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-black uppercase leading-tight text-black">
                        ¡Listo! Pasa a retirarlo indicando tu número.
                      </p>
                    ) : createdOrderLive.status === "Entregado" ? (
                      <p className="mt-4 rounded-2xl border-2 border-green-600 bg-green-600/15 px-4 py-3 text-sm font-black text-green-700">
                        Pedido entregado. ¡Gracias por tu compra!
                      </p>
                    ) : (
                      <p className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-[var(--brand-ink-2)]/75">
                        {createdOrderLive.status === "Preparando" ? (
                          <>
                            <Loader2
                              size={15}
                              className="animate-spin text-[var(--brand-primary)]"
                            />
                            En preparación…
                          </>
                        ) : createdOrderLive.status ? (
                          "Recibido, en espera de cocina"
                        ) : (
                          <>
                            <Loader2
                              size={15}
                              className="animate-spin text-[var(--brand-primary)]"
                            />
                            Consultando estado…
                          </>
                        )}
                      </p>
                    )}

                    {lastOrderPaymentPending ? (
                      // Sin pagar: NO mandar a otra página. Lleva al formulario
                      // de reporte que ya está en este mismo modal (más abajo) y
                      // lo abre/enfoca (fix bug 2026-07-22: antes solo abría el
                      // seguimiento y no dejaba reportar).
                      <button
                        type="button"
                        onClick={() => {
                          const section = document.getElementById(
                            "reporte-pago-seccion",
                          );
                          section?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                          // Avisa a la sección que abra su formulario de reporte.
                          window.dispatchEvent(
                            new CustomEvent("santo:abrir-reporte-pago"),
                          );
                        }}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3.5 text-sm font-black uppercase tracking-[0.12em] text-black shadow-[0_4px_0_rgba(var(--brand-accent-rgb),0.6)] transition hover:bg-[var(--brand-accent)] active:translate-y-0.5 active:shadow-none"
                      >
                        <ImagePlus size={17} />
                        Reportar pago
                      </button>
                    ) : (
                      <a
                        href={`/pedido/${encodeURIComponent(lastCreatedOrder.id)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-transparent px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] transition hover:opacity-80"
                      >
                        Ver el avance de mi pedido
                      </a>
                    )}

                    <p className="mt-3 text-[0.7rem] font-bold leading-5 text-[var(--brand-ink-2)]/60">
                      Si cierras esta página no se pierde nada: tu pedido queda
                      en &quot;Pedidos recientes&quot; al abrir el carrito, y con tu
                      número o tu nombre el local lo ubica al instante.
                    </p>
                  </div>
                ) : null}

                {lastOrderCanReportPayment &&
                  !lastOrderCancelled &&
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

                {/* Recordatorio de pago anticipado en la confirmación: para
                    Pick up / Delivery el pedido no entra a preparación hasta
                    confirmar el pago (configurable por el dueño). */}
                {publicConfig.publicPrepayNoticeEnabled &&
                  lastOrderCanReportPayment &&
                  !lastOrderCancelled &&
                  !lastCreatedOrder.offline &&
                  (lastCreatedOrder.orderType === "Para llevar" ||
                    lastCreatedOrder.orderType === "Delivery") && (
                    <div className="text-left">
                      <PublicPrepayNotice
                        text={publicConfig.publicPrepayNoticeText}
                      />
                    </div>
                  )}

                {/* Pasos de pago unificados con la página de seguimiento
                    (/pedido/[id]): mismos datos de pago filtrados a los
                    métodos elegidos y mismo formulario de reporte (métodos
                    precargados en su moneda, montos por método, Completar,
                    aviso de cobertura y envío solo con referencia). */}
                {!lastOrderAttachedToOpenAccount &&
                  !lastOrderCancelled &&
                  !lastCreatedOrder.offline && (
                  <div id="reporte-pago-seccion" className="text-left">
                    <PublicOrderPaymentSection
                      orderId={lastCreatedOrder.id}
                      autoOpenForm={lastOrderPaymentPending && !lastOrderUsedCheckoutProof}
                      onReported={() => {
                        setLastOrderProofReported(true);
                        setShowPostRegisterPaymentModal(false);
                      }}
                    />
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
                ) : null}

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
                  onClick={finishCreatedOrderFlow}
                  className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-center text-sm font-black uppercase tracking-[0.12em] text-black shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.18)] transition active:translate-y-1 active:shadow-none disabled:opacity-50"
                >
                  {lastOrderPaymentPending
                    ? "Entiendo que no registré mi pago — volver al menú"
                    : "Listo, volver al menú"}
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
              <div className="space-y-5 px-4 py-6 sm:space-y-4 sm:px-6">
                <PublicBranchPicker
                  selection={branchSelection}
                  label="¿En qué sede estás pidiendo?"
                />

                {/* Guía paso a paso del pedido (configurable por el dueño):
                    qué botón tocar y qué sigue, según el tipo de pedido. */}
                {publicConfig.publicOrderStepsEnabled && (
                  <PublicCheckoutSteps
                    orderType={orderType}
                    submitLabel={
                      publicConfig.publicCartLocalOrderButtonText ||
                      "Registrar pedido local"
                    }
                    prepayEnabled={publicConfig.publicPrepayNoticeEnabled}
                  />
                )}

                {/* Aviso para mesas con cuenta: la segunda vez no hace falta
                    volver a identificarse, solo indicar la misma mesa. Solo
                    aplica si el negocio tiene cuentas abiertas activas. El
                    dueño puede pedir que se vea RESALTADO (por defecto). */}
                {orderType === "Comer aquí" &&
                  publicConfig.openAccountsEnabled &&
                  (publicConfig.publicOpenAccountHintHighlighted ? (
                    <div className="rounded-2xl border-[3px] border-[var(--brand-primary)] bg-[var(--brand-accent)]/25 px-4 py-3.5 shadow-[0_4px_0_rgba(var(--brand-primary-rgb),0.2)]">
                      <p className="inline-flex items-center gap-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                        <Table2 size={15} className="shrink-0" />
                        ¿Ya abriste una cuenta en tu mesa?
                      </p>
                      <p className="mt-1.5 text-[0.85rem] font-black leading-5 text-[var(--brand-ink)]">
                        No hace falta poner tus datos otra vez: indica la misma
                        mesa y tu pedido se suma solo a tu cuenta.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border-2 border-[var(--brand-border)] bg-[rgba(var(--brand-primary-rgb),0.06)] px-4 py-2.5">
                      <p className="text-[0.7rem] font-bold leading-4 text-[var(--brand-ink-2)]/65">
                        ¿Ya abriste una cuenta en tu mesa? No hace falta poner
                        tus datos otra vez: indica la misma mesa y tu pedido se
                        suma solo.
                      </p>
                    </div>
                  ))}

                <div id="checkout-nombre">
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Nombre del cliente{" "}
                    {requiresCustomerName ? (
                      <span className="font-black text-red-400">* obligatorio</span>
                    ) : (
                      <span className="text-[var(--brand-ink-2)]/45">(opcional)</span>
                    )}
                  </label>

                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Ejemplo: Carlos"
                    autoComplete="name"
                    className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                  />
                </div>

                {/* Teléfono para mesa y para llevar (Delivery tiene el suyo en
                    su sección): obligatorio en Para llevar para poder avisar;
                    en mesa ayuda a diferenciar clientes pero es opcional. */}
                {!isDeliveryOrder && (
                  <div id="checkout-telefono">
                    <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                      Teléfono{" "}
                      {requiresCustomerPhone ? (
                        <span className="font-black text-red-400">* obligatorio</span>
                      ) : (
                        <span className="text-[var(--brand-ink-2)]/45">(opcional)</span>
                      )}
                    </label>

                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="Ejemplo: 0412-0000000"
                      className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                    Tipo de pedido
                  </label>

                  {/* Las tres opciones lado a lado también en el teléfono:
                      aprovecha el ancho y se ve de un vistazo. */}
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:gap-3">
                    {orderTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => selectOrderType(type)}
                        className={`rounded-2xl border-2 px-1.5 py-4 text-[0.72rem] font-black uppercase leading-tight transition sm:px-4 sm:text-sm ${
                          orderType === type
                            ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-black"
                            : "border-[var(--brand-primary)] bg-[var(--brand-surface-2)] text-[var(--brand-primary)]"
                        }`}
                      >
                        {getOrderTypePublicLabel(type)}
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
                  <div id="checkout-mesa">
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

                {/* Pick up: igual que Delivery, se pide el método de pago
                    (obligatorio) con pago mixto y "Completar"; el reporte de
                    pago luego pre-carga ese método. */}
                {isTakeawayOrder && (
                  <div className="space-y-5 sm:space-y-4">
                    {publicConfig.publicPrepayNoticeEnabled && (
                      <PublicPrepayNotice
                        text={publicConfig.publicPrepayNoticeText}
                      />
                    )}
                    {renderCheckoutPaymentSection()}
                  </div>
                )}

                {isDeliveryOrder && (
                  // Sin caja envolvente: las tarjetas internas (ubicación,
                  // pago mixto, costo) son el único nivel de borde para que
                  // el formulario respire y no se vea comprimido.
                  <div className="space-y-5 sm:space-y-4">
                    {publicConfig.publicPrepayNoticeEnabled && (
                      <PublicPrepayNotice
                        text={publicConfig.publicPrepayNoticeText}
                      />
                    )}
                    {/* 1. Ubicación primero (como las apps grandes): define el
                        costo del envío y la cobertura antes de pedir datos. */}
                    {isDistancePricingEnabled && (
                      <div
                        id="checkout-ubicacion"
                        className="overflow-hidden rounded-2xl border-2 border-[var(--brand-primary)]/40 bg-[var(--brand-cream)]"
                      >
                        {/* Encabezado con ícono: la sección más importante
                            del delivery merece verse como tarjeta, no como
                            un campo más. */}
                        <div className="flex items-center gap-3 border-b-2 border-[var(--brand-primary)]/15 bg-[rgba(var(--brand-primary-rgb),0.09)] px-4 py-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-black shadow-[0_3px_0_rgba(var(--brand-accent-rgb),0.6)]">
                            <MapPin size={18} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-black uppercase tracking-[0.16em] text-[var(--brand-primary)]">
                              ¿A dónde te lo llevamos?
                            </span>
                            <span className="mt-0.5 block text-[0.68rem] font-bold leading-4 text-[var(--brand-ink-2)]/55">
                              Con tu ubicación calculamos el costo exacto del
                              envío
                            </span>
                          </span>
                        </div>

                        <div className="px-4 py-4">
                          {/* Un toque y listo: el GPS pide el permiso al
                              momento (también se intenta solo al entrar a
                              Delivery) y el link de Maps queda como plan B. */}
                          <button
                            type="button"
                            onClick={handleQuoteFromGps}
                            disabled={isQuotingDistance}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-3.5 text-xs font-black uppercase tracking-[0.1em] text-black shadow-[0_4px_0_rgba(var(--brand-accent-rgb),0.5)] transition hover:opacity-90 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isQuotingDistance ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Crosshair size={16} />
                            )}
                            Usar mi ubicación actual
                          </button>

                          <div className="my-3 flex items-center gap-3">
                            <span className="h-0.5 flex-1 rounded bg-[var(--brand-border)]" />
                            <span className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[var(--brand-ink-2)]/45">
                              o pega tu link de Google Maps
                            </span>
                            <span className="h-0.5 flex-1 rounded bg-[var(--brand-border)]" />
                          </div>

                          <input
                            value={customerMapsUrl}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setCustomerMapsUrl(nextValue);
                              setDistanceQuote(null);
                              setDistanceQuoteError(null);
                              scheduleAutoQuote(nextValue);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                handleQuoteFromMapsUrl();
                              }
                            }}
                            placeholder="https://maps.app.goo.gl/..."
                            inputMode="url"
                            className="w-full min-w-0 rounded-2xl border-2 border-[var(--brand-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                          />

                          {/* Punto elegido: mini mapa de confirmación visual
                              con el chip "Ajustar" (como las apps grandes). */}
                          {distanceQuote && deliveryPointCoords && (
                            <div className="relative isolate mt-3">
                              <DeliveryPointPreviewMap
                                lat={deliveryPointCoords.lat}
                                lng={deliveryPointCoords.lng}
                              />
                              <button
                                type="button"
                                onClick={() => setIsAdjustMapOpen(true)}
                                className="absolute right-2 top-2 z-[600] flex items-center gap-1.5 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] px-3 py-1.5 text-[0.66rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] shadow-md transition hover:bg-[var(--brand-accent)] hover:text-black"
                              >
                                <Pencil size={12} />
                                Ajustar
                              </button>
                            </div>
                          )}

                          {distanceQuote && (
                            <p className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-green-600 bg-green-600/15 px-4 py-3 text-sm font-black leading-5 text-green-600">
                              <CheckCircle2 size={17} className="shrink-0" />
                              Estás a ~{distanceQuote.distanceKm.toFixed(1)} km
                              · Envío {formatUSD(distanceQuote.costUSD)}
                            </p>
                          )}

                          {distanceQuoteError && (
                            <p className="mt-3 rounded-2xl border-2 border-orange-400/40 bg-orange-100 px-4 py-3 text-sm font-bold leading-5 text-orange-800">
                              {distanceQuoteError}
                            </p>
                          )}

                          {gpsAccuracyNotice && !distanceQuoteError && (
                            <p className="mt-3 rounded-2xl border-2 border-amber-400/60 bg-amber-50 px-4 py-3 text-sm font-bold leading-5 text-amber-800">
                              {gpsAccuracyNotice}
                            </p>
                          )}

                          {!distanceQuote &&
                            !distanceQuoteError &&
                            distanceMaxKm > 0 && (
                              <p className="mt-2 text-[0.68rem] font-bold leading-4 text-[var(--brand-ink-2)]/55">
                                Llegamos hasta {distanceMaxKm} km a la redonda
                                {distanceTiers.length > 0
                                  ? ` · Referencia: hasta ${distanceTiers[distanceTiers.length - 1].upToKm} km ${formatUSD(distanceTiers[distanceTiers.length - 1].costUSD)}${
                                      distanceTiers.length > 1
                                        ? ` (desde ${formatUSD(distanceTiers[0].costUSD)})`
                                        : ""
                                    }`
                                  : ""}
                                . Tu costo exacto se calcula con tu ubicación.
                              </p>
                            )}
                        </div>
                      </div>
                    )}

                    {/* La ubicación exacta viene del GPS o del link de Maps:
                        el mensaje para el repartidor es raro, así que vive
                        oculto tras esta casilla. */}
                    <div>
                      <label className="flex cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={wantsDeliveryReference}
                          onChange={(event) => {
                            setWantsDeliveryReference(event.target.checked);
                            if (!event.target.checked) {
                              setDeliveryReference("");
                            }
                          }}
                          className="h-5 w-5 shrink-0 accent-[var(--brand-primary)]"
                        />
                        <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                          Agregar punto de referencia o mensaje
                        </span>
                      </label>

                      {wantsDeliveryReference && (
                        <input
                          value={deliveryReference}
                          onChange={(event) =>
                            setDeliveryReference(event.target.value)
                          }
                          placeholder="Ejemplo: Torre Azul apto 4B, portón negro, frente a la farmacia..."
                          className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                        />
                      )}
                    </div>

                    <div id="checkout-pago" className="grid gap-4 sm:grid-cols-2">
                      <div id="checkout-telefono">
                        <label className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                          Teléfono{" "}
                          <span className="font-black text-red-400">
                            * obligatorio
                          </span>
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
                          className="mt-2 w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-3.5 text-base font-bold text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-ink)]/45 focus:border-[var(--brand-primary)]"
                        />
                      </div>

                      <OptionPicker
                        label={
                          <>
                            Método de pago{" "}
                            <span className="font-black text-red-400">
                              * obligatorio
                            </span>
                          </>
                        }
                        value={paymentMethod}
                        placeholder="Selecciona método"
                        options={paymentMethodOptions}
                        isOpen={isPaymentPickerOpen}
                        onToggle={() => {
                          setIsPaymentPickerOpen((current) => !current);
                        }}
                        onSelect={(value) => {
                          setPaymentMethod(value);
                          setIsPaymentPickerOpen(false);
                        }}
                      />
                    </div>

                    {renderCashChangeSection()}

                    {renderCheckoutProofSection()}

                    {renderMixedPaymentSection()}

                    {Object.keys(checkoutPaymentMethodDetails).length > 0 && (
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                          Datos para pagar
                          {selectedPaymentMethods.length > 0 && (
                            <span className="text-[var(--brand-ink-2)]/45">
                              {" "}
                              ({selectedPaymentMethods.join(" + ")})
                            </span>
                          )}
                        </p>
                        <div className="mt-2">
                          <PaymentMethodDetailsList
                            details={checkoutPaymentMethodDetails}
                          />
                        </div>
                      </div>
                    )}

                    <div className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                        Costo de delivery
                      </p>
                      <p className="mt-1 text-2xl font-black text-[var(--brand-ink-3)]">
                        {distanceQuote
                          ? `${formatUSD(deliveryCostValue)} · ~${distanceQuote.distanceKm.toFixed(1)} km`
                          : isDistancePricingEnabled
                            ? distanceTiers.length > 0
                              ? `Referencia: hasta ${distanceTiers[distanceTiers.length - 1].upToKm} km ${formatUSD(distanceTiers[distanceTiers.length - 1].costUSD)}`
                              : "Comparte tu ubicación arriba"
                            : "Se confirma por WhatsApp"}
                      </p>
                      <p className="mt-2 text-[0.68rem] font-bold leading-4 text-[var(--brand-ink-2)]/55">
                        {isDistancePricingEnabled
                          ? "Se calcula solo con tu ubicación y ya queda incluido en el total del pedido."
                          : "Te confirmamos el costo del envío por WhatsApp al recibir tu pedido."}
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
                        </span>{" "}
                        / Bs {formatVES(deliveryCostValue * exchangeRate)}
                      </p>
                    )}

                    <p>
                      Total final en divisas:{" "}
                      <span className="text-[var(--brand-primary)]">
                        {formatUSD(totalUSD)}
                      </span>
                    </p>

                    <p>
                      Total en bolívares (referencia):{" "}
                      <span className="text-[var(--brand-primary)]">
                        Bs {formatVES(totalVES)}
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
                        onChange={(event) => void handleOrderAttachmentChange(event)}
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

                {hasItems && missingOrderFields.length > 0 && (
                  <div className="rounded-2xl border-2 border-[var(--brand-border)] bg-[rgba(var(--brand-primary-rgb),0.12)] px-4 py-3">
                    <p className="text-sm font-bold leading-6 text-[var(--brand-ink)]/80">
                      Para registrar el pedido falta:{" "}
                      {missingOrderFields.join(", ")}.
                    </p>
                  </div>
                )}

                {/* Aviso GRANDE al intentar registrar con datos pendientes:
                    dice qué falta y la pantalla baja sola a esa sección. */}
                {validationAlert && (
                  <div
                    role="alert"
                    className="rounded-2xl border-[3px] border-red-500 bg-red-500/15 px-4 py-4"
                  >
                    <p className="text-base font-black leading-6 text-red-500">
                      ⚠️ {validationAlert}
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
                  disabled={isSubmittingOrder || !hasItems}
                  onClick={() => {
                    // Con datos pendientes NO se bloquea el botón en gris:
                    // se explica en grande qué falta y se lleva al cliente a
                    // esa sección (pedido del dueño 2026-07-21).
                    if (!canRegisterLocalOrder) {
                      const firstMissing = missingOrderChecks[0];
                      setValidationAlert(
                        missingOrderChecks.length > 0
                          ? `Para registrar tu pedido te falta: ${missingOrderFields.join(", ")}.`
                          : hasUnavailableItemsForOrderType
                            ? unavailableItemsMessage
                            : needsBranchSelection
                              ? "Elige la sede donde estás pidiendo (arriba en este formulario)."
                              : isTableReservedNow
                                ? "Esa mesa está reservada en este horario. Pide apoyo al personal."
                                : "Revisa los datos del pedido e intenta de nuevo.",
                      );
                      if (firstMissing) {
                        document
                          .getElementById(firstMissing.targetId)
                          ?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }
                      return;
                    }

                    setValidationAlert(null);
                    // Con ubicación elegida, primero se confirma la dirección
                    // en el mapa (estilo apps grandes); sin ubicación va
                    // directo.
                    if (isDeliveryOrder && distanceQuote && deliveryPointCoords) {
                      setIsAddressConfirmOpen(true);
                      return;
                    }
                    void handleRegisterLocalOrder();
                  }}
                  className={`mt-2 flex w-full items-center justify-center gap-3 rounded-full border-2 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] shadow-[0_6px_0_rgba(var(--brand-primary-rgb),0.18)] transition active:translate-y-1 active:shadow-none disabled:cursor-not-allowed ${
                    hasItems && !isSubmittingOrder
                      ? "border-[var(--brand-primary)] bg-[var(--brand-accent)] text-black"
                      : "border-[var(--brand-border)] bg-[#ddd3c4] text-[var(--brand-ink-2)]/35"
                  }`}
                >
                  <ClipboardList size={21} />
                  Registrar pedido
                </button>

              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmación de dirección antes de registrar: mapa de solo lectura
          con el pin en el punto elegido, "Ajustar" para moverlo y el botón
          que registra de verdad. */}
      {isAddressConfirmOpen && deliveryPointCoords && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-[1.8rem] border-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] p-5 text-[var(--brand-ink-3)]">
            <h4 className="text-center text-lg font-black leading-6 text-[var(--brand-ink-3)]">
              Antes de continuar, ¿es esta la ubicación donde quieres que
              llegue tu pedido?
            </h4>

            <div className="relative isolate mt-4">
              <DeliveryPointPreviewMap
                lat={deliveryPointCoords.lat}
                lng={deliveryPointCoords.lng}
                heightClassName="h-52"
              />
              <button
                type="button"
                onClick={() => setIsAdjustMapOpen(true)}
                className="absolute right-2 top-2 z-[600] flex items-center gap-1.5 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-cream)] px-3 py-1.5 text-[0.66rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] shadow-md transition hover:bg-[var(--brand-accent)] hover:text-black"
              >
                <Pencil size={12} />
                Ajustar
              </button>
            </div>

            <p className="mt-3 text-center text-sm font-bold text-[var(--brand-ink-2)]/70">
              {isQuotingDistance ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={15} className="animate-spin" />
                  Recalculando el envío…
                </span>
              ) : distanceQuote ? (
                <>
                  Estás a ~{distanceQuote.distanceKm.toFixed(1)} km · Envío{" "}
                  {formatUSD(distanceQuote.costUSD)}
                </>
              ) : (
                "Confirma tu punto de entrega."
              )}
            </p>

            <button
              type="button"
              disabled={isQuotingDistance || !distanceQuote}
              onClick={() => {
                setIsAddressConfirmOpen(false);
                void handleRegisterLocalOrder();
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-black shadow-[0_5px_0_rgba(var(--brand-primary-rgb),0.18)] transition active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              La ubicación es correcta →
            </button>

            <button
              type="button"
              onClick={() => setIsAddressConfirmOpen(false)}
              className="mt-2 w-full rounded-full px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--brand-ink-2)]/60 transition hover:text-[var(--brand-primary)]"
            >
              Volver y revisar mis datos
            </button>
          </div>
        </div>
      )}

      {/* Ventana emergente post-registro: lo PRIMERO que ve el cliente si su
          pago quedó pendiente (pedido del dueño 2026-07-21). */}
      {showPostRegisterPaymentModal && lastOrderPaymentPending && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm rounded-[1.8rem] border-4 border-amber-500 bg-[var(--brand-cream)] p-6 text-center text-[var(--brand-ink-3)] shadow-2xl shadow-black/60">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-black">
              <AlertTriangle size={30} />
            </span>
            <p className="mt-4 text-2xl font-black uppercase leading-tight">
              ¡Falta un paso!
            </p>
            <p className="mt-3 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/80">
              Tu pedido quedó guardado, pero NO entra a preparación hasta que
              canceles (pagues) y reportes tu abono con la captura o la
              referencia completa.
            </p>
            {publicConfig.publicUnpaidAutoCancelMinutes > 0 ? (
              <p className="mt-2 rounded-xl border-2 border-red-400 bg-red-500/10 px-3 py-2 text-[0.8rem] font-black leading-5 text-red-500">
                Ojo: si no lo reportas en{" "}
                {publicConfig.publicUnpaidAutoCancelMinutes} minutos, el pedido
                se anula solo.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setShowPostRegisterPaymentModal(false)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border-2 border-amber-600 bg-amber-500 px-5 py-4 text-sm font-black uppercase tracking-[0.1em] text-black transition hover:opacity-90 active:scale-[0.98]"
            >
              Reportar mi pago ahora
            </button>
          </div>
        </div>
      )}

      {isAdjustMapOpen && deliveryPointCoords && (
        <DeliveryMapPicker
          initialLat={deliveryPointCoords.lat}
          initialLng={deliveryPointCoords.lng}
          onConfirm={handleAdjustMapConfirm}
          onClose={() => setIsAdjustMapOpen(false)}
        />
      )}
    </div>
  );
}
