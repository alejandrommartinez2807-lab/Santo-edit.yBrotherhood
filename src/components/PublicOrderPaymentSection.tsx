"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Loader2,
  ReceiptText,
  Send,
  XCircle,
} from "lucide-react";
import { formatPublicUSD as formatUSD, formatVES } from "@/utils/formatCurrency";
import { usePublicCurrencySymbol } from "@/hooks/usePublicCurrencySymbol";
import { DEFAULT_PUBLIC_PAYMENT_METHODS } from "@/lib/publicPageConfig";

// Sección "Pagos" de la página pública de seguimiento (/pedido/[orderId]):
// - El cliente que salió sin subir su captura puede reportar el pago DESPUÉS
//   desde el mismo link que guardó (o recibió por WhatsApp).
// - Si ya reportó uno, lo ve con su estado (en revisión / confirmado) para no
//   enviarlo dos veces días después.
// - Cuando caja confirma, aquí aparece "Pago confirmado".

type PublicProof = {
  createdAt: string;
  status: string;
  reportedMethod: string;
  amountReportedUSD: number;
  amountReportedVES: number;
  paymentReference: string;
  internalNote: string;
};

type ExpectedPayment = {
  method: string;
  currency: "USD" | "VES";
  amount: number;
};

type OrderPaymentInfo = {
  branchId: string;
  totalUSD: number;
  exchangeRate: number;
  paymentRegistered: boolean;
  createdAt: string;
  orderStatus: string;
  // El servidor decide si a este pedido le aplica la anulación automática
  // (Pick up/Delivery con método electrónico): solo ahí van el contador y
  // los recordatorios escalonados — en mesa o efectivo serían amenazas falsas.
  autoCancelApplies: boolean;
  // Patas electrónicas que eligió el cliente al pedir (método + monto en su
  // moneda): precargan el formulario y definen cuánto se debe reportar.
  expectedPayments: ExpectedPayment[];
  requiredReportUSD: number;
  proofs: PublicProof[];
};

function formatDateTime(value: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function proofStatusChip(status: string) {
  if (status === "Confirmado por caja") {
    return {
      icon: <BadgeCheck size={14} />,
      classes: "border-green-600 bg-green-600/15 text-green-400",
      label: "Confirmado",
    };
  }
  if (status === "Rechazado") {
    return {
      icon: <XCircle size={14} />,
      classes: "border-red-500 bg-red-500/15 text-red-400",
      label: "Rechazado",
    };
  }
  if (status === "Necesita corrección") {
    return {
      icon: <XCircle size={14} />,
      classes: "border-orange-500 bg-orange-500/15 text-orange-400",
      label: "Necesita corrección",
    };
  }
  return {
    icon: <Clock3 size={14} />,
    classes: "border-yellow-500 bg-yellow-500/10 text-yellow-500",
    label: "En revisión",
  };
}

function normalizeMoneyInput(value: string) {
  const rawValue = value.trim().replace(/\s/g, "").replace(",", ".");
  const numberValue = Number(rawValue);

  if (!Number.isFinite(numberValue) || numberValue < 0) return 0;
  return Math.round((numberValue + Number.EPSILON) * 100) / 100;
}

import PaymentMethodDetailsList from "@/components/PaymentMethodDetailsList";
import { readRecentPublicOrders } from "@/components/recentPublicOrders";
// Clasificador único de moneda del método (compartido con caja/pedidos): los
// indicadores de divisa mandan (Zelle/Binance/"…internacional"/"…en dólares" son
// en $); pago móvil, punto, transferencia local, efectivo Bs, biopago son en Bs.
import { isVesPaymentMethod } from "@/lib/paymentOptions";
import {
  computePendingElectronicUSD,
  isCashReportedMethod,
} from "@/lib/orderPaymentLegs";
import { readImageFileForUpload } from "@/lib/clientImage";

type PaymentEntry = {
  method: string;
  amountUSD: string;
  amountVES: string;
};

const EMPTY_PAYMENT_ENTRY: PaymentEntry = {
  method: "",
  amountUSD: "",
  amountVES: "",
};

// Total del "Paso 1" en la moneda de los métodos elegidos al pedir: solo Bs si
// todos son en bolívares, solo $ si todos son en divisas, ambos si hay mezcla.
function formatChosenTotal(
  info: { totalUSD: number; exchangeRate: number },
  chosenMethods: string[],
) {
  const vesChosen = chosenMethods.some((methodName) => isVesPaymentMethod(methodName));
  const usdChosen = chosenMethods.some((methodName) => !isVesPaymentMethod(methodName));
  const totalVES = info.totalUSD * info.exchangeRate;
  const canShowVES = vesChosen && info.exchangeRate > 0 && totalVES > 0;

  // Siempre con la referencia en dólares al lado (pedido del dueño: que el
  // pago móvil también se entienda en $).
  if (canShowVES && !usdChosen)
    return `Bs ${formatVES(totalVES)} (≈ ${formatUSD(info.totalUSD)})`;
  if (canShowVES && usdChosen) return `${formatUSD(info.totalUSD)} · Bs ${formatVES(totalVES)}`;
  return formatUSD(info.totalUSD);
}

export default function PublicOrderPaymentSection({
  orderId,
  autoOpenForm = false,
  forceOpenSignal = 0,
  proofsEnabled,
  onReported,
  showTrackingLink = false,
}: {
  orderId: string;
  // Abre el formulario de reporte de una vez (confirmación con pago
  // pendiente: un paso menos para el cliente).
  autoOpenForm?: boolean;
  // Señal para abrir el formulario desde afuera (botón "Reportar pago" de la
  // confirmación): cada vez que sube el número, se abre el form. Más confiable
  // que un evento porque no depende del orden de montaje.
  forceOpenSignal?: number;
  // Fuente ÚNICA de si el reporte de pago está disponible: el contenedor
  // (carrito / página de seguimiento) ya cargó la config pública para poder
  // renderizarse, así que la pasa aquí. Antes el hijo hacía su PROPIO fetch a
  // business-config y, si fallaba o tardaba (teléfono con mala señal, PWA), el
  // flag se quedaba en false y la sección entera retornaba null: el botón
  // "Reportar pago" no abría nada. Con el prop nunca divergen ni se cierra por
  // un fetch caído. Si viene undefined, se usa el fetch propio como respaldo.
  proofsEnabled?: boolean;
  // Avisa al contenedor cuando el pago quedó reportado (la confirmación
  // apaga su advertencia grande).
  onReported?: () => void;
  // Tras enviar el reporte, ofrecer ir al seguimiento /pedido/<id> (lo usa la
  // confirmación del carrito: mucha gente cierra la pantalla después de
  // reportar y perdía el link del avance — dueño 2026-07-23). La página de
  // seguimiento no lo pasa porque ya ES esa página.
  showTrackingLink?: boolean;
}) {
  usePublicCurrencySymbol();
  const [info, setInfo] = useState<OrderPaymentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProofsEnabled, setIsProofsEnabled] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(
    DEFAULT_PUBLIC_PAYMENT_METHODS,
  );
  // Datos del negocio para pagar (pago móvil, Zelle…) y métodos que el
  // cliente eligió al pedir (guardados en su dispositivo): con esto la página
  // de seguimiento muestra lo mismo que la confirmación del pedido.
  const [paymentMethodDetails, setPaymentMethodDetails] = useState<
    Record<string, string>
  >({});
  const [chosenMethods, setChosenMethods] = useState<string[]>([]);
  // Configurable por el dueño: si está apagado, el método del pedido queda
  // fijo al reportar el pago (cuando se conoce cuál eligió el cliente).
  const [allowMethodChange, setAllowMethodChange] = useState(true);
  // Anulación automática sin pago (minutos, 0 = apagada): para el contador
  // visible y los recordatorios escalonados.
  const [autoCancelMinutes, setAutoCancelMinutes] = useState(0);
  // Tick por minuto: refresca el recordatorio "llevas X min sin reportar".
  const [reminderTick, setReminderTick] = useState(0);
  const firedRemindersRef = useRef<Set<number>>(new Set());

  const [isFormOpen, setIsFormOpen] = useState(false);
  // Un bloque por método: si el cliente pagó parte con un método y parte con
  // otro, indica cuánto fue en cada uno. Se precarga con lo que eligió al
  // pedir (editable si al final pagó distinto).
  const [payments, setPayments] = useState<PaymentEntry[]>([EMPTY_PAYMENT_ENTRY]);
  const [reference, setReference] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [mimeType, setMimeType] = useState("");
  // Segunda captura (solo pago mixto: una por cada pata). El dueño puede
  // apagarla desde Configuración (publicMixedSecondProofEnabled).
  const [allowSecondProof, setAllowSecondProof] = useState(true);
  const [dataUrl2, setDataUrl2] = useState("");
  const [fileName2, setFileName2] = useState("");
  const [mimeType2, setMimeType2] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  // Aviso suave cuando lo reportado no cubre el total: se puede enviar igual
  // (abonos parciales existen), pero que sea a propósito y no un error.
  const [coverageWarning, setCoverageWarning] = useState<string | null>(null);

  const loadInfo = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/public/order-payment?pedido=${encodeURIComponent(orderId)}`,
        { cache: "no-store" },
      );
      const data = await response.json();

      if (response.ok && data.ok) {
        setInfo({
          branchId: String(data.branchId || ""),
          totalUSD: Number(data.totalUSD || 0),
          exchangeRate: Number(data.exchangeRate || 0),
          paymentRegistered: data.paymentRegistered === true,
          createdAt: String(data.createdAt || ""),
          orderStatus: String(data.orderStatus || ""),
          autoCancelApplies: data.autoCancelApplies === true,
          expectedPayments: Array.isArray(data.expectedPayments)
            ? data.expectedPayments
                .map((leg: Partial<ExpectedPayment>) => ({
                  method: String(leg.method || "").trim(),
                  currency: leg.currency === "VES" ? ("VES" as const) : ("USD" as const),
                  amount: Number(leg.amount || 0),
                }))
                .filter((leg: ExpectedPayment) => leg.method && leg.amount > 0)
            : [],
          requiredReportUSD: Number(data.requiredReportUSD ?? data.totalUSD ?? 0),
          proofs: Array.isArray(data.proofs) ? data.proofs : [],
        });
      }
    } catch {
      // Sin datos de pago la página de seguimiento funciona igual.
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/public/business-config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const config = data?.businessConfig || data?.config || {};
        setIsProofsEnabled(config.paymentProofsEnabled !== false);
        setAllowSecondProof(config.publicMixedSecondProofEnabled !== false);
        setAllowMethodChange(config.publicPaymentMethodChangeEnabled !== false);
        setAutoCancelMinutes(
          Math.max(0, Math.round(Number(config.publicUnpaidAutoCancelMinutes) || 0)),
        );
        const methods = Array.isArray(config.publicPaymentMethods)
          ? config.publicPaymentMethods
              .map((item: unknown) => String(item || "").trim())
              .filter(Boolean)
          : [];
        if (methods.length) setPaymentMethods(methods);
        const details = config.publicPaymentMethodDetails;
        if (details && typeof details === "object" && !Array.isArray(details)) {
          setPaymentMethodDetails(details as Record<string, string>);
        }
      })
      .catch(() => {
        // Config pública caída: se usan los métodos por defecto.
      });

    // Difiere la carga un tick para no hacer setState síncrono en el efecto
    // (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      void loadInfo();
      const recentEntry = readRecentPublicOrders().find(
        (entry) => entry.id === orderId,
      );
      setChosenMethods(recentEntry?.paymentMethods || []);
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadInfo, orderId]);

  // Apertura automática del formulario (una sola vez) cuando el pago sigue
  // pendiente: la confirmación del carrito lo pide con autoOpenForm.
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    // Se abre aunque `info` no haya cargado (null): reportar pago no debe
    // depender de que /order-payment responda. Si ya hay pago/comprobante, no
    // se abre (pero eso solo se sabe con info).
    if (!autoOpenForm || autoOpenedRef.current || isLoading) return;

    const proofs = info?.proofs || [];
    const hasActiveProof = proofs.some(
      (proof) => proof.status !== "Rechazado",
    );

    if (info?.paymentRegistered || hasActiveProof) return;

    autoOpenedRef.current = true;
    // Diferido un tick para no hacer setState síncrono dentro del efecto.
    const timer = setTimeout(() => {
      setIsFormOpen(true);
      setPayments(buildInitialPayments());
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cargar la info
  }, [autoOpenForm, isLoading, info, chosenMethods]);

  // El botón "Reportar pago" de la confirmación abre este formulario (en vez de
  // mandar al cliente a otra página). Cada subida de forceOpenSignal lo abre y
  // precarga. Se ignora el valor inicial 0 (no abrir al montar).
  useEffect(() => {
    if (!forceOpenSignal) return;
    // Diferido un tick para no hacer setState síncrono dentro del efecto.
    const timer = setTimeout(() => {
      setSuccessMessage(null);
      setIsFormOpen(true);
      setPayments(buildInitialPayments());
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reaccionar a la señal
  }, [forceOpenSignal]);

  // Si el formulario se abrió ANTES de que /order-payment respondiera (caso
  // típico: "Reportar pago" apenas registrado el pedido), los montos quedaban
  // vacíos aunque el método sí apareciera. Al llegar la info se precargan
  // solos — únicamente si el cliente no ha escrito ningún monto.
  useEffect(() => {
    if (!isFormOpen || !info) return;
    const hasAmounts = payments.some(
      (entry) => entry.amountUSD.trim() !== "" || entry.amountVES.trim() !== "",
    );
    if (hasAmounts) return;
    const timer = setTimeout(() => setPayments(buildInitialPayments()), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reprecarga solo al llegar la info
  }, [isFormOpen, info]);

  const activeProofs = (info?.proofs || []).filter(
    (proof) => proof.status !== "Rechazado",
  );
  // Solo un comprobante ELECTRÓNICO confirmado implica pago: confirmar la
  // foto de los billetes valida que el efectivo existe, pero el cobro real lo
  // registra caja al recibirlo (fix lote v9, alineado con order-status).
  const hasConfirmedPayment =
    info?.paymentRegistered ||
    activeProofs.some(
      (proof) =>
        proof.status === "Confirmado por caja" &&
        !isCashReportedMethod(proof.reportedMethod),
    );
  const hasPendingProof = activeProofs.some(
    (proof) =>
      proof.status === "Comprobante enviado" || proof.status === "En revisión",
  );
  const needsCorrection = (info?.proofs || []).some(
    (proof) => proof.status === "Necesita corrección",
  );
  // Cobertura POR PATAS (bug real 2026-07-23): en mixto efectivo+electrónico,
  // la foto de los billetes creaba un proof y todo se daba por reportado sin
  // que nadie pidiera la captura/referencia de Pago móvil/Zelle. La foto del
  // efectivo (método con "efectivo") NO cuenta para la parte electrónica.
  const requiredElectronicUSD = Number(info?.requiredReportUSD || 0);
  const pendingElectronicUSD = computePendingElectronicUSD({
    requiredUSD: requiredElectronicUSD,
    exchangeRate: Number(info?.exchangeRate || 0),
    proofs: activeProofs.map((proof) => ({
      method: proof.reportedMethod,
      amountUSD: Number(proof.amountReportedUSD || 0),
      amountVES: Number(proof.amountReportedVES || 0),
    })),
  });
  // true = lo electrónico exigible ya está cubierto por comprobantes.
  const reportCovered =
    requiredElectronicUSD <= 0 || pendingElectronicUSD <= 0;
  // Reporte de pago MIXTO: más de un método (una captura por cada pata).
  const isMixedReport = payments.length > 1;

  // Minutos desde que se registró el pedido (para el recordatorio escalonado
  // 5/10/15/20 min y el contador de anulación automática). SOLO aplica a los
  // pedidos donde la anulación automática existe de verdad (Pick up/Delivery
  // con método electrónico, lo decide el servidor): en mesa o efectivo el
  // cliente paga al final y el contador sería una amenaza falsa.
  const paymentPendingReminder =
    !hasConfirmedPayment && !hasPendingProof && info?.autoCancelApplies === true;
  const elapsedMinutes = (() => {
    if (!info?.createdAt) return 0;
    const createdAt = new Date(info.createdAt);
    if (Number.isNaN(createdAt.getTime())) return 0;
    // reminderTick fuerza el recálculo cada minuto.
    void reminderTick;
    return Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60_000));
  })();

  useEffect(() => {
    if (!paymentPendingReminder || !info?.createdAt) return;

    const timer = window.setInterval(() => {
      setReminderTick((tick) => tick + 1);
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [paymentPendingReminder, info?.createdAt]);

  // Refresco periódico del estado de pago: si caja confirma (o el pedido se
  // anula) mientras el cliente tiene la página abierta, el banner y el
  // contador se apagan solos en vez de quedarse congelados en el primer
  // snapshot.
  useEffect(() => {
    if (isLoading || !info || hasConfirmedPayment) return;
    if (info.orderStatus === "Cancelado") return;

    const timer = window.setInterval(() => {
      void loadInfo();
    }, 45_000);

    return () => window.clearInterval(timer);
  }, [isLoading, info, hasConfirmedPayment, loadInfo]);

  useEffect(() => {
    if (!paymentPendingReminder || elapsedMinutes <= 0) return;

    // Recordatorios a los 5/10/15/20 min sin reporte: vibración +
    // notificación del navegador (si el cliente dio permiso) una sola vez
    // por umbral.
    const threshold = [20, 15, 10, 5].find((mark) => elapsedMinutes >= mark);
    if (!threshold || firedRemindersRef.current.has(threshold)) return;
    firedRemindersRef.current.add(threshold);

    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch {
      // El banner visual ya recuerda.
    }

    const notificationsAvailable =
      typeof window !== "undefined" && "Notification" in window;

    if (notificationsAvailable && Notification.permission === "granted") {
      const reminderBody =
        autoCancelMinutes > 0
          ? `Llevas ${threshold} min sin reportar tu pago. El pedido se anula solo a los ${autoCancelMinutes} min.`
          : `Llevas ${threshold} min sin reportar tu pago. Repórtalo para que tu pedido entre a preparación.`;

      try {
        new Notification("Recuerda reportar tu pago", {
          body: reminderBody,
          icon: "/icon-192.png",
        });
      } catch {
        // Algunos navegadores móviles bloquean Notification directa.
      }
    }
  }, [paymentPendingReminder, elapsedMinutes, autoCancelMinutes]);

  async function handleFileChange(file: File | undefined) {
    setFormError(null);

    if (!file) {
      setDataUrl("");
      setFileName("");
      setMimeType("");
      return;
    }

    // Se comprime EN el teléfono antes de subir: las fotos de cámara (4–12 MB,
    // o HEIC en iPhone) pasan a un JPEG liviano que sube rápido aunque la
    // señal esté mala. Ver lib/clientImage.
    try {
      const image = await readImageFileForUpload(file, {
        fallbackName: "comprobante",
      });
      setDataUrl(image.dataUrl);
      setFileName(image.fileName);
      setMimeType(image.mimeType);
    } catch (error) {
      setDataUrl("");
      setFileName("");
      setMimeType("");
      setFormError(
        error instanceof Error
          ? error.message
          : "No se pudo leer la imagen del comprobante.",
      );
    }
  }

  // Segunda captura del pago mixto (una por cada pata).
  async function handleFileChange2(file: File | undefined) {
    setFormError(null);

    if (!file) {
      setDataUrl2("");
      setFileName2("");
      setMimeType2("");
      return;
    }

    try {
      const image = await readImageFileForUpload(file, {
        fallbackName: "comprobante-2",
      });
      setDataUrl2(image.dataUrl);
      setFileName2(image.fileName);
      setMimeType2(image.mimeType);
    } catch (error) {
      setDataUrl2("");
      setFileName2("");
      setMimeType2("");
      setFormError(
        error instanceof Error
          ? error.message
          : "No se pudo leer la segunda imagen del comprobante.",
      );
    }
  }

  // Monto prellenado en LA MONEDA del método: pago móvil/punto → Bs (con la
  // tasa del pedido); Zelle/efectivo divisas → $.
  function buildPrefilledEntry(methodName: string, amountUSDToCover: number): PaymentEntry {
    if (amountUSDToCover <= 0) {
      return { method: methodName, amountUSD: "", amountVES: "" };
    }

    const rate = Number(info?.exchangeRate || 0);
    if (isVesPaymentMethod(methodName) && rate > 0) {
      return {
        method: methodName,
        amountUSD: "",
        amountVES: (Math.round(amountUSDToCover * rate * 100) / 100).toFixed(2),
      };
    }

    return {
      method: methodName,
      amountUSD: amountUSDToCover.toFixed(2),
      amountVES: "",
    };
  }

  // Precarga del formulario: un bloque por método elegido al pedir, CON su
  // monto (lote v6.1). La fuente preferida son las patas que calcula el
  // servidor desde el pedido (expectedPayments: método + monto por pata,
  // también en mixto); si aún no cargaron, se usan los métodos guardados en
  // el dispositivo y el total.
  function buildInitialPayments(): PaymentEntry[] {
    const expected = info?.expectedPayments || [];
    if (expected.length > 0) {
      return expected.map((leg) => ({
        method: leg.method,
        amountUSD: leg.currency === "USD" ? leg.amount.toFixed(2) : "",
        amountVES: leg.currency === "VES" ? leg.amount.toFixed(2) : "",
      }));
    }

    const chosen = chosenMethods.filter(Boolean);
    const totalUSD = Number(info?.totalUSD || 0);

    if (chosen.length === 0) {
      return [{ ...EMPTY_PAYMENT_ENTRY, amountUSD: totalUSD > 0 ? totalUSD.toFixed(2) : "" }];
    }

    if (chosen.length === 1) {
      return [buildPrefilledEntry(chosen[0], totalUSD)];
    }

    // Varios métodos sin patas del servidor: montos vacíos para repartir
    // (el botón "Completar" ayuda con el faltante).
    return chosen.map((methodName) => ({ method: methodName, amountUSD: "", amountVES: "" }));
  }

  // USD equivalente ya cargado en los demás bloques (para "Completar").
  function getCoveredUSDExcept(excludeIndex: number) {
    const rate = Number(info?.exchangeRate || 0);
    return payments.reduce((total, entry, index) => {
      if (index === excludeIndex) return total;
      const usd = normalizeMoneyInput(entry.amountUSD);
      const ves = normalizeMoneyInput(entry.amountVES);
      return total + usd + (rate > 0 ? ves / rate : 0);
    }, 0);
  }

  // "Completar": llena el bloque con lo que falta para cubrir lo que
  // corresponde reportar (el total, o las patas electrónicas en mixto), en la
  // moneda del método elegido.
  function completeEntryAmount(index: number) {
    const requiredUSD = Number(info?.requiredReportUSD ?? 0);
    const totalUSD = requiredUSD > 0 ? requiredUSD : Number(info?.totalUSD || 0);
    if (totalUSD <= 0) return;

    const remainingUSD = Math.max(totalUSD - getCoveredUSDExcept(index), 0);
    const prefilled = buildPrefilledEntry(payments[index]?.method || "", remainingUSD);

    updatePaymentEntry(index, {
      amountUSD: prefilled.amountUSD,
      amountVES: prefilled.amountVES,
    });
  }

  function updatePaymentEntry(index: number, patch: Partial<PaymentEntry>) {
    setPayments((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    );
  }

  // Cambia el método de un bloque y limpia el monto en la moneda que ya no
  // aplica (bolívares → borra $, divisas → borra Bs), para no reportar un monto
  // en la moneda equivocada. El botón "Completar lo que falta" rellena el resto.
  function changePaymentEntryMethod(index: number, nextMethod: string) {
    setPayments((current) =>
      current.map((entry, entryIndex) => {
        if (entryIndex !== index) return entry;
        if (isVesPaymentMethod(nextMethod)) return { ...entry, method: nextMethod, amountUSD: "" };
        if (nextMethod.trim() !== "") return { ...entry, method: nextMethod, amountVES: "" };
        return { ...entry, method: nextMethod };
      }),
    );
  }

  async function submitProof(confirmDuplicate = false, confirmPartial = false) {
    const hasProofOrReference = Boolean(dataUrl) || reference.trim().length > 0;
    // Lo que corresponde reportar por vía electrónica: la(s) pata(s) que
    // eligió el cliente (en mixto, la parte en efectivo se entrega en mano).
    const requiredBaseUSD = Number(info?.requiredReportUSD ?? info?.totalUSD ?? 0);
    const totalUSDForAssume =
      requiredBaseUSD > 0 ? requiredBaseUSD : Number(info?.totalUSD || 0);
    const rateForAssume = Number(info?.exchangeRate || 0);

    let entries = payments
      .map((entry) => ({
        method: entry.method.trim(),
        usd: normalizeMoneyInput(entry.amountUSD),
        ves: normalizeMoneyInput(entry.amountVES),
      }))
      .filter((entry) => entry.method || entry.usd > 0 || entry.ves > 0);

    let reportedUSD = entries.reduce((total, entry) => total + entry.usd, 0);
    let reportedVES = entries.reduce((total, entry) => total + entry.ves, 0);

    // Captura/referencia SIN monto escrito: si el cliente solo adjuntó su
    // comprobante (caso común, sobre todo de tercera edad), asumimos que pagó
    // el TOTAL del pedido con el método preseleccionado, en su moneda. Así la
    // captura sola + método siempre pasa (pedido del dueño 2026-07-22) en vez
    // de trabar el envío pidiendo el monto.
    if (
      reportedUSD <= 0 &&
      reportedVES <= 0 &&
      hasProofOrReference &&
      totalUSDForAssume > 0
    ) {
      const assumedMethod =
        entries[0]?.method || payments[0]?.method?.trim() || chosenMethods[0] || "";
      if (isVesPaymentMethod(assumedMethod) && rateForAssume > 0) {
        entries = [
          {
            method: assumedMethod,
            usd: 0,
            ves: Math.round(totalUSDForAssume * rateForAssume * 100) / 100,
          },
        ];
      } else {
        entries = [{ method: assumedMethod, usd: totalUSDForAssume, ves: 0 }];
      }
      reportedUSD = entries[0].usd;
      reportedVES = entries[0].ves;
    }

    // Resumen por método para caja: "Zelle ($10.00) + Pago móvil (Bs 500,00)".
    const reportedMethod = entries
      .map((entry) => {
        const parts: string[] = [];
        if (entry.usd > 0) parts.push(formatUSD(entry.usd));
        if (entry.ves > 0) parts.push(`Bs ${formatVES(entry.ves)}`);
        if (!entry.method) return parts.join(" + ");
        return parts.length ? `${entry.method} (${parts.join(" + ")})` : entry.method;
      })
      .filter(Boolean)
      .join(" + ");

    // La captura es lo ideal, pero la referencia de la operación alcanza para
    // que caja verifique el pago.
    if (!dataUrl && !reference.trim()) {
      setFormError("Adjunta la captura del pago o escribe la referencia completa de la operación.");
      return;
    }

    // Referencia completa: con 3-4 dígitos caja no puede ubicar la operación
    // en el banco (pedido del dueño 2026-07-21).
    const referenceDigits = reference.replace(/[^0-9]/g, "");
    if (reference.trim() && referenceDigits.length < 6) {
      setFormError(
        "Escribe la referencia completa de la operación (todos los dígitos, no solo los últimos).",
      );
      return;
    }

    if (reportedUSD <= 0 && reportedVES <= 0) {
      setFormError("Indica el monto que pagaste (en $ o en Bs).");
      return;
    }

    // Cobertura OBLIGATORIA (lote v6.1, pedido del dueño): lo reportado debe
    // cubrir completo lo que corresponde pagar por vía electrónica — el total
    // del pedido, o la suma exacta de las patas si eligió 2 métodos. Si falta,
    // NO se deja enviar (los abonos a medias confundían a caja). Reportar de
    // más sí se puede confirmar (bancos que redondean).
    const rate = Number(info?.exchangeRate || 0);
    if (requiredBaseUSD > 0 && (reportedVES <= 0 || rate > 0)) {
      const reportedEquivalentUSD = reportedUSD + (rate > 0 ? reportedVES / rate : 0);
      const missingUSD = Math.round((requiredBaseUSD - reportedEquivalentUSD) * 100) / 100;

      if (missingUSD > 0.05) {
        setCoverageWarning(null);
        setFormError(
          `El monto no cubre lo que corresponde pagar: faltan ${formatUSD(missingUSD)}${
            rate > 0 ? ` (Bs ${formatVES(missingUSD * rate)})` : ""
          } para completar ${formatUSD(requiredBaseUSD)}. Toca "Completar" o corrige el monto: no se puede enviar incompleto.`,
        );
        return;
      }

      if (!confirmPartial && missingUSD < -0.05) {
        setFormError(null);
        setCoverageWarning(
          `Estás reportando ${formatUSD(Math.abs(missingUSD))} de MÁS de lo que corresponde (${formatUSD(requiredBaseUSD)}). Revisa el monto; si de verdad pagaste eso, confírmalo abajo.`,
        );
        return;
      }
    }
    setCoverageWarning(null);

    try {
      setIsSubmitting(true);
      setFormError(null);
      setDuplicateWarning(null);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      // El pedido sabe a qué sede pertenece: el comprobante viaja a ella
      // aunque el cliente abra el link en otro teléfono.
      if (info?.branchId) headers["x-branch-id"] = info.branchId;

      const response = await fetch("/api/payment-proofs", {
        method: "POST",
        headers,
        body: JSON.stringify({
          orderId,
          reportedMethod,
          amountReportedUSD: reportedUSD,
          amountReportedVES: reportedVES,
          paymentReference: reference,
          customerNote,
          dataUrl,
          fileName,
          mimeType,
          // Segunda captura solo en pago mixto (2+ métodos) y si el dueño la
          // dejó habilitada.
          dataUrl2: isMixedReport && allowSecondProof ? dataUrl2 : "",
          fileName2: isMixedReport && allowSecondProof ? fileName2 : "",
          mimeType2: isMixedReport && allowSecondProof ? mimeType2 : "",
          confirmDuplicate,
        }),
      });
      const data = await response.json();

      if (response.status === 409 && data.duplicate) {
        setDuplicateWarning(
          data.error ||
            "Ya reportaste un pago para este pedido. ¿Quieres enviar otro de todas formas?",
        );
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "No se pudo enviar el comprobante");
      }

      setSuccessMessage(
        "¡Pago reportado! Caja lo revisará y aquí verás cuando quede confirmado.",
      );
      onReported?.();
      setIsFormOpen(false);
      setPayments([EMPTY_PAYMENT_ENTRY]);
      setCoverageWarning(null);
      setReference("");
      setCustomerNote("");
      setDataUrl("");
      setFileName("");
      setMimeType("");
      setDataUrl2("");
      setFileName2("");
      setMimeType2("");
      await loadInfo();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "No se pudo enviar el comprobante",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // Disponibilidad del reporte: manda el prop del contenedor (fuente única);
  // solo si no vino, se usa el fetch propio del hijo como respaldo.
  const proofsAvailable = proofsEnabled !== undefined ? proofsEnabled : isProofsEnabled;
  // IMPORTANTE: no se retorna null por `!info`. Si /order-payment no cargó
  // (mala señal, timeout), antes la sección desaparecía y "Reportar pago" no
  // abría NADA. Ahora se muestra igual con datos en cero: el cliente puede
  // adjuntar su captura/referencia y enviarla. Reportar pago NUNCA es un
  // callejón sin salida.
  if (isLoading || !proofsAvailable) return null;
  // Pedido anulado: nunca pedirle plata a un pedido muerto (el padre muestra
  // el aviso rojo de cancelación).
  if (info && info.orderStatus === "Cancelado") return null;

  return (
    <div className="mt-4 rounded-[2rem] border-4 border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6">
      <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--brand-primary)]">
        <ReceiptText size={15} />
        Pago del pedido
      </p>

      {hasConfirmedPayment ? (
        <p className="mt-4 inline-flex w-full items-center gap-2 rounded-2xl border-2 border-green-600 bg-green-600/15 px-4 py-3 text-sm font-black leading-5 text-green-400">
          <CheckCircle2 size={17} className="shrink-0" />
          Pago confirmado por el negocio. ¡Gracias!
        </p>
      ) : null}

      {/* Recordatorio: sin pago reportado el pedido no entra a cocina. Se
          vuelve más insistente con los minutos (5/10/15/20) y muestra el
          contador de anulación automática si el dueño la activó. */}
      {paymentPendingReminder && !isFormOpen ? (
        <p
          role="alert"
          className={`mt-4 flex w-full items-start gap-2 rounded-2xl border-[3px] px-4 py-3 text-sm font-black leading-5 ${
            elapsedMinutes >= 10
              ? "border-red-500 bg-red-500/10 text-red-400"
              : "border-amber-500 bg-amber-500/10 text-amber-500"
          }`}
        >
          <Clock3 size={17} className="mt-0.5 shrink-0 animate-pulse" />
          <span>
            {elapsedMinutes >= 5
              ? `Llevas ${elapsedMinutes} minutos sin reportar tu pago. `
              : "Aún no has reportado tu pago. "}
            Cancela (paga) con los datos de abajo y toca «Reportar mi pago»
            para que tu pedido entre a preparación.
            {autoCancelMinutes > 0 ? (
              <span className="mt-1 block text-[0.8rem]">
                {Math.max(0, autoCancelMinutes - elapsedMinutes) > 0
                  ? `Si no lo reportas, el pedido se anula solo en ${Math.max(0, autoCancelMinutes - elapsedMinutes)} min.`
                  : "El pedido puede anularse en cualquier momento por falta de pago."}
              </span>
            ) : null}
          </span>
        </p>
      ) : null}

      {/* Falta la parte ELECTRÓNICA del mixto (solo llegó la foto del
          efectivo): pedirla con nombre y monto, no dar el pago por hecho. */}
      {!hasConfirmedPayment && hasPendingProof && !reportCovered ? (
        <p
          role="alert"
          className="mt-4 rounded-2xl border-[3px] border-amber-500 bg-amber-500/10 px-4 py-3 text-sm font-black leading-5 text-amber-500"
        >
          📸 Recibimos la foto de tu efectivo. Falta la captura o referencia de
          la parte electrónica
          {(info?.expectedPayments || []).length
            ? ` (${(info?.expectedPayments || [])
                .map((payment) =>
                  payment.currency === "VES"
                    ? `${payment.method}: Bs ${formatVES(payment.amount)}`
                    : `${payment.method}: ${formatUSD(payment.amount)}`,
                )
                .join(" + ")})`
            : ` (~${formatUSD(pendingElectronicUSD)})`}
          . Repórtala aquí abajo para que tu pedido avance.
        </p>
      ) : null}

      {/* Con el pago YA reportado COMPLETO y en revisión, los datos para
          pagar y el CTA de reportar sobran: solo se muestra el estado del
          comprobante. Si el negocio pide corrección (o falta una pata),
          vuelven a aparecer. */}
      {!hasConfirmedPayment &&
        (!hasPendingProof || needsCorrection || !reportCovered) &&
        (() => {
          const filtered = chosenMethods.length
            ? Object.fromEntries(
                Object.entries(paymentMethodDetails).filter(([methodName]) =>
                  chosenMethods.includes(methodName),
                ),
              )
            : paymentMethodDetails;
          const visibleDetails = Object.keys(filtered).length
            ? filtered
            : paymentMethodDetails;

          if (!Object.keys(visibleDetails).length) return null;

          return (
            <div className="mt-4 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-4 py-4 text-left">
              <span className="inline-flex rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-black">
                Paso 1
              </span>
              <p className="mt-2 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]">
                Paga con estos datos
                {chosenMethods.length > 0 && (
                  <span className="text-[var(--brand-ink-2)]/45">
                    {" "}
                    ({chosenMethods.join(" + ")})
                  </span>
                )}
              </p>
              {(info?.totalUSD ?? 0) > 0 ? (
                <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/75">
                  Total a pagar:{" "}
                  {formatChosenTotal(
                    info ?? { totalUSD: 0, exchangeRate: 0 },
                    chosenMethods,
                  )}
                </p>
              ) : null}
              <div className="mt-2">
                <PaymentMethodDetailsList details={visibleDetails} />
              </div>
            </div>
          );
        })()}

      {(info?.proofs?.length ?? 0) > 0 && (
        <div className="mt-4 space-y-2">
          {(info?.proofs ?? []).map((proof, index) => {
            const chip = proofStatusChip(proof.status);
            return (
              <div
                key={`${proof.createdAt}-${index}`}
                className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-4 py-3 text-left"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.1em] ${chip.classes}`}
                  >
                    {chip.icon}
                    {chip.label}
                  </span>
                  <span className="text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
                    {formatDateTime(proof.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-black text-[var(--brand-ink-3)]">
                  {proof.amountReportedUSD > 0 &&
                    formatUSD(proof.amountReportedUSD)}
                  {proof.amountReportedUSD > 0 && proof.amountReportedVES > 0
                    ? " + "
                    : ""}
                  {proof.amountReportedVES > 0 &&
                    `Bs ${formatVES(proof.amountReportedVES)}`}
                  {proof.reportedMethod ? ` · ${proof.reportedMethod}` : ""}
                </p>
                {proof.paymentReference ? (
                  <p className="mt-1 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/55">
                    Ref: {proof.paymentReference}
                  </p>
                ) : null}
                {proof.status === "Necesita corrección" && proof.internalNote ? (
                  <p className="mt-2 rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-[0.72rem] font-bold leading-4 text-orange-400">
                    El negocio pide corregir: {proof.internalNote}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {hasPendingProof && !hasConfirmedPayment && reportCovered ? (
        <p className="mt-3 text-[0.72rem] font-bold leading-5 text-[var(--brand-ink-2)]/60">
          Tu pago ya fue reportado y está en revisión: no hace falta enviarlo
          otra vez. Aquí verás cuando quede confirmado.
        </p>
      ) : null}

      {successMessage && (
        <>
          <p className="mt-3 rounded-2xl border-2 border-green-600 bg-green-600/15 px-4 py-3 text-sm font-black leading-5 text-green-400">
            {successMessage}
          </p>
          {showTrackingLink ? (
            <a
              href={`/pedido/${orderId}`}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3.5 text-xs font-black uppercase tracking-[0.12em] text-black transition hover:opacity-90"
            >
              <CheckCircle2 size={16} />
              Ver el avance de mi pedido
            </a>
          ) : null}
        </>
      )}

      {!hasConfirmedPayment && !isFormOpen && (!hasPendingProof || !reportCovered) ? (
        <span className="mt-4 inline-flex rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-black">
          Paso 2
        </span>
      ) : null}

      {!hasConfirmedPayment && !isFormOpen ? (
        hasPendingProof && !needsCorrection && reportCovered ? (
          requiredElectronicUSD <= 0 ? null : (
          // Reportado y en revisión: nada que hacer. Solo un enlace discreto
          // por si adjuntó la captura equivocada. En efectivo PURO ni eso:
          // no hay captura electrónica que corregir (dueño 2026-07-23).
          <button
            type="button"
            onClick={() => {
              setIsFormOpen(true);
              setSuccessMessage(null);
              setPayments(buildInitialPayments());
            }}
            className="mt-3 w-full rounded-full px-4 py-2 text-[0.66rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/45 transition hover:text-[var(--brand-ink-2)]"
          >
            ¿Enviaste la captura equivocada? Reportar de nuevo
          </button>
          )
        ) : (
          <button
            type="button"
            onClick={() => {
              setIsFormOpen(true);
              setSuccessMessage(null);
              setPayments(buildInitialPayments());
            }}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-black transition hover:opacity-90"
          >
            <ImagePlus size={15} />
            {needsCorrection
              ? "Enviar otro comprobante"
              : hasPendingProof && !reportCovered
                ? "Reportar la parte electrónica"
                : "Reportar mi pago"}
          </button>
        )
      ) : null}

      {isFormOpen && (
        <div className="mt-4 space-y-3 text-left">
          {/* Cambió el método respecto a lo que eligió al pedir: se puede
              (si el dueño lo permite), con la condición de cubrir el total. */}
          {chosenMethods.length > 0 &&
          payments.some(
            (entry) => entry.method && !chosenMethods.includes(entry.method),
          ) ? (
            <p className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-4 py-3 text-[0.72rem] font-bold leading-5 text-[var(--brand-ink-2)]/70">
              Al pedir indicaste {chosenMethods.join(" + ")}. Puedes cambiar el
              método sin problema, siempre que el pago cubra el total del
              pedido.
            </p>
          ) : null}
          {payments.map((entry, index) => (
            <div
              key={`payment-entry-${index}`}
              className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/25 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <label className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                  {payments.length > 1 ? `Método ${index + 1}` : "¿Cómo pagaste?"}
                </label>
                {payments.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPayments((current) =>
                        current.filter((_, entryIndex) => entryIndex !== index),
                      )
                    }
                    className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/50 transition hover:text-red-400"
                  >
                    Quitar
                  </button>
                )}
              </div>
              <select
                value={entry.method}
                onChange={(event) => changePaymentEntryMethod(index, event.target.value)}
                disabled={!allowMethodChange && chosenMethods.length > 0}
                className="mt-1.5 w-full rounded-2xl border-2 border-[var(--brand-primary)]/40 bg-white px-4 py-3 text-sm font-bold text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/45 focus:border-[var(--brand-primary)] disabled:opacity-60"
              >
                <option value="">Selecciona el método</option>
                {!paymentMethods.includes(entry.method) && entry.method ? (
                  <option value={entry.method}>{entry.method}</option>
                ) : null}
                {paymentMethods.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              {(() => {
                // Muestra el monto en la moneda del método: bolívares → solo Bs,
                // divisas → solo $. Sin método elegido aún, muestra ambos.
                const methodChosen = entry.method.trim() !== "";
                const entryIsVes = isVesPaymentMethod(entry.method);
                const showUSD = !methodChosen || !entryIsVes;
                const showVES = !methodChosen || entryIsVes;

                return (
                  <div className={`mt-2 grid gap-2 ${methodChosen ? "grid-cols-1" : "grid-cols-2"}`}>
                    {showUSD && (
                      <div>
                        <label className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                          Monto $
                        </label>
                        <input
                          value={entry.amountUSD}
                          onChange={(event) =>
                            updatePaymentEntry(index, { amountUSD: event.target.value })
                          }
                          inputMode="decimal"
                          placeholder="0.00"
                          className="mt-1.5 w-full rounded-2xl border-2 border-[var(--brand-primary)]/40 bg-white px-4 py-3 text-sm font-bold text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/45 focus:border-[var(--brand-primary)]"
                        />
                      </div>
                    )}
                    {showVES && (
                      <div>
                        <label className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                          Monto Bs
                        </label>
                        <input
                          value={entry.amountVES}
                          onChange={(event) =>
                            updatePaymentEntry(index, { amountVES: event.target.value })
                          }
                          inputMode="decimal"
                          placeholder="0,00"
                          className="mt-1.5 w-full rounded-2xl border-2 border-[var(--brand-primary)]/40 bg-white px-4 py-3 text-sm font-bold text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/45 focus:border-[var(--brand-primary)]"
                        />
                        {(() => {
                          // El monto en Bs también en dólares, con la tasa
                          // del pedido (pago móvil "en dólares" a la vista).
                          const rate = Number(info?.exchangeRate || 0);
                          const ves = normalizeMoneyInput(entry.amountVES);
                          if (rate <= 0 || ves <= 0) return null;
                          return (
                            <p className="mt-1 text-[0.68rem] font-bold text-[var(--brand-ink-2)]/60">
                              ≈ {formatUSD(ves / rate)} en dólares (tasa del pedido)
                            </p>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })()}

              {(info?.totalUSD ?? 0) > 0 ? (
                <button
                  type="button"
                  onClick={() => completeEntryAmount(index)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--brand-primary)]/50 px-3.5 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.1em] text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary)]/10"
                >
                  <CheckCircle2 size={13} />
                  Completar lo que falta
                </button>
              ) : null}
            </div>
          ))}

          {payments.length < 3 && (allowMethodChange || chosenMethods.length === 0) && (
            <button
              type="button"
              onClick={() =>
                setPayments((current) => [...current, { ...EMPTY_PAYMENT_ENTRY }])
              }
              className="w-full rounded-full border-2 border-dashed border-[var(--brand-border)] px-4 py-2.5 text-[0.68rem] font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/60 transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
            >
              + Pagué con otro método también
            </button>
          )}

          <div>
            <label className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
              Referencia completa (opcional si adjuntas la captura)
            </label>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Todos los dígitos de la operación"
              className="mt-1.5 w-full rounded-2xl border-2 border-[var(--brand-primary)]/40 bg-white px-4 py-3 text-sm font-bold text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/45 focus:border-[var(--brand-primary)]"
            />
          </div>

          <div>
            <label className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
              {isMixedReport && allowSecondProof
                ? "Captura del PRIMER pago (opcional si pones la referencia)"
                : "Captura del pago (opcional si pones la referencia)"}
            </label>
            <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/50 bg-white px-4 py-4 text-sm font-bold text-[#1a1a1a]/80 transition hover:border-[var(--brand-primary)]">
              <ImagePlus size={17} />
              {fileName || "Toca para adjuntar la imagen"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handleFileChange(event.target.files?.[0])}
              />
            </label>
          </div>

          {/* Segunda captura: solo en pago mixto (una por cada pata, ej. pago
              móvil + Zelle) y si el dueño la dejó habilitada. */}
          {isMixedReport && allowSecondProof ? (
            <div>
              <label className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                Captura del SEGUNDO pago (opcional)
              </label>
              <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/50 bg-white px-4 py-4 text-sm font-bold text-[#1a1a1a]/80 transition hover:border-[var(--brand-primary)]">
                <ImagePlus size={17} />
                {fileName2 || "Toca para adjuntar la segunda imagen"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handleFileChange2(event.target.files?.[0])}
                />
              </label>
              <p className="mt-1.5 text-[0.68rem] font-bold leading-4 text-[var(--brand-ink-2)]/60">
                Pagaste con dos métodos: adjunta una captura por cada uno (por
                ejemplo, una del pago móvil y otra del Zelle).
              </p>
            </div>
          ) : null}

          <div>
            <label className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
              Nota (opcional)
            </label>
            <input
              value={customerNote}
              onChange={(event) => setCustomerNote(event.target.value)}
              placeholder="Ejemplo: pagó mi mamá desde su cuenta"
              className="mt-1.5 w-full rounded-2xl border-2 border-[var(--brand-primary)]/40 bg-white px-4 py-3 text-sm font-bold text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/45 focus:border-[var(--brand-primary)]"
            />
          </div>

          {formError && (
            <p className="rounded-2xl border-2 border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-bold leading-5 text-red-400">
              {formError}
            </p>
          )}

          {duplicateWarning && (
            <div className="rounded-2xl border-2 border-yellow-500/60 bg-yellow-500/10 px-4 py-3">
              <p className="text-sm font-bold leading-5 text-yellow-500">
                {duplicateWarning}
              </p>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => submitProof(true, true)}
                className="mt-2 inline-flex items-center gap-2 rounded-full border-2 border-yellow-500 px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.1em] text-yellow-500 transition hover:bg-yellow-500/10 disabled:opacity-50"
              >
                Sí, enviar de todas formas
              </button>
            </div>
          )}

          {coverageWarning && (
            <div className="rounded-2xl border-2 border-yellow-500/60 bg-yellow-500/10 px-4 py-3">
              <p className="text-sm font-bold leading-5 text-yellow-500">
                {coverageWarning}
              </p>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => submitProof(false, true)}
                className="mt-2 inline-flex items-center gap-2 rounded-full border-2 border-yellow-500 px-4 py-2 text-[0.68rem] font-black uppercase tracking-[0.1em] text-yellow-500 transition hover:bg-yellow-500/10 disabled:opacity-50"
              >
                Sí pagué ese monto, enviar así
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => submitProof(false)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              Enviar comprobante
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setIsFormOpen(false);
                setFormError(null);
                setDuplicateWarning(null);
                setCoverageWarning(null);
              }}
              className="rounded-full border-2 border-[var(--brand-border)] px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/60 transition hover:border-[var(--brand-primary)] disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
