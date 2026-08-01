"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
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
import { isDineInOrderType } from "@/lib/publicOrderPaymentFlow";

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
  // La pata se entrega EN MANO (efectivo): no se transfiere ni se reporta con
  // captura. Lo decide el servidor y viaja explícito para que el monto grande
  // de esta pantalla nunca le pida al cliente transferir el total.
  isCash: boolean;
};

type OrderPaymentInfo = {
  branchId: string;
  totalUSD: number;
  exchangeRate: number;
  paymentRegistered: boolean;
  createdAt: string;
  orderStatus: string;
  // Tipo del pedido: en mesa ("Comer aquí") el prepago es opcional y toda la
  // sección habla en tono de invitación, no imperativo.
  orderType: string;
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
  planPaymentHero,
} from "@/lib/orderPaymentLegs";
import {
  isLegEvidenceComplete,
  planPaymentReport,
} from "@/lib/paymentReportEvidence";
import { readImageFileForUpload } from "@/lib/clientImage";

type PaymentEntry = {
  method: string;
  amountUSD: string;
  amountVES: string;
  // Evidencia PROPIA de esta pata. Antes había UNA captura y UNA referencia
  // para todo el reporte: en "Pago móvil + Zelle" una sola captura daba por
  // reportadas las dos patas y caja se quedaba sin cómo verificar la otra
  // (pedido del dueño 2026-07-26). Ahora cada pago lleva la suya y las dos
  // son obligatorias.
  dataUrl: string;
  fileName: string;
  mimeType: string;
  reference: string;
  // La referencia vive detrás de una casilla (casi nadie la usa: la mayoría
  // solo adjunta la captura).
  wantsReference: boolean;
};

const EMPTY_PAYMENT_ENTRY: PaymentEntry = {
  method: "",
  amountUSD: "",
  amountVES: "",
  dataUrl: "",
  fileName: "",
  mimeType: "",
  reference: "",
  wantsReference: false,
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
  uploadingProofs = false,
  livePaymentConfirmed = false,
  variant = "card",
  formAsScreen = false,
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
  // true MIENTRAS el checkout está subiendo comprobantes (uno por pata, en
  // serie): con la primera pata ya registrada y la segunda en vuelo, la
  // sección no puede acusar todavía que "falta registrar la parte de X".
  uploadingProofs?: boolean;
  // true cuando el poll del seguimiento (10s) ya vio el pago confirmado: la
  // sección recarga su info AL INSTANTE en vez de esperar su propio ciclo —
  // el "En revisión" se quedaba pegado hasta 45s tras el cobro de caja y el
  // cliente terminaba refrescando a mano (dueño 2026-07-26).
  livePaymentConfirmed?: boolean;
  // "card" (por defecto): tarjeta gorda con borde, como vive en la página de
  // seguimiento. "screen": la PANTALLA dedicada de "Reportar pago" del
  // carrito — sin la tarjeta contenedora ni el eyebrow (el encabezado de la
  // pantalla ya dice qué es), con el monto más grande y una tarjeta menos de
  // anidación en el formulario, para que respire (dueño 2026-07-31: "todo se
  // ve muy encerrado, amontonado y pequeño").
  variant?: "card" | "screen";
  // Página de seguimiento (dueño 2026-07-31): al tocar "Reportar mi pago" el
  // FORMULARIO se abre como pantalla completa (overlay con flecha Atrás y la
  // presentación "screen"), y al enviarse o cerrarse se vuelve a la vista
  // del pedido con sus estados. La tarjeta inline (estados, datos, chips)
  // sigue igual mientras el formulario está cerrado.
  formAsScreen?: boolean;
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
  // Reloj del recordatorio "llevas X min sin reportar", en estado y movido por
  // un intervalo. Leer Date.now() AL RENDERIZAR es impuro: dos renders del
  // mismo estado daban números distintos.
  const [nowMs, setNowMs] = useState(0);
  const firedRemindersRef = useRef<Set<number>>(new Set());

  const [isFormOpen, setIsFormOpen] = useState(false);
  // Un bloque por método: si el cliente pagó parte con un método y parte con
  // otro, indica cuánto fue en cada uno. Se precarga con lo que eligió al
  // pedir (editable si al final pagó distinto).
  const [payments, setPayments] = useState<PaymentEntry[]>([EMPTY_PAYMENT_ENTRY]);
  const [customerNote, setCustomerNote] = useState("");
  // La nota es opcional y casi nadie la usa: vive detrás de una casilla.
  const [wantsNote, setWantsNote] = useState(false);
  // true entre "reporte enviado OK" y "la info ya lo trae": evita pintar el
  // estado anterior un instante (flash de versión vieja).
  const [syncingAfterReport, setSyncingAfterReport] = useState(false);
  // Patas que YA entraron en este envío. El reporte manda un comprobante por
  // pata (secuencial): si la segunda falla — o el servidor pide confirmar un
  // duplicado — al reintentar no se puede volver a mandar la primera.
  const sentLegKeysRef = useRef<Set<string>>(new Set());
  // El cliente ya tocó el formulario: desde ese momento NADA lo repisa (el
  // sondeo periódico le borraba la captura y la referencia).
  const formTouchedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  // Aviso suave cuando lo reportado no cubre el total: se puede enviar igual
  // (abonos parciales existen), pero que sea a propósito y no un error.
  const [coverageWarning, setCoverageWarning] = useState<string | null>(null);
  // Contenedor de los mensajes de error/aviso, para traerlos a la vista.
  const messagesRef = useRef<HTMLDivElement | null>(null);
  // Sube en CADA intento de envío fallido: el scroll al mensaje disparaba
  // solo cuando el TEXTO cambiaba, así que con el mismo error fuera de
  // pantalla los toques siguientes en "Enviar comprobante" parecían no hacer
  // nada (reporte del dueño 2026-07-31).
  const [errorSignal, setErrorSignal] = useState(0);

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
          orderType: String(data.orderType || ""),
          autoCancelApplies: data.autoCancelApplies === true,
          expectedPayments: Array.isArray(data.expectedPayments)
            ? data.expectedPayments
                .map((leg: Partial<ExpectedPayment>) => ({
                  method: String(leg.method || "").trim(),
                  currency: leg.currency === "VES" ? ("VES" as const) : ("USD" as const),
                  amount: Number(leg.amount || 0),
                  // Respaldo por si la respuesta viene de un servidor viejo que
                  // aún no mandaba la bandera.
                  isCash:
                    typeof leg.isCash === "boolean"
                      ? leg.isCash
                      : isCashReportedMethod(leg.method),
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

  // (Los tres efectos que PRECARGAN el formulario viven más abajo, después de
  // buildInitialPayments: llamarla desde aquí arriba es leer una función antes
  // de declararla y el lint de React lo marca — la precarga podría quedarse
  // con una versión vieja de los datos.)

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
  // El cliente YA MANDÓ algo (enviado, en revisión o ya revisado por caja).
  // Las compuertas de esta pantalla miran esto y no solo lo "pendiente": con
  // un pago en efectivo, en cuanto caja confirmaba la foto de los billetes el
  // comprobante dejaba de estar pendiente y la sección volvía a ofrecer
  // "Reportar mi pago" por un dinero que ya estaba resuelto (2026-07-26).
  const hasActiveProof = activeProofs.length > 0;
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
  // El servidor mandó las patas del pedido (más de una): el reparto ya está
  // decidido y el cliente no puede agregarle ni quitarle métodos al reporte.
  const serverSentLegs = (info?.expectedPayments || []).length > 1;
  // Pedido 100% en efectivo: NO hay nada que reportar por aquí (el dinero se
  // entrega en mano). Ofrecerle "Reportar mi pago" abría un formulario que
  // siempre respondía "el efectivo se entrega en persona" — un botón que solo
  // podía terminar en error rojo. Se exige que la info HAYA cargado con patas:
  // sin ellas (fetch caído, método desconocido) el reporte sigue disponible,
  // porque reportar el pago nunca puede ser un callejón sin salida.
  const orderIsCashOnly =
    (info?.expectedPayments || []).length > 0 &&
    (info?.expectedPayments || []).every((leg) => leg.isCash);
  // Los chips "Paso 1"/"Paso 2" de esta sección chocan con los del checkout,
  // donde significan otra cosa ("¿cuánto pagas en bolívares?" / "¿cuánto en
  // divisas?"). En mixto manda la numeración por pago ("Pago 1 de 2").
  const showStepChips = !serverSentLegs && !isMixedReport;
  // Pedido de mesa: pagar por adelantado es OPCIONAL (puede pagar en el local
  // al final), así que los textos invitan en vez de exigir. Si la info no
  // cargó no se suaviza nada: decirle "paga al final" a un delivery es peor
  // que exigirle de más a una mesa (ronda QA 2026-07-29).
  const prepayOptional = isDineInOrderType(info?.orderType);

  // Minutos desde que se registró el pedido (para el recordatorio escalonado
  // 5/10/15/20 min y el contador de anulación automática). SOLO aplica a los
  // pedidos donde la anulación automática existe de verdad (Pick up/Delivery
  // con método electrónico, lo decide el servidor): en mesa o efectivo el
  // cliente paga al final y el contador sería una amenaza falsa.
  const paymentPendingReminder =
    !hasConfirmedPayment && !hasActiveProof && info?.autoCancelApplies === true;
  const elapsedMinutes = (() => {
    if (!info?.createdAt || nowMs <= 0) return 0;
    const createdAt = new Date(info.createdAt);
    if (Number.isNaN(createdAt.getTime())) return 0;
    return Math.max(0, Math.floor((nowMs - createdAt.getTime()) / 60_000));
  })();

  useEffect(() => {
    if (!paymentPendingReminder || !info?.createdAt) return;

    // La primera lectura va diferida un tick (setState síncrono dentro del
    // efecto lo prohíbe el lint), y de ahí en adelante una por minuto.
    const first = window.setTimeout(() => setNowMs(Date.now()), 0);
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [paymentPendingReminder, info?.createdAt]);

  // Refresco periódico del estado de pago: si caja confirma (o el pedido se
  // anula) mientras el cliente tiene la página abierta, el banner y el
  // contador se apagan solos en vez de quedarse congelados en el primer
  // snapshot. Con un comprobante esperando revisión el ciclo baja a 15s:
  // es justo el momento en que caja está por confirmar y 45s se sentían
  // como "no se actualiza" (dueño 2026-07-26).
  useEffect(() => {
    if (isLoading || !info || hasConfirmedPayment) return;
    if (info.orderStatus === "Cancelado") return;

    const timer = window.setInterval(
      () => {
        void loadInfo();
      },
      hasPendingProof ? 15_000 : 45_000,
    );

    return () => window.clearInterval(timer);
  }, [isLoading, info, hasConfirmedPayment, hasPendingProof, loadInfo]);

  // El poll del seguimiento (cada 10s) ve el cobro de caja ANTES que el
  // refresco de esta sección: cuando avisa, la info se recarga de una para
  // que los chips "En revisión" pasen a "Confirmado" sin refrescar la página.
  useEffect(() => {
    if (!livePaymentConfirmed || isLoading || hasConfirmedPayment) return;
    const timer = setTimeout(() => {
      void loadInfo();
    }, 0);
    return () => clearTimeout(timer);
  }, [livePaymentConfirmed, isLoading, hasConfirmedPayment, loadInfo]);

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
    // errorSignal: re-traer el mensaje a la vista aunque sea EL MISMO error
    // (cada toque fallido en Enviar lo sube).
  }, [formError, duplicateWarning, coverageWarning, errorSignal]);

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
  // `uploadingProofs`: el checkout sube UN comprobante POR PATA, en serie. Sin
  // esa señal, en cuanto aterrizaba la primera se apagaba el "registrando…" y
  // —con la segunda todavía subiendo desde ese mismo teléfono— aparecía la
  // alerta ámbar "falta registrar la parte de Zelle" mientras arriba decía que
  // el pedido ya estaba recibido (2026-07-26). Se apaga cuando las subidas
  // terminan, así que si una falla de verdad la alerta sí sale.
  const awaitingProofSync =
    syncingAfterReport ||
    (expectProofPending && !hasConfirmedPayment && activeProofs.length === 0) ||
    (uploadingProofs && !hasConfirmedPayment && !reportCovered);

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

  // Captura de UNA pata (cada pago tiene la suya).
  async function handleEntryFileChange(index: number, file: File | undefined) {
    setFormError(null);

    if (!file) {
      updatePaymentEntry(index, { dataUrl: "", fileName: "", mimeType: "" });
      return;
    }

    // Se comprime EN el teléfono antes de subir: las fotos de cámara (4–12 MB,
    // o HEIC en iPhone) pasan a un JPEG liviano que sube rápido aunque la
    // señal esté mala. Ver lib/clientImage.
    try {
      const image = await readImageFileForUpload(file, {
        fallbackName: "comprobante",
      });
      updatePaymentEntry(index, {
        dataUrl: image.dataUrl,
        fileName: image.fileName,
        mimeType: image.mimeType,
      });
    } catch (error) {
      updatePaymentEntry(index, { dataUrl: "", fileName: "", mimeType: "" });
      setFormError(
        error instanceof Error
          ? error.message
          : "No se pudo leer la imagen del comprobante.",
      );
    }
  }

  // Monto prellenado en LA MONEDA del método: pago móvil/punto → Bs (con la
  // tasa del pedido); Zelle/efectivo divisas → $.
  function buildPrefilledEntry(methodName: string, amountUSDToCover: number): PaymentEntry {
    if (amountUSDToCover <= 0) {
      return { ...EMPTY_PAYMENT_ENTRY, method: methodName };
    }

    const rate = Number(info?.exchangeRate || 0);
    if (isVesPaymentMethod(methodName) && rate > 0) {
      return {
        ...EMPTY_PAYMENT_ENTRY,
        method: methodName,
        amountVES: toVesInputAmount(
          Math.round(amountUSDToCover * rate * 100) / 100,
        ),
      };
    }

    return {
      ...EMPTY_PAYMENT_ENTRY,
      method: methodName,
      amountUSD: amountUSDToCover.toFixed(2),
    };
  }

  // ¿Esta pata YA tiene su comprobante? El reporte manda uno por pata, así que
  // "Pago móvil (Bs 1.660,20)" cubre la pata "Pago móvil". Sirve para no
  // volver a pedir (ni a mandar) lo que ya entró cuando el envío se cortó a la
  // mitad y el cliente vuelve por el link días después.
  function isLegAlreadyReported(methodName: string): boolean {
    const normalized = methodName.trim().toLowerCase();
    if (!normalized) return false;

    return activeProofs.some((proof) => {
      if (isCashReportedMethod(proof.reportedMethod)) return false;
      return String(proof.reportedMethod || "")
        .trim()
        .toLowerCase()
        .startsWith(normalized);
    });
  }

  // ¿Esta pata del formulario ya se envió? Vale tanto lo que confirma el
  // servidor (isLegAlreadyReported) como lo que entró en este mismo envío
  // antes de que fallara la siguiente (sentLegKeysRef, por si la info aún no
  // se refrescó).
  function isLegSent(methodName: string, index: number): boolean {
    return (
      isLegAlreadyReported(methodName) ||
      sentLegKeysRef.current.has(`${index}|${methodName.trim()}`)
    );
  }

  // Precarga del formulario: un bloque por método elegido al pedir, CON su
  // monto (lote v6.1). La fuente preferida son las patas que calcula el
  // servidor desde el pedido (expectedPayments: método + monto por pata,
  // también en mixto); si aún no cargaron, se usan los métodos guardados en
  // el dispositivo y el total.
  function buildInitialPayments(): PaymentEntry[] {
    // Solo las patas que se TRANSFIEREN: la de efectivo se entrega en mano y
    // precargarla aquí haría que el reporte declarara pagado un dinero que el
    // negocio todavía no recibió.
    const expected = (info?.expectedPayments || []).filter((leg) => !leg.isCash);
    if (expected.length > 0) {
      // Se muestran TODAS las patas, también las que ya tienen comprobante:
      // esas se pintan como "Ya enviado" y no se vuelven a mandar. Ocultarlas
      // dejaba "Pago 1 de 1" en un pedido de dos y, si el cliente cambiaba la
      // captura de la que ya entró, el envío la descartaba en silencio.
      return expected.map((leg) => ({
        ...EMPTY_PAYMENT_ENTRY,
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
    return chosen.map((methodName) => ({
      ...EMPTY_PAYMENT_ENTRY,
      method: methodName,
    }));
  }

  // Apertura automática del formulario (una sola vez) cuando el pago sigue
  // pendiente: la confirmación del carrito lo pide con autoOpenForm.
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    // Se abre aunque `info` no haya cargado (null): reportar pago no debe
    // depender de que /order-payment responda. Si ya hay pago/comprobante, no
    // se abre (pero eso solo se sabe con info).
    if (!autoOpenForm || autoOpenedRef.current || isLoading) return;

    if (info?.paymentRegistered || activeProofs.length > 0) return;

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
      formTouchedRef.current = false;
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
    // NUNCA por encima de lo que el cliente ya escribió o adjuntó. `info` es un
    // objeto nuevo en cada sondeo (45s, o 4s mientras se sincroniza), así que
    // este efecto se dispara solo cada tanto: desde que la evidencia vive
    // DENTRO de payments, reconstruirlo le borraba la captura ya comprimida y
    // la referencia a media escritura, sin un solo aviso (2026-07-26).
    if (formTouchedRef.current) return;
    const hasAnyInput = payments.some(
      (entry) =>
        entry.amountUSD.trim() !== "" ||
        entry.amountVES.trim() !== "" ||
        entry.dataUrl !== "" ||
        entry.reference.trim() !== "",
    );
    if (hasAnyInput) return;
    const timer = setTimeout(() => setPayments(buildInitialPayments()), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reprecarga solo al llegar la info
  }, [isFormOpen, info]);

  // (El botón "Completar lo que falta" se retiró: los montos ya llegan
  // precargados con la pata exacta — dueño 2026-07-23. Con él se fue
  // getCoveredUSDExcept(), que solo lo usaba ese botón.)

  function updatePaymentEntry(index: number, patch: Partial<PaymentEntry>) {
    formTouchedRef.current = true;
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
    formTouchedRef.current = true;
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
    // Lo que corresponde reportar por vía electrónica: la(s) pata(s) que
    // eligió el cliente (en mixto, la parte en efectivo se entrega en mano).
    // Ojo: lo que FALTA, no el total. Con la pata 1 ya enviada el formulario
    // abre solo con la pata 2, así que exigir otra vez el total del pedido
    // dejaba el envío de esa segunda pata bloqueado para siempre.
    const requiredBaseUSD =
      pendingElectronicUSD > 0
        ? pendingElectronicUSD
        : Number(info?.requiredReportUSD ?? info?.totalUSD ?? 0);
    const totalUSDForAssume =
      requiredBaseUSD > 0 ? requiredBaseUSD : Number(info?.totalUSD || 0);
    const rateForAssume = Number(info?.exchangeRate || 0);

    const allEntries = payments
      .map((entry, index) => ({
        index,
        method: entry.method.trim(),
        usd: normalizeMoneyInput(entry.amountUSD),
        ves: normalizeMoneyInput(entry.amountVES),
        dataUrl: entry.dataUrl,
        fileName: entry.fileName,
        mimeType: entry.mimeType,
        reference: entry.reference.trim(),
      }))
      .filter((entry) => entry.method || entry.usd > 0 || entry.ves > 0);

    // Las patas que YA entraron salen del envío completo: ni se les exige
    // evidencia otra vez ni su dinero cuenta en la cobertura. Sin esto, tras
    // un envío a medias el reintento sumaba las dos patas contra lo que
    // faltaba de UNA y se bloqueaba con "estás reportando de MÁS" (los dos
    // números del mensaje eran hasta el mismo). Si TODAS estuvieran enviadas
    // (el cliente entró por "¿enviaste la captura equivocada?") no se filtra
    // nada: ahí sí se reenvía a propósito y el servidor pide confirmar.
    const pendingEntries = allEntries.filter(
      (entry) => !isLegSent(entry.method, entry.index),
    );
    let entries = pendingEntries.length > 0 ? pendingEntries : allEntries;

    // Captura/referencia SIN monto escrito: si el cliente solo adjuntó su
    // comprobante (caso común, sobre todo de tercera edad), asumimos que pagó
    // el TOTAL del pedido con el método preseleccionado, en su moneda. Así la
    // captura sola + método siempre pasa (pedido del dueño 2026-07-22) en vez
    // de trabar el envío pidiendo el monto. Solo con UNA pata: con dos, los
    // montos vienen precargados y adivinar el reparto sería inventar dinero.
    const onlyEntry = entries.length === 1 ? entries[0] : null;
    if (
      onlyEntry &&
      onlyEntry.usd <= 0 &&
      onlyEntry.ves <= 0 &&
      (onlyEntry.dataUrl || onlyEntry.reference) &&
      totalUSDForAssume > 0
    ) {
      const assumedMethod =
        onlyEntry.method || payments[0]?.method?.trim() || chosenMethods[0] || "";
      const assumedIsVes = isVesPaymentMethod(assumedMethod) && rateForAssume > 0;
      entries = [
        {
          ...onlyEntry,
          method: assumedMethod,
          usd: assumedIsVes ? 0 : totalUSDForAssume,
          ves: assumedIsVes
            ? Math.round(totalUSDForAssume * rateForAssume * 100) / 100
            : 0,
        },
      ];
    }

    // EVIDENCIA POR PATA (pedido del dueño 2026-07-26): cada pago necesita SU
    // captura o SU referencia. Antes una sola captura daba por reportado todo
    // el mixto y caja no tenía cómo verificar la otra mitad. La regla vive en
    // paymentReportEvidence, con tests: esta pantalla no tenía ninguno.
    const plan = planPaymentReport(entries);
    const electronicEntries = plan.electronicLegs;
    const isMultiLeg = electronicEntries.length > 1;
    const legName = (method: string) => method || "tu pago";

    if (plan.problem) {
      const { kind, method } = plan.problem;
      setFormError(
        kind === "solo-efectivo"
          ? "El efectivo se entrega en persona: no se reporta con captura. Si pagaste algo por transferencia, indícalo arriba."
          : kind === "sin-monto"
            ? "Indica el monto que pagaste (en $ o en Bs)."
            : kind === "falta-evidencia"
              ? isMultiLeg
                ? `Falta la captura o la referencia de ${legName(method)}. Cada pago necesita la suya.`
                : "Adjunta la captura del pago o escribe la referencia completa de la operación."
              : isMultiLeg
                ? `La referencia de ${legName(method)} está incompleta: escribe todos los dígitos de la operación.`
                : "Escribe la referencia completa de la operación (todos los dígitos, no solo los últimos).",
      );
      setErrorSignal((current) => current + 1);
      return;
    }

    const reportedUSD = electronicEntries.reduce((total, entry) => total + entry.usd, 0);
    const reportedVES = electronicEntries.reduce((total, entry) => total + entry.ves, 0);

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
        setErrorSignal((current) => current + 1);
        return;
      }

      if (!confirmPartial && missingUSD < -0.05) {
        setFormError(null);
        setCoverageWarning(
          `Estás reportando ${formatUSD(Math.abs(missingUSD))} de MÁS de lo que corresponde (${formatUSD(requiredBaseUSD)}). Revisa el monto; si de verdad pagaste eso, confírmalo abajo.`,
        );
        setErrorSignal((current) => current + 1);
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

      // UN COMPROBANTE POR PATA, secuencial. `payment_proofs` admite varias
      // filas por pedido y cada una lleva SU referencia y SU imagen, así que
      // caja ve la evidencia de cada pago sin abrir la base de datos. Va en
      // serie (no en paralelo) porque el anti-duplicado del servidor mira lo
      // que falta por cubrir: con las dos a la vez, la segunda vería el pedido
      // como si la primera no existiera.
      for (const entry of electronicEntries) {
        const legKey = `${entry.index}|${entry.method}`;

        const amountParts: string[] = [];
        if (entry.usd > 0) amountParts.push(formatUSD(entry.usd));
        if (entry.ves > 0) amountParts.push(`Bs ${formatVES(entry.ves)}`);
        const reportedMethod = entry.method
          ? amountParts.length
            ? `${entry.method} (${amountParts.join(" + ")})`
            : entry.method
          : amountParts.join(" + ");

        // Timeout duro de 45s: sin él, un fetch colgado (señal mala, red del
        // local caída) dejaba isSubmitting en true PARA SIEMPRE y el botón
        // "Enviar comprobante" quedaba muerto sin decir nada — el cliente
        // tocaba y tocaba y nada respondía (reporte del dueño 2026-07-31).
        const abortController = new AbortController();
        const abortTimer = window.setTimeout(() => abortController.abort(), 45_000);
        const response = await fetch("/api/payment-proofs", {
          method: "POST",
          headers,
          signal: abortController.signal,
          body: JSON.stringify({
            orderId,
            reportedMethod,
            amountReportedUSD: entry.usd,
            amountReportedVES: entry.ves,
            paymentReference: entry.reference,
            customerNote,
            dataUrl: entry.dataUrl,
            fileName: entry.fileName,
            mimeType: entry.mimeType,
            confirmDuplicate,
          }),
        });
        // Apenas responde se apaga el timer: un abort tardío cortaría la
        // LECTURA del body aunque el envío ya hubiera entrado.
        window.clearTimeout(abortTimer);
        const data = await response.json();

        if (response.status === 409 && data.duplicate) {
          setDuplicateWarning(
            data.error ||
              "Ya reportaste un pago para este pedido. ¿Quieres enviar otro de todas formas?",
          );
          setErrorSignal((current) => current + 1);
          return;
        }

        if (!response.ok) {
          throw new Error(
            isMultiLeg
              ? `${data.error || "No se pudo enviar el comprobante"} Quedó pendiente ${legName(entry.method)}: vuelve a intentarlo.`
              : data.error || "No se pudo enviar el comprobante",
          );
        }

        sentLegKeysRef.current.add(legKey);
      }

      setSuccessMessage(
        isMultiLeg
          ? "¡Los dos pagos quedaron reportados! Caja los revisará y aquí verás cuando queden confirmados."
          : "¡Pago reportado! Caja lo revisará y aquí verás cuando quede confirmado.",
      );
      onReported?.();
      // Mientras la info se recarga con el reporte nuevo, la sección muestra
      // "actualizando" en vez del estado ANTERIOR (flash de versión vieja,
      // dueño 2026-07-23 v2).
      setSyncingAfterReport(true);
      setIsFormOpen(false);
      formTouchedRef.current = false;
      setPayments([EMPTY_PAYMENT_ENTRY]);
      setCoverageWarning(null);
      setCustomerNote("");
      sentLegKeysRef.current = new Set();
      await loadInfo();
    } catch (error) {
      setFormError(
        error instanceof Error && error.name === "AbortError"
          ? "El envío tardó demasiado (¿mala señal?). Revisa tu conexión e intenta otra vez."
          : error instanceof Error
            ? error.message
            : "No se pudo enviar el comprobante",
      );
      setErrorSignal((current) => current + 1);
      // Si una pata SÍ entró antes del fallo, refrescamos ya: la pantalla
      // necesita saberlo para no volver a pedir su captura si el cliente
      // cierra y reabre el formulario (el sondeo normal tarda hasta 45s y en
      // ese hueco el reporte quedaba trabado pidiendo algo ya enviado).
      if (sentLegKeysRef.current.size > 0) {
        await loadInfo();
      }
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

  // Patas del formulario que ya entraron: se pintan "Ya enviado" y no se les
  // vuelve a pedir evidencia. Si están TODAS es un reenvío a propósito
  // ("¿enviaste la captura equivocada?"), y ahí sí se piden de nuevo.
  // Solo lo que confirma el SERVIDOR: los refs no se leen al renderizar (y
  // tras un envío a medias se recarga la info al instante, así que la tarjeta
  // se entera igual de rápido).
  const sentLegFlags = payments.map((entry) => isLegAlreadyReported(entry.method));
  const allLegsSent = sentLegFlags.length > 0 && sentLegFlags.every(Boolean);

  const isScreen = variant === "screen";
  // Presentación "pantalla": fija por variant (carrito) o mientras el
  // formulario está abierto como overlay (página de seguimiento).
  const screenMode = isScreen || (formAsScreen && isFormOpen);

  // Bloqueo del reparto (dueño 2026-07-31): con el método y el monto ya
  // decididos por el pedido (patas del servidor, o método único elegido al
  // pedir + total), el cliente NO los puede cambiar al reportar — solo pone
  // su comprobante. Si no se sabe nada (fetch caído, link abierto en otro
  // teléfono sin patas), el formulario sigue editable: reportar pago nunca
  // es un callejón sin salida.
  const nonCashExpectedLegs = (info?.expectedPayments || []).filter(
    (leg) => !leg.isCash,
  );
  const lockMethods =
    nonCashExpectedLegs.length > 0 || chosenMethods.length > 0;
  const lockAmounts =
    nonCashExpectedLegs.length > 0 ||
    (chosenMethods.length === 1 && Number(info?.totalUSD || 0) > 0);

  const sectionBody = (
    <div
      className={
        screenMode
          ? "mt-1"
          : "mt-4 rounded-[2rem] border-4 border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-6"
      }
    >
      {!screenMode ? (
        <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--brand-primary)]">
          <ReceiptText size={15} />
          Pago del pedido
        </p>
      ) : null}

      {/* En mesa el prepago es opcional y hay que decirlo de entrada: sin esta
          línea, los pasos de abajo se leen como si hubiera que transferir
          antes de comer (ronda QA 2026-07-29). */}
      {prepayOptional && !hasConfirmedPayment && !awaitingProofSync ? (
        <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/75">
          Puedes pagar de una vez con estos datos o pagar en el local al final,
          como prefieras.
        </p>
      ) : null}

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
        (!hasActiveProof || needsCorrection || !reportCovered) &&
        (() => {
          const isPartialPending = hasActiveProof && !reportCovered;
          // Reparto de patas + qué cifra manda en pantalla. Vive en
          // orderPaymentLegs (con test propio) porque la versión que estaba
          // aquí quedó inalcanzable y nadie lo notó.
          const legsPlan = planPaymentHero(info?.expectedPayments || []);
          const electronicLegs = legsPlan.electronicLegs;
          // Con una pata ya reportada, "falta registrar la parte de X" solo
          // puede nombrar (y sumar) las que FALTAN: si no, tras enviar el pago
          // móvil el aviso seguía pidiendo "Pago móvil + Zelle" con los dos
          // montos, como si no hubiera llegado nada.
          const missingLegsRaw = electronicLegs.filter(
            (leg) => !isLegAlreadyReported(leg.method),
          );
          const missingLegs = missingLegsRaw.length ? missingLegsRaw : electronicLegs;
          // Métodos del PEDIDO (los manda el servidor). chosenMethods vive en
          // el localStorage del teléfono que pidió: abriendo el link en otro
          // navegador llegaba vacío y un pedido en efectivo terminaba
          // mostrando los datos de Zelle + pago móvil + transferencia.
          const serverMethods = (info?.expectedPayments || []).map(
            (payment) => payment.method,
          );
          const cardMethods = isPartialPending && missingLegs.length
            ? missingLegs.map((payment) => payment.method)
            : serverMethods.length
              ? serverMethods
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
          const onlyCashChosen = serverMethods.length
            ? legsPlan.kind === "solo-efectivo"
            : cardMethods.length > 0 &&
              cardMethods.every((methodName) => isCashReportedMethod(methodName));
          const visibleDetails = Object.keys(filtered).length
            ? filtered
            : onlyCashChosen
              ? {}
              : paymentMethodDetails;

          // Patas en efectivo: se entregan en mano, NO se transfieren.
          const cashLegs = legsPlan.cashLegs;
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
            ? missingLegs.length > 0
            : (info?.totalUSD ?? 0) > 0;
          // Lo único que llegó es la foto de unos billetes: solo ahí se puede
          // decir "foto recibida". Con una pata electrónica ya reportada, ese
          // texto sería falso.
          const onlyCashProofs =
            activeProofs.length > 0 &&
            activeProofs.every((proof) => isCashReportedMethod(proof.reportedMethod));

          // Antes bastaba con NO tener datos de pago para matar la tarjeta
          // entera. Con el efectivo (que no tiene datos que mostrar) eso se
          // llevaba también el monto y dejaba un "Paso 2" huérfano: el cliente
          // ya no veía cuánto debe en ningún lado (2026-07-26).
          if (!hasDetails && !showsAmount) return null;

          return (
            <div
              role={isPartialPending ? "alert" : undefined}
              className={`mt-4 rounded-2xl border-2 text-left ${
                screenMode ? "px-4 py-5" : "px-4 py-4"
              } ${
                isPartialPending
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-[var(--brand-border)] bg-[var(--brand-cream)]/40"
              }`}
            >
              {!isPartialPending && showStepChips ? (
                <span className="inline-flex rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-black">
                  Paso 1
                </span>
              ) : null}
              <p
                className={`text-sm font-black uppercase tracking-[0.12em] ${
                  isPartialPending
                    ? "text-amber-500"
                    : `${showStepChips ? "mt-2 " : ""}text-[var(--brand-primary)]`
                }`}
              >
                {isPartialPending
                  ? `${onlyCashProofs ? "📸 Foto recibida" : "✅ Recibimos tu primer pago"} · falta registrar la parte de ${
                      missingLegs.map((payment) => payment.method).join(" + ") ||
                      "tu pago electrónico"
                    }`
                  : (
                    <>
                      {/* Sin datos que mostrar (efectivo) "Paga con estos datos"
                          era una promesa vacía. Pero "Tu pago es en efectivo"
                          solo vale si TODO es efectivo: en un mixto o un pago
                          móvil sin datos configurados era falso (se veía
                          "TU PAGO ES EN EFECTIVO (Pago móvil + …)", dueño
                          2026-07-31). */}
                      {hasDetails
                        ? prepayOptional
                          ? "Si quieres pagar ya, usa estos datos"
                          : "Paga con estos datos"
                        : onlyCashChosen
                          ? "Tu pago es en efectivo"
                          : "Así pagas tu pedido"}
                      {/* El método solo si hay VARIOS: con uno, el desplegable
                          de abajo ya dice "Ver datos de Pago móvil" y la fila
                          del método lo repite — el nombre salía tres veces y el
                          título se partía en dos líneas (2026-07-26). */}
                      {cardMethods.length > 1 && (
                        <span className="text-[var(--brand-ink-2)]/45">
                          {" "}
                          ({cardMethods.join(" + ")})
                        </span>
                      )}
                    </>
                  )}
              </p>
              {isPartialPending && missingLegs.length ? (
                <p className="mt-1 text-sm font-bold text-[var(--brand-ink-2)]/85">
                  Monto a reportar:{" "}
                  {/* La cantidad BRILLA sobre el resto (dueño 2026-07-23). */}
                  <span className="text-[1.1rem] font-black text-amber-300 [text-shadow:0_0_14px_rgba(251,191,36,0.6)]">
                    {legsLabel(missingLegs)}
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
                  // transfería el doble (2026-07-26). Este reparto lo decide
                  // planPaymentHero: la versión anterior miraba unas patas que
                  // el servidor ya había filtrado, así que NUNCA se ejecutaba.
                  // En mesa nada es imperativo: el monto se presenta como
                  // total del pedido, no como una orden de transferir.
                  const eyebrow =
                    legsPlan.kind === "mixto-con-efectivo"
                      ? prepayOptional
                        ? "Parte electrónica de tu pedido"
                        : "Tienes que transferir ahora"
                      : legsPlan.kind === "solo-efectivo"
                        ? "Pagas en efectivo"
                        : prepayOptional
                          ? "Total de tu pedido"
                          : "Tienes que pagar";
                  const main =
                    legsPlan.kind === "mixto-con-efectivo"
                      ? legsLabel(electronicLegs)
                      : total.main;
                  const secondary =
                    legsPlan.kind === "mixto-con-efectivo"
                      ? `El resto (${legsLabel(cashLegs)}) lo entregas en efectivo, no lo transfieras.`
                      : legsPlan.kind === "solo-efectivo"
                        ? prepayOptional
                          ? "Lo pagas en efectivo en el local cuando termines."
                          : "Lo entregas en efectivo al recibir tu pedido."
                        : // Dos patas electrónicas: el total es correcto (todo
                          // se transfiere), pero sin el reparto la tarjeta no
                          // dice cuánto va por cada método y el cliente tiene
                          // que adivinarlo.
                          electronicLegs.length > 1
                          ? `Repartido así: ${legsLabel(electronicLegs)}`
                          : total.secondary;

                  return (
                    <div className="mt-2">
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--brand-ink-2)]/55">
                        {eyebrow}
                      </p>
                      {/* En la pantalla dedicada el monto es el protagonista:
                          más grande que en la tarjeta del seguimiento. */}
                      <p
                        className={`mt-0.5 font-black leading-none text-[var(--brand-primary)] ${
                          screenMode ? "text-4xl" : "text-2xl"
                        }`}
                      >
                        {main}
                      </p>
                      {secondary ? (
                        <p
                          className={`mt-1 font-bold text-[var(--brand-ink-2)]/55 ${
                            screenMode ? "text-[0.8rem]" : "text-[0.72rem]"
                          }`}
                        >
                          {secondary}
                        </p>
                      ) : null}
                    </div>
                  );
                })()
              ) : null}
              {/* Con el formulario ABIERTO en mixto, los datos viven dentro de
                  la tarjeta de cada pago: repetirlos aquí duplicaba la pantalla
                  entera. Cerrado (o con un solo método) siguen aquí. */}
              {hasDetails && !(isFormOpen && isMixedReport) ? (
                <div className="mt-2">
                  {/* Con VARIOS métodos se pinta una lista por método: así cada
                      uno se auto-abre (la regla de auto-abrir de
                      PaymentMethodDetailsList mira que haya UNA entrada). Con
                      los dos juntos quedaban los dos cerrados y el cliente no
                      veía dónde pagar sin tocar nada (2026-07-26). */}
                  {Object.keys(visibleDetails).length > 1 ? (
                    <div className="space-y-2">
                      {Object.entries(visibleDetails).map(([methodName, value]) => (
                        <PaymentMethodDetailsList
                          key={methodName}
                          details={{ [methodName]: value }}
                        />
                      ))}
                    </div>
                  ) : (
                    <PaymentMethodDetailsList details={visibleDetails} />
                  )}
                </div>
              ) : null}
            </div>
          );
        })()}

      {(info?.proofs?.length ?? 0) > 0 && (
        <div className="mt-4 space-y-2">
          {(info?.proofs ?? []).map((proof, index) => {
            // Caja puede registrar el cobro SIN pasar por el comprobante
            // (desde el avance del pedido o su panel): el proof se queda en
            // "En revisión" en la BD, pero decírselo al cliente cuando el
            // pago ya está cobrado era falso. Con el pago confirmado, los
            // pendientes se muestran como confirmados.
            const isPendingProofStatus =
              proof.status === "Comprobante enviado" ||
              proof.status === "En revisión";
            const chip = proofStatusChip(
              hasConfirmedPayment && isPendingProofStatus
                ? "Confirmado por caja"
                : proof.status,
            );
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

      {/* !needsCorrection: "Necesita corrección" NO es un estado pendiente
          pero SÍ es activo, así que al pasar la compuerta de hasPendingProof a
          hasActiveProof este texto empezó a salir justo cuando el negocio
          exige otro comprobante — "no hace falta enviarlo otra vez" encima del
          botón "Enviar otro comprobante" (2026-07-26). */}
      {hasActiveProof && !hasConfirmedPayment && !needsCorrection && reportCovered ? (
        <p className="mt-3 text-[0.72rem] font-bold leading-5 text-[var(--brand-ink-2)]/60">
          {hasPendingProof
            ? "Tu pago ya fue reportado y está en revisión: no hace falta enviarlo otra vez. Aquí verás cuando quede confirmado."
            : // Sin nada pendiente y sin cobro electrónico confirmado: caja ya
              // revisó la foto del efectivo. Decir "en revisión" ahí era falso.
              "El negocio ya revisó tu comprobante: no hace falta enviarlo otra vez."}
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
            // En la pantalla dedicada este es EL siguiente paso (dueño
            // 2026-07-31): más grande y con sombra, nada compite con él.
            <a
              href={`/pedido/${orderId}`}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 font-black uppercase tracking-[0.12em] text-black transition hover:opacity-90 ${
                isScreen
                  ? "py-4 text-sm shadow-[0_14px_30px_-14px_rgba(var(--brand-primary-rgb),0.55)] active:scale-95"
                  : "py-3.5 text-xs"
              }`}
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
      {showStepChips &&
      !orderIsCashOnly &&
      !hasConfirmedPayment &&
      !awaitingProofSync &&
      !hasActiveProof ? (
        <div className="mt-4">
          <span className="inline-flex rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-black">
            Paso 2
          </span>
          {/* La pastilla nunca va sola: con el formulario auto-abierto quedaba
              un "Paso 2" naranja flotando encima del primer campo, sin decir
              de qué paso se trataba (2026-07-26). */}
          <p className="mt-1.5 text-sm font-black text-[var(--brand-ink-3)]">
            {isFormOpen
              ? "Cuéntanos cómo pagaste"
              : prepayOptional
                ? "Si ya pagaste, repórtalo aquí"
                : "Repórtalo aquí"}
          </p>
        </div>
      ) : null}

      {!hasConfirmedPayment && !awaitingProofSync && !isFormOpen && !orderIsCashOnly ? (
        hasActiveProof && !needsCorrection && reportCovered ? (
          // En la PANTALLA dedicada del carrito no va ni el enlace discreto:
          // reportado el pago, la única acción es "Ver el avance" (dueño
          // 2026-07-31). El enlace sigue en la página de seguimiento.
          requiredElectronicUSD <= 0 || isScreen ? null : (
          // Reportado y en revisión: nada que hacer. Solo un enlace discreto
          // por si adjuntó la captura equivocada. En efectivo PURO ni eso:
          // no hay captura electrónica que corregir (dueño 2026-07-23).
          <button
            type="button"
            onClick={() => {
              setIsFormOpen(true);
              setSuccessMessage(null);
              formTouchedRef.current = false;
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
              formTouchedRef.current = false;
              setPayments(buildInitialPayments());
            }}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-black transition hover:opacity-90"
          >
            <ImagePlus size={15} />
            {needsCorrection
              ? "Enviar otro comprobante"
              : hasActiveProof && !reportCovered
                ? "Reportar lo que falta del pago"
                : "Reportar mi pago"}
          </button>
        )
      ) : null}

      {isFormOpen && (
        <div className="mt-4 space-y-3 text-left">
          {/* Cambió el método respecto a lo que eligió al pedir: se puede
              (si el dueño lo permite), con la condición de cubrir el total. */}
          {!serverSentLegs &&
          chosenMethods.length > 0 &&
          payments.some(
            (entry) => entry.method && !chosenMethods.includes(entry.method),
          ) ? (
            <p className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-4 py-3 text-[0.72rem] font-bold leading-5 text-[var(--brand-ink-2)]/70">
              Al pedir indicaste {chosenMethods.join(" + ")}. Puedes cambiar el
              método sin problema, siempre que el pago cubra el total del
              pedido.
            </p>
          ) : null}
          {payments.map((entry, index) => {
            // Variante COMPACTA (pantalla dedicada, un solo pago, todo
            // bloqueado): método y monto CENTRADOS en una sola tarjeta, sin
            // rótulos ni coletillas — el dueño pidió no sobrecargar
            // visualmente (2026-07-31). En mixto o con campos editables se
            // queda la presentación de siempre.
            const entryLockedUSD = normalizeMoneyInput(entry.amountUSD);
            const entryLockedVES = normalizeMoneyInput(entry.amountVES);
            const entryRate = Number(info?.exchangeRate || 0);
            const compactLockedHero =
              screenMode &&
              !isMixedReport &&
              lockMethods &&
              lockAmounts &&
              entry.method.trim() !== "" &&
              (entryLockedUSD > 0 || entryLockedVES > 0);

            return (
            <div
              key={`payment-entry-${index}`}
              // En la pantalla dedicada con UN solo pago, el bloque va SIN
              // tarjeta contenedora: método, monto y comprobante respiran
              // directo sobre la página (una caja menos de anidación). En
              // mixto las tarjetas numeradas se quedan — ahí sí agrupan.
              className={
                screenMode && !isMixedReport
                  ? ""
                  : "rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/25 p-3"
              }
            >
              {compactLockedHero ? (
                <div className="rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-4 py-4 text-center">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--brand-ink-2)]/60">
                    {entry.method}
                  </p>
                  <p className="mt-1 text-2xl font-black leading-none text-[var(--brand-ink-3)]">
                    {entryLockedVES > 0
                      ? `Bs ${formatVES(entryLockedVES)}`
                      : formatUSD(entryLockedUSD)}
                  </p>
                  {entryLockedVES > 0 && entryRate > 0 ? (
                    <p className="mt-1 text-[0.72rem] font-bold text-[var(--brand-ink-2)]/55">
                      ≈ {formatUSD(entryLockedVES / entryRate)}
                    </p>
                  ) : null}
                </div>
              ) : (
              <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* En mixto, cada pago es su propia tarjeta numerada: antes
                    había UN bloque de método, UN bloque de captura y un parche
                    suelto para la segunda — que además quedaba FUERA de la
                    tarjeta agrupadora, sin borde ni fondo (2026-07-26). */}
                {isMixedReport ? (
                  <span className="inline-flex rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-black">
                    Pago {index + 1} de {payments.length}
                  </span>
                ) : (
                  <label className="text-[0.78rem] font-bold text-[var(--brand-ink-2)]/75">
                    Método de pago
                  </label>
                )}
                {/* "Quitar" solo si el dueño permite tocar los métodos — la
                    MISMA condición que el botón de agregar más abajo. Antes
                    salía siempre: con los métodos fijados, la fila decía "el
                    que elegiste al pedir" y al lado ofrecía borrarlo, así que
                    el cliente podía dejar el reporte sin una pata (2026-07-26).
                    Con las patas que manda el SERVIDOR tampoco se ofrece:
                    quitarle una al reporte deja el pedido a medio pagar. */}
                {payments.length > 1 &&
                  !serverSentLegs &&
                  !lockMethods &&
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

              {/* Método FIJO siempre que el pedido lo conozca (dueño
                  2026-07-31: el método y las cantidades no se editan al
                  reportar). El texto plano dice por qué está fijo; el select
                  solo queda para el caso sin datos (fetch caído / link en
                  otro teléfono), donde reportar debe seguir siendo posible. */}
              {lockMethods || (!allowMethodChange && chosenMethods.length > 0) ? (
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
                // Monto FIJO (dueño 2026-07-31): la cantidad que decide el
                // pedido no se edita al reportar — se muestra como dato. Solo
                // si no hay monto conocido (sin patas ni total) queda el
                // campo editable de siempre.
                const lockedUSD = normalizeMoneyInput(entry.amountUSD);
                const lockedVES = normalizeMoneyInput(entry.amountVES);
                if (lockAmounts && (lockedUSD > 0 || lockedVES > 0)) {
                  const rate = Number(info?.exchangeRate || 0);
                  return (
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-2 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/50 px-4 py-2.5">
                      <p className="text-base font-black text-[var(--brand-ink-3)]">
                        {lockedVES > 0
                          ? `Bs ${formatVES(lockedVES)}`
                          : formatUSD(lockedUSD)}
                        {lockedVES > 0 && rate > 0 ? (
                          <span className="ml-1.5 text-[0.72rem] font-bold text-[var(--brand-ink-2)]/55">
                            ≈ {formatUSD(lockedVES / rate)}
                          </span>
                        ) : null}
                      </p>
                      {/* "de tu pedido" a secas confundía en mixto: esta cifra
                          es LA PATA de este método, no el total. */}
                      <p className="text-[0.7rem] font-bold text-[var(--brand-ink-2)]/55">
                        — lo que va por este método, no se cambia
                      </p>
                    </div>
                  );
                }

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
              </>
              )}

              {/* El botón "Completar lo que falta" se retiró: el monto ya
                  viene precargado con la pata exacta y no se puede pagar
                  menos — era un botón de más (dueño 2026-07-23). */}

              {/* Los datos para pagar de ESTE método, DENTRO de su tarjeta y
                  abiertos: con dos métodos, PaymentMethodDetailsList los deja
                  cerrados (con uno se auto-abre), así que el cliente tenía que
                  adivinar que ahí estaban los datos. Pasándole un solo método
                  se auto-abre sin tocarle la regla. */}
              {isMixedReport && (paymentMethodDetails[entry.method] || "").trim() ? (
                <div className="mt-2">
                  <PaymentMethodDetailsList
                    details={{ [entry.method]: paymentMethodDetails[entry.method] }}
                  />
                </div>
              ) : null}

              {/* EVIDENCIA DE ESTA PATA. Antes vivía fuera, una sola para todo
                  el reporte: en "Pago móvil + Zelle" bastaba una captura para
                  darlo todo por reportado y caja se quedaba sin cómo verificar
                  la otra mitad (dueño 2026-07-26). Adjuntar va primero porque
                  es lo que hace casi todo el mundo. */}
              {(() => {
                const entryIsCash = isCashReportedMethod(entry.method);
                if (entryIsCash) {
                  return (
                    <p className="mt-3 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-3 py-2.5 text-[0.75rem] font-bold leading-4 text-[var(--brand-ink-2)]/70">
                      Este pago es en efectivo: lo entregas al recibir tu pedido,
                      no hace falta comprobante.
                    </p>
                  );
                }

                // Esta pata YA entró (envío a medias que se reintenta): se
                // dice, y no se le pide evidencia otra vez. Antes el
                // formulario la mostraba como si faltara y el envío la
                // descartaba en silencio.
                if (!allLegsSent && sentLegFlags[index]) {
                  return (
                    <p className="mt-3 inline-flex w-full items-center gap-2 rounded-2xl border-2 border-green-600 bg-green-600/10 px-3 py-2.5 text-[0.75rem] font-bold leading-4 text-green-500">
                      <CheckCircle2 size={15} className="shrink-0" />
                      Este pago ya lo recibimos: no hace falta enviarlo otra vez.
                    </p>
                  );
                }

                // MISMA regla que la validación del envío: con "4821" el sello
                // se ponía verde y después el envío lo rechazaba por
                // referencia incompleta (2026-07-26).
                const hasEvidence = isLegEvidenceComplete({
                  method: entry.method,
                  usd: 0,
                  ves: 0,
                  dataUrl: entry.dataUrl,
                  reference: entry.reference,
                });

                return (
                  <div className="mt-3 rounded-2xl border-2 border-[var(--brand-primary)]/30 bg-[var(--brand-cream)]/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[0.8rem] font-black text-[var(--brand-ink-3)]">
                        {isMixedReport
                          ? `Comprobante de ${entry.method || `este pago`}`
                          : "Haz una de las dos para enviar"}
                      </p>
                      {/* Cuál falta se ve ANTES de tocar Enviar, no después
                          en un error rojo. */}
                      {isMixedReport ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.1em] ${
                            hasEvidence
                              ? "border-green-600 bg-green-600/15 text-green-500"
                              : "border-amber-500 bg-amber-500/10 text-amber-500"
                          }`}
                        >
                          {hasEvidence ? <CheckCircle2 size={12} /> : null}
                          {hasEvidence ? "Listo" : "Falta"}
                        </span>
                      ) : null}
                    </div>
                    {isMixedReport ? (
                      <p className="mt-1 text-[0.7rem] font-bold leading-4 text-[var(--brand-ink-2)]/60">
                        Obligatorio: la captura o la referencia de ESTE pago.
                      </p>
                    ) : null}

                    <label className="mt-2.5 flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--brand-primary)]/50 bg-white px-4 py-4 text-sm font-bold text-[#1a1a1a]/80 transition hover:border-[var(--brand-primary)]">
                      <ImagePlus size={17} className="shrink-0" />
                      {/* min-w-0 + break-all: con la tarjeta de evidencia
                          DENTRO de la del pago quedan ~170px útiles a 375px, y
                          un nombre de Android sin espacios
                          ("Screenshot_20260726-183045_Banesco.jpg") no puede
                          encogerse solo — se salía del recuadro y metía scroll
                          horizontal en toda la página. */}
                      <span className="min-w-0 break-all text-center">
                        {entry.fileName || "Toca para adjuntar la captura"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) =>
                          void handleEntryFileChange(index, event.target.files?.[0])
                        }
                      />
                    </label>

                    {/* En minúscula a propósito: en mayúscula una "O" sola se
                        lee como un cero. */}
                    <p className="mt-2.5 text-center text-[0.74rem] font-bold lowercase text-[var(--brand-ink-2)]/45">
                      o
                    </p>

                    {/* Área de toque de 44px (la casilla de 20px quedaba por
                        debajo del mínimo recomendado en teléfono). */}
                    <label className="mt-1 flex min-h-[44px] cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={entry.wantsReference}
                        onChange={(event) =>
                          updatePaymentEntry(index, {
                            wantsReference: event.target.checked,
                            ...(event.target.checked ? {} : { reference: "" }),
                          })
                        }
                        className="h-6 w-6 shrink-0 accent-[var(--brand-primary)]"
                      />
                      <span className="text-[0.82rem] font-bold text-[var(--brand-ink-2)]/85">
                        Escribir la referencia
                      </span>
                    </label>
                    {entry.wantsReference ? (
                      <input
                        value={entry.reference}
                        onChange={(event) =>
                          updatePaymentEntry(index, { reference: event.target.value })
                        }
                        inputMode="numeric"
                        placeholder="Todos los dígitos de la operación"
                        className="mt-1.5 w-full rounded-2xl border-2 border-[var(--brand-primary)]/40 bg-white px-4 py-3 text-sm font-bold text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/45 focus:border-[var(--brand-primary)]"
                      />
                    ) : null}
                  </div>
                );
              })()}
            </div>
            );
          })}

          {/* Con las patas que manda el servidor no se ofrece agregar otro
              método: el reparto ya está decidido en el pedido. */}
          {payments.length < 3 &&
            !serverSentLegs &&
            !lockMethods &&
            (allowMethodChange || chosenMethods.length === 0) && (
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
          {/* flex-wrap (2026-07-28): en pantallas angostas los dos botones no
              caben en una fila y "Cancelar" se salía del contenedor — ahora
              baja a su propia fila en vez de desbordarse. */}
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_26px_-14px_rgba(0,0,0,0.5)]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => submitProof(false)}
              className="inline-flex min-w-0 flex-1 basis-52 items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="flex-none rounded-full border-2 border-[var(--brand-border)] px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-[var(--brand-ink-2)]/60 transition hover:border-[var(--brand-primary)] disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Overlay de pantalla completa para el formulario (página de seguimiento,
  // formAsScreen): flecha Atrás para volver a la vista del pedido sin
  // enviar; al reportar, el formulario se cierra solo y se vuelve al pedido
  // con sus estados. El mismo componente sigue montado: no se pierde nada.
  if (formAsScreen && isFormOpen) {
    return (
      <div className="fixed inset-0 z-[95] overflow-y-auto bg-[var(--brand-cream)] text-[var(--brand-ink-3)]">
        <div className="mx-auto w-full max-w-lg px-5 py-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setFormError(null);
                setDuplicateWarning(null);
                setCoverageWarning(null);
              }}
              aria-label="Volver a mi pedido"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] text-[var(--brand-ink-2)]/75 transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
            >
              <ArrowLeft size={19} />
            </button>
            <h4 className="text-2xl font-black leading-tight text-[var(--brand-ink-3)]">
              Reporta tu pago
            </h4>
          </div>
          {sectionBody}
        </div>
      </div>
    );
  }

  return sectionBody;
}
