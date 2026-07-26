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

// Parser y formateador de montos: viven en @/lib/publicMoneyInput con tests
// propios (el de aquí no entendía separador de miles y "9.648,99" daba 0).
import {
  parsePublicMoneyInput as normalizeMoneyInput,
  toVesInputAmount,
} from "@/lib/publicMoneyInput";

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
// Va PARTIDO en dos: `main` es el monto que el cliente debe pagar (se pinta
// grande, como el "Tienes que pagar" del checkout) y `secondary` la referencia
// en la otra moneda, chica debajo. Antes todo iba en una línea de 14px peso 700
// y el dinero pesaba menos que etiquetas como "AGREGAR UNA NOTA" (2026-07-26).
function formatChosenTotal(
  info: { totalUSD: number; exchangeRate: number },
  chosenMethods: string[],
): { main: string; secondary: string } {
  const vesChosen = chosenMethods.some((methodName) => isVesPaymentMethod(methodName));
  const usdChosen = chosenMethods.some((methodName) => !isVesPaymentMethod(methodName));
  const totalVES = info.totalUSD * info.exchangeRate;
  const canShowVES = vesChosen && info.exchangeRate > 0 && totalVES > 0;

  // Siempre con la referencia en dólares al lado (pedido del dueño: que el
  // pago móvil también se entienda en $).
  if (canShowVES && !usdChosen)
    return {
      main: `Bs ${formatVES(totalVES)}`,
      secondary: `≈ ${formatUSD(info.totalUSD)} · tasa del pedido`,
    };
  if (canShowVES && usdChosen)
    // Mixto: el cliente paga parte en $ y parte en Bs, así que NO va "si pagas
    // en bolívares" (daba a entender uno u otro). El equivalente del total es
    // cierto en cualquier reparto.
    return {
      main: formatUSD(info.totalUSD),
      secondary: `equivale a Bs ${formatVES(totalVES)}`,
    };
  return { main: formatUSD(info.totalUSD), secondary: "" };
}


export default function PublicOrderPaymentSection({
  orderId,
  autoOpenForm = false,
  forceOpenSignal = 0,
  proofsEnabled,
  onReported,
  showTrackingLink = false,
  refreshSignal = 0,
  expectProofPending = false,
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
  // Sube cuando el checkout terminó de subir un comprobante (foto de billetes
  // o captura): recarga la info AL INSTANTE en vez de esperar el sondeo de
  // 45s — el cliente veía un flash del estado viejo (dueño 2026-07-23).
  refreshSignal?: number;
  // true = el checkout subió (o está subiendo) un comprobante: si la info aún
  // no lo trae, se muestra "registrando tu comprobante" en vez del estado
  // genérico viejo.
  expectProofPending?: boolean;
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
  // La nota es opcional y casi nadie la usa: vive detrás de una casilla.
  const [wantsNote, setWantsNote] = useState(false);
  // Igual la referencia: la mayoría solo adjunta la captura.
  const [wantsReference, setWantsReference] = useState(false);
  // true entre "reporte enviado OK" y "la info ya lo trae": evita pintar el
  // estado anterior un instante (flash de versión vieja).
  const [syncingAfterReport, setSyncingAfterReport] = useState(false);
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
  // Contenedor de los mensajes de error/aviso, para traerlos a la vista.
  const messagesRef = useRef<HTMLDivElement | null>(null);

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

  // Recarga inmediata cuando el checkout termina de subir un comprobante
  // (foto de billetes / captura): sin esto, el cliente veía por hasta 45s el
  // estado ANTERIOR a su envío (parecía "una versión vieja de la página").
  // Trae el mensaje a la vista en cuanto aparece. Con la fila de botones pegada
  // abajo, el cliente puede enviar desde cualquier punto del formulario y el
  // mensaje quedaba fuera del viewport: se veía como que el botón no respondía.
  useEffect(() => {
    if (!formError && !duplicateWarning && !coverageWarning) return;
    const node = messagesRef.current;
    if (!node) return;
    const timer = setTimeout(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
    return () => clearTimeout(timer);
  }, [formError, duplicateWarning, coverageWarning]);

  useEffect(() => {
    if (!refreshSignal) return;
    // Diferido un tick para no hacer setState síncrono dentro del efecto
    // (react-hooks/set-state-in-effect), igual que los demás de este archivo.
    const timer = setTimeout(() => {
      void loadInfo();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshSignal, loadInfo]);

  // El checkout dice que subió un comprobante pero la info aún no lo trae:
  // ventana de sincronización (subida en curso o consulta por refrescar).
  // syncingAfterReport cubre lo mismo para el reporte MANUAL recién enviado.
  const awaitingProofSync =
    syncingAfterReport ||
    (expectProofPending && !hasConfirmedPayment && activeProofs.length === 0);

  // Mientras dura esa ventana, sondeo corto para engancharlo apenas exista.
  useEffect(() => {
    if (!awaitingProofSync || isLoading) return;
    const timer = window.setInterval(() => {
      void loadInfo();
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [awaitingProofSync, isLoading, loadInfo]);

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
        amountVES: toVesInputAmount(
          Math.round(amountUSDToCover * rate * 100) / 100,
        ),
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
        amountVES: leg.currency === "VES" ? toVesInputAmount(leg.amount) : "",
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

    // Varios métodos sin patas del servidor: montos vacíos para que el cliente
    // reparta a mano (el servidor casi siempre manda las patas ya calculadas).
    return chosen.map((methodName) => ({ method: methodName, amountUSD: "", amountVES: "" }));
  }

  // (El botón "Completar lo que falta" se retiró: los montos ya llegan
  // precargados con la pata exacta — dueño 2026-07-23. Con él se fue
  // getCoveredUSDExcept(), que solo lo usaba ese botón.)

  function updatePaymentEntry(index: number, patch: Partial<PaymentEntry>) {
    setPayments((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    );
  }

  // Cambia el método de un bloque y limpia el monto en la moneda que ya no
  // aplica (bolívares → borra $, divisas → borra Bs), para no reportar un monto
  // en la moneda equivocada.
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
    //
    // La SEGUNDA captura también cuenta: en pago mixto, quien adjuntaba solo la
    // del segundo método recibía "Adjunta la captura del pago" con una captura
    // ya puesta y no tenía salida (2026-07-26). Se cuenta únicamente si de
    // verdad va a viajar — mismo condicional que el envío más abajo — para no
    // dejar pasar un reporte sin comprobante.
    const sendsSecondProof = isMixedReport && allowSecondProof && Boolean(dataUrl2);
    if (!dataUrl && !sendsSecondProof && !reference.trim()) {
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
          } para completar ${formatUSD(requiredBaseUSD)}. Corrige el monto de arriba: no se puede enviar incompleto.`,
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
      // Mientras la info se recarga con el reporte nuevo, la sección muestra
      // "actualizando" en vez del estado ANTERIOR (flash de versión vieja,
      // dueño 2026-07-23 v2).
      setSyncingAfterReport(true);
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
      setSyncingAfterReport(false);
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
      {/* El comprobante del checkout va en camino: ni regaño ni datos viejos
          — un "registrando…" hasta que la consulta lo traiga (4s máx). */}
      {awaitingProofSync ? (
        <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-4 py-3 text-sm font-black leading-5 text-[var(--brand-ink-2)]/75">
          <Loader2 size={16} className="animate-spin text-[var(--brand-primary)]" />
          Registrando tu comprobante…
        </p>
      ) : null}

      {paymentPendingReminder && !awaitingProofSync && !isFormOpen ? (
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

      {/* Con el pago YA reportado COMPLETO y en revisión, los datos para
          pagar y el CTA de reportar sobran: solo se muestra el estado del
          comprobante. Si el negocio pide corrección (o falta una pata),
          vuelven a aparecer. Con la pata electrónica pendiente (llegó solo la
          foto del efectivo) la MISMA tarjeta se vuelve el aviso: título
          "Falta registrar la parte de X", datos SOLO de ese método y el monto
          de ESA pata — un solo mensaje, sin banner aparte (dueño 2026-07-23). */}
      {!hasConfirmedPayment &&
        !awaitingProofSync &&
        (!hasPendingProof || needsCorrection || !reportCovered) &&
        (() => {
          const isPartialPending = hasPendingProof && !reportCovered;
          const electronicLegs = (info?.expectedPayments || []).filter(
            (payment) => !isCashReportedMethod(payment.method),
          );
          const cardMethods = isPartialPending && electronicLegs.length
            ? electronicLegs.map((payment) => payment.method)
            : chosenMethods;

          const filtered = cardMethods.length
            ? Object.fromEntries(
                Object.entries(paymentMethodDetails).filter(([methodName]) =>
                  cardMethods.includes(methodName),
                ),
              )
            : paymentMethodDetails;
          // Mostrar TODOS los métodos cuando el filtro queda vacío es una red de
          // seguridad a propósito: si el nombre elegido no coincide exacto con la
          // clave configurada (acentos, mayúsculas), sin ella el cliente se queda
          // sin saber dónde pagar. Pero NO aplica al efectivo: ahí no hay datos
          // que mostrar y salían los del banco de TODOS los métodos (pagando en
          // efectivo el cliente veía Zelle + pago móvil + transferencia, 2026-07-26).
          const onlyCashChosen =
            cardMethods.length > 0 &&
            cardMethods.every((methodName) => isCashReportedMethod(methodName));
          const visibleDetails = Object.keys(filtered).length
            ? filtered
            : onlyCashChosen
              ? {}
              : paymentMethodDetails;

          // Patas en efectivo: se entregan en mano, NO se transfieren.
          const cashLegs = (info?.expectedPayments || []).filter((payment) =>
            isCashReportedMethod(payment.method),
          );
          const hasCashLeg = cashLegs.length > 0;
          const hasElectronicLeg = electronicLegs.length > 0;
          const legsLabel = (legs: ExpectedPayment[]) =>
            legs
              .map((payment) =>
                payment.currency === "VES"
                  ? `Bs ${formatVES(payment.amount)}`
                  : formatUSD(payment.amount),
              )
              .join(" + ");

          const hasDetails = Object.keys(visibleDetails).length > 0;
          const showsAmount = isPartialPending
            ? hasElectronicLeg
            : (info?.totalUSD ?? 0) > 0;

          // Antes bastaba con NO tener datos de pago para matar la tarjeta
          // entera. Con el efectivo (que no tiene datos que mostrar) eso se
          // llevaba también el monto y dejaba un "Paso 2" huérfano: el cliente
          // ya no veía cuánto debe en ningún lado (2026-07-26).
          if (!hasDetails && !showsAmount) return null;

          return (
            <div
              role={isPartialPending ? "alert" : undefined}
              className={`mt-4 rounded-2xl border-2 px-4 py-4 text-left ${
                isPartialPending
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-[var(--brand-border)] bg-[var(--brand-cream)]/40"
              }`}
            >
              {!isPartialPending ? (
                <span className="inline-flex rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-black">
                  Paso 1
                </span>
              ) : null}
              <p
                className={`text-sm font-black uppercase tracking-[0.12em] ${
                  isPartialPending
                    ? "text-amber-500"
                    : "mt-2 text-[var(--brand-primary)]"
                }`}
              >
                {isPartialPending
                  ? `📸 Foto recibida · falta registrar la parte de ${
                      electronicLegs.map((payment) => payment.method).join(" + ") ||
                      "tu pago electrónico"
                    }`
                  : (
                    <>
                      {/* Sin datos que mostrar (efectivo) "Paga con estos datos"
                          era una promesa vacía. */}
                      {hasDetails ? "Paga con estos datos" : "Tu pago es en efectivo"}
                      {/* El método solo si hay VARIOS: con uno, el desplegable
                          de abajo ya dice "Ver datos de Pago móvil" y la fila
                          del método lo repite — el nombre salía tres veces y el
                          título se partía en dos líneas (2026-07-26). */}
                      {chosenMethods.length > 1 && (
                        <span className="text-[var(--brand-ink-2)]/45">
                          {" "}
                          ({chosenMethods.join(" + ")})
                        </span>
                      )}
                    </>
                  )}
              </p>
              {isPartialPending && electronicLegs.length ? (
                <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/85">
                  Monto a reportar:{" "}
                  {/* La cantidad BRILLA sobre el resto (dueño 2026-07-23). */}
                  <span className="text-[1.1rem] font-black text-amber-300 [text-shadow:0_0_14px_rgba(251,191,36,0.6)]">
                    {electronicLegs
                      .map((payment) =>
                        payment.currency === "VES"
                          ? `Bs ${formatVES(payment.amount)}`
                          : formatUSD(payment.amount),
                      )
                      .join(" + ")}
                  </span>
                </p>
              ) : !isPartialPending && (info?.totalUSD ?? 0) > 0 ? (
                (() => {
                  // El monto manda: mismo patrón que "Tienes que pagar lo
                  // siguiente" del checkout (text-2xl en naranja de marca), para
                  // que los dos pasos del flujo se vean igual.
                  // La moneda sale de las patas del SERVIDOR cuando existen.
                  // Derivarla solo de chosenMethods (que vive en el
                  // localStorage del teléfono que pidió) hacía que al abrir el
                  // link del pedido en otro navegador —o tras limpiar datos— un
                  // pedido en bolívares mostrara "$25.00" y ninguna cifra en Bs
                  // (2026-07-26).
                  const methodsForCurrency = (info?.expectedPayments || []).length
                    ? (info?.expectedPayments || []).map((payment) => payment.method)
                    : chosenMethods;
                  const total = formatChosenTotal(
                    info ?? { totalUSD: 0, exchangeRate: 0 },
                    methodsForCurrency,
                  );

                  // Con parte en efectivo el héroe NO puede ser el total del
                  // pedido. El rótulo viejo ("Total a pagar") ataba la cifra al
                  // pedido; este es imperativo, así que en un mixto
                  // efectivo + pago móvil el cliente leía "TIENES QUE PAGAR
                  // Bs 3.640" cuando por pago móvil solo van Bs 1.820 — y
                  // transfería el doble (2026-07-26).
                  const mixtoConEfectivo = hasCashLeg && hasElectronicLeg;

                  const eyebrow = mixtoConEfectivo
                    ? "Tienes que transferir ahora"
                    : hasCashLeg
                      ? "Pagas en efectivo"
                      : "Tienes que pagar";
                  const main = mixtoConEfectivo
                    ? legsLabel(electronicLegs)
                    : total.main;
                  const secondary = mixtoConEfectivo
                    ? `El resto (${legsLabel(cashLegs)}) lo entregas en efectivo, no lo transfieras.`
                    : hasCashLeg
                      ? "Lo entregas en efectivo al recibir tu pedido."
                      : total.secondary;

                  return (
                    <div className="mt-2">
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--brand-ink-2)]/55">
                        {eyebrow}
                      </p>
                      <p className="mt-0.5 text-2xl font-black leading-none text-[var(--brand-primary)]">
                        {main}
                      </p>
                      {secondary ? (
                        <p className="mt-1 text-[0.72rem] font-bold text-[var(--brand-ink-2)]/55">
                          {secondary}
                        </p>
                      ) : null}
                    </div>
                  );
                })()
              ) : null}
              {hasDetails ? (
                <div className="mt-2">
                  <PaymentMethodDetailsList details={visibleDetails} />
                </div>
              ) : null}
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
          {/* "Ver el avance" SOLO con el reporte completo: si falta la pata
              electrónica, el botón que sigue es el de reportarla (abajo) —
              mandarlo al seguimiento aquí confundía (dueño 2026-07-23). */}
          {showTrackingLink && reportCovered ? (
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

      {/* El chip "Paso 2" solo en el flujo fresco: con la pata pendiente ya
          hay un solo mensaje + un solo botón (sin numerar pasos de más).
          Sigue puesto con el formulario ABIERTO: antes llevaba !isFormOpen y
          desaparecía justo al abrirlo, así que el cliente veía "Paso 1" y
          después nada — la numeración se rompía donde más hacía falta
          (2026-07-26). */}
      {!hasConfirmedPayment && !awaitingProofSync && !hasPendingProof ? (
        <span className="mt-4 inline-flex rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-black">
          Paso 2
        </span>
      ) : null}

      {!hasConfirmedPayment && !awaitingProofSync && !isFormOpen ? (
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
                ? "Reportar lo que falta del pago"
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
                <label className="text-[0.78rem] font-bold text-[var(--brand-ink-2)]/75">
                  {payments.length > 1
                    ? `Método ${index + 1}`
                    : "Método de pago"}
                </label>
                {/* "Quitar" solo si el dueño permite tocar los métodos — la
                    MISMA condición que el botón de agregar más abajo. Antes
                    salía siempre: con los métodos fijados, la fila decía "el
                    que elegiste al pedir" y al lado ofrecía borrarlo, así que
                    el cliente podía dejar el reporte sin una pata (2026-07-26). */}
                {payments.length > 1 &&
                  (allowMethodChange || chosenMethods.length === 0) && (
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

              {/* Método fijado por el dueño: antes se pintaba un <select>
                  deshabilitado CONSERVANDO su flecha ˅ — un control muerto que
                  invitaba a tocarlo y no hacía nada, y por eso la pantalla se
                  sentía rota. Ahora es texto plano que dice por qué está fijo
                  (2026-07-26). Cuando SÍ se puede cambiar, sigue el select. */}
              {!allowMethodChange && chosenMethods.length > 0 ? (
                // Una sola fila: es un dato de lectura, no merece tres líneas
                // (con los datos de pago ya abiertos arriba, cada línea de más
                // empuja el botón de enviar fuera de pantalla).
                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/50 px-4 py-2.5">
                  <p className="text-sm font-black text-[var(--brand-ink-3)]">
                    {entry.method || "Por confirmar"}
                  </p>
                  <p className="text-[0.7rem] font-bold text-[var(--brand-ink-2)]/55">
                    — el que elegiste al pedir
                  </p>
                </div>
              ) : (
                <select
                  value={entry.method}
                  onChange={(event) => changePaymentEntryMethod(index, event.target.value)}
                  className="mt-1.5 w-full rounded-2xl border-2 border-[var(--brand-primary)]/40 bg-white px-4 py-3 text-sm font-bold text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/45 focus:border-[var(--brand-primary)]"
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
              )}

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
                        <label className="text-[0.78rem] font-bold text-[var(--brand-ink-2)]/75">
                          Monto en $
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
                        <label className="text-[0.78rem] font-bold text-[var(--brand-ink-2)]/75">
                          Monto en Bs
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
                          // Pero SOLO si el cliente cambió el monto: con el
                          // precargado, el "Tienes que pagar" de arriba ya lo
                          // dice y el mismo número salía cuatro veces en la
                          // misma pantalla, en tres formatos (2026-07-26).
                          const rate = Number(info?.exchangeRate || 0);
                          const ves = normalizeMoneyInput(entry.amountVES);
                          if (rate <= 0 || ves <= 0) return null;

                          const expectedVES = (info?.expectedPayments || []).find(
                            (leg) =>
                              leg.currency === "VES" && leg.method === entry.method,
                          )?.amount;
                          if (
                            typeof expectedVES === "number" &&
                            Math.abs(expectedVES - ves) < 0.01
                          ) {
                            return null;
                          }

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

              {/* El botón "Completar lo que falta" se retiró: el monto ya
                  viene precargado con la pata exacta y no se puede pagar
                  menos — era un botón de más (dueño 2026-07-23). */}
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

          {/* El requisito real dicho UNA vez y en positivo. Antes cada etiqueta
              se declaraba opcional apoyándose en la otra ("referencia (si no
              adjuntas captura)" + "captura (opcional si pones la referencia)"):
              las dos se leían como opcionales, el cliente le daba a enviar y se
              comía el error rojo. La validación NO cambió — sigue exigiendo una
              de las dos, solo ahora se entiende antes (2026-07-26). Adjuntar va
              primero porque es lo que hace casi todo el mundo (dueño
              2026-07-23). */}
          <div className="rounded-2xl border-2 border-[var(--brand-primary)]/30 bg-[var(--brand-cream)]/25 p-3">
            {/* En mixto hay una captura por pata (la segunda va debajo), así que
                "una de las dos" sería mentira: el requisito real es al menos un
                comprobante o la referencia. */}
            <p className="text-[0.8rem] font-black text-[var(--brand-ink-3)]">
              {isMixedReport && allowSecondProof
                ? "Adjunta al menos una captura o escribe la referencia"
                : "Haz una de las dos para enviar"}
            </p>

            <div className="mt-2.5">
              <label className="text-[0.78rem] font-bold text-[var(--brand-ink-2)]/75">
                {isMixedReport && allowSecondProof
                  ? "Captura del primer pago"
                  : "Adjunta la captura del pago"}
              </label>
              <label className="mt-1.5 flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/50 bg-white px-4 py-4 text-sm font-bold text-[#1a1a1a]/80 transition hover:border-[var(--brand-primary)]">
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

            {/* En minúscula a propósito: en mayúscula una "O" sola se lee como
                un cero. */}
            <p className="mt-2.5 text-center text-[0.74rem] font-bold lowercase text-[var(--brand-ink-2)]/45">
              o
            </p>

            {/* Área de toque de 44px (la casilla de 20px quedaba por debajo del
                mínimo recomendado en teléfono). */}
            <label className="mt-1 flex min-h-[44px] cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={wantsReference}
                onChange={(event) => {
                  setWantsReference(event.target.checked);
                  if (!event.target.checked) setReference("");
                }}
                className="h-6 w-6 shrink-0 accent-[var(--brand-primary)]"
              />
              <span className="text-[0.82rem] font-bold text-[var(--brand-ink-2)]/85">
                Escribir la referencia
              </span>
            </label>
            {wantsReference ? (
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Todos los dígitos de la operación"
                className="mt-1.5 w-full rounded-2xl border-2 border-[var(--brand-primary)]/40 bg-white px-4 py-3 text-sm font-bold text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/45 focus:border-[var(--brand-primary)]"
              />
            ) : null}
          </div>

          {/* Segunda captura: solo en pago mixto (una por cada pata, ej. pago
              móvil + Zelle) y si el dueño la dejó habilitada. */}
          {isMixedReport && allowSecondProof ? (
            <div>
              <label className="text-[0.78rem] font-bold text-[var(--brand-ink-2)]/75">
                Captura del segundo pago (opcional)
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

          {/* La nota vive detrás de una casilla (mismo patrón que el punto de
              referencia del delivery): menos campos a la vista. */}
          <div>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={wantsNote}
                onChange={(event) => {
                  setWantsNote(event.target.checked);
                  if (!event.target.checked) setCustomerNote("");
                }}
                className="h-6 w-6 shrink-0 accent-[var(--brand-primary)]"
              />
              <span className="text-[0.82rem] font-bold text-[var(--brand-ink-2)]/85">
                Agregar una nota (opcional)
              </span>
            </label>
            {wantsNote ? (
              <input
                value={customerNote}
                onChange={(event) => setCustomerNote(event.target.value)}
                placeholder="Ejemplo: pagó mi mamá desde su cuenta"
                className="mt-1.5 w-full rounded-2xl border-2 border-[var(--brand-primary)]/40 bg-white px-4 py-3 text-sm font-bold text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/45 focus:border-[var(--brand-primary)]"
              />
            ) : null}
          </div>

          {/* Los tres mensajes van juntos y con ref: la fila de botones quedó
              pegada abajo, así que el cliente puede enviar desde media pantalla
              y estos se pintaban al FINAL del formulario (~1250px), fuera de
              vista. Sin nada visible parecía que el botón no hacía nada — y en
              el caso del duplicado o del monto de más, el botón que aparece aquí
              es la ÚNICA forma de completar el envío (2026-07-26). */}
          {(formError || duplicateWarning || coverageWarning) && (
          <div ref={messagesRef} className="space-y-3">
          {formError && (
            <p
              role="alert"
              className="rounded-2xl border-2 border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-bold leading-5 text-red-400"
            >
              {formError}
            </p>
          )}

          {duplicateWarning && (
            <div role="alert" className="rounded-2xl border-2 border-yellow-500/60 bg-yellow-500/10 px-4 py-3">
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
            <div role="alert" className="rounded-2xl border-2 border-yellow-500/60 bg-yellow-500/10 px-4 py-3">
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
          </div>
          )}

          {/* Fila de acciones pegada al borde inferior mientras se hace scroll:
              con los datos de pago abiertos el formulario mide ~1250px y
              "Enviar comprobante" quedaba fuera de pantalla — el cliente pagaba
              y no encontraba cómo enviar (2026-07-26). Fondo opaco para que el
              contenido no se lea por detrás. */}
          <div className="sticky bottom-0 z-10 flex gap-2 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_26px_-14px_rgba(0,0,0,0.5)]">
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
