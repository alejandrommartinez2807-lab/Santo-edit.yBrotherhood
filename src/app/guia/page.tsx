import type { Metadata } from "next"
import { BRAND } from "@/lib/brand"

// Guía completa del sistema para presentarle al propietario cómo funciona
// cada área (pública y privada), en qué fase está y hacia dónde crece.
// No se indexa: es una página para compartir por link directo.
export const metadata: Metadata = {
  title: `Guía del sistema · ${BRAND.name}`,
  description: "Cómo funciona la plataforma digital del centro comercial: portal público, cuenta del comerciante y panel de administración.",
  robots: { index: false, follow: false },
}

export const dynamic = "force-static"

const C = {
  ink: "#163243",
  soft: "#3f5a6b",
  faint: "#7c93a6",
  line: "#dcecf5",
  blue: "#0f9bd7",
  deep: "#0a6f9c",
  magenta: "#e5007e",
  amber: "#f9a800",
}

type Area = { icon: string; title: string; href?: string; desc: string; points: string[] }

const PUBLICO: Area[] = [
  {
    icon: "🏬",
    title: "Portal y directorio",
    href: "/portal",
    desc: "La cara del centro comercial en internet. Cualquier visitante, sin registrarse, encuentra lo que busca.",
    points: [
      "Directorio completo con buscador y filtros por rubro (comida, moda, salud, belleza…).",
      "Las promociones vigentes de cada local se ven directo en su tarjeta.",
      "Servicios del centro comercial y sección de alquiler de locales con contacto por WhatsApp.",
    ],
  },
  {
    icon: "🛍️",
    title: "La web propia de cada local",
    href: "/tienda/capitan-grill",
    desc: "Cada local tiene su propia página dentro del portal, con identidad y color propios.",
    points: [
      "Portada, logo, historia, horario y ubicación dentro del centro comercial.",
      "Productos y servicios con foto y precio, más la promoción destacada.",
      "Botones directos de WhatsApp, llamada e Instagram del local.",
      "La edita la administración desde el panel o el propio comerciante desde su cuenta.",
    ],
  },
  {
    icon: "🗺️",
    title: "Mapa por niveles",
    href: "/mapa",
    desc: "El directorio organizado por planta baja, mezzanina, feria de comida y torre médica.",
    points: [
      "Cada local con página propia se abre con un toque desde el mapa.",
    ],
  },
  {
    icon: "🅿️",
    title: "Estacionamiento autoservicio",
    href: "/estacionamiento",
    desc: "El visitante maneja su ticket desde el teléfono, sin apps, sin registro y sin caja manual.",
    points: [
      "Al llegar escanea el afiche QR de la entrada y genera su propio ticket.",
      "El ticket muestra la tarifa vigente, el tiempo transcurrido y el monto en vivo.",
      "Paga desde el teléfono: pago móvil, tarjeta, efectivo o transferencia; si paga en divisas en efectivo se suma el IGTF y ve el equivalente en bolívares a tasa BCV.",
      "El teléfono recuerda su último ticket y también puede escanear el QR con la cámara.",
      "En la salida, el vigilante confirma el pago desde el panel.",
    ],
  },
  {
    icon: "🩺",
    title: "Torre médica: citas en línea",
    href: "/consultorios",
    desc: "Los pacientes reservan su cita sin llamar a nadie.",
    points: [
      "Ven los doctores, especialidades y horarios reales.",
      "Eligen día y cupo disponible; el sistema no permite reservar dos veces el mismo cupo.",
    ],
  },
  {
    icon: "💬",
    title: "Atención al cliente",
    href: "/contacto",
    desc: "Un canal formal para el público, ordenado para la administración.",
    points: [
      "Reclamos, sugerencias, objetos perdidos y solicitudes de local.",
      "Todo llega al panel con estado y prioridad para hacerle seguimiento.",
    ],
  },
]

const COMERCIANTE: Area[] = [
  {
    icon: "💳",
    title: "Su estado de cuenta",
    desc: "Canon, condominio y saldo pendiente con sus recibos, sin llamar a la administración.",
    points: ["Reporta sus pagos con referencia y la administración los confirma."],
  },
  {
    icon: "🌐",
    title: "Su página web",
    desc: "El comerciante edita su propia mini-web: fotos, textos, horario, promoción, productos y color.",
    points: ["Publicar o despublicar su página es un interruptor."],
  },
  {
    icon: "📈",
    title: "Sus ventas del mes",
    desc: "Si su contrato tiene renta porcentual, reporta las ventas brutas y ve al momento cuánto le corresponde.",
    points: ["Sin planillas ni correos: el cálculo sale solo con la tasa y el mínimo de su contrato."],
  },
  {
    icon: "🛠️",
    title: "Operación diaria",
    desc: "Incidencias de mantenimiento con seguimiento, comunicados de la administración, votaciones, visitas y documentos.",
    points: ["Todo con su teléfono y un código de acceso que le entrega la administración."],
  },
]

const PANEL_DINERO: Area[] = [
  { icon: "📊", title: "Resumen", desc: "La foto del mes en una pantalla: ocupación, morosidad e ingresos por fuente (canon, condominio, renta %, estacionamiento y publicidad).", points: [] },
  { icon: "🏬", title: "Locales y comerciantes", desc: "Los espacios del centro comercial con su código, rubro, piso, estado y la web de cada local; los inquilinos con sus contactos y accesos.", points: [] },
  { icon: "📃", title: "Contratos", desc: "Canon, depósito, vigencia, mora, fiador y renta porcentual con mínimo garantizado. Alerta de contratos por vencer.", points: [] },
  { icon: "📈", title: "Ventas y renta porcentual", desc: "Las ventas mensuales por local (las reporta el comerciante o la administración) con la renta calculada en vivo.", points: [] },
  { icon: "🧾", title: "Canon y condominio", desc: "Con un botón se emite el cobro del mes a todos los locales: canon + condominio por alícuota + renta porcentual. Las alícuotas se pueden desactivar si el modelo del centro comercial no las usa.", points: [] },
  { icon: "💵", title: "Estado de cuenta", desc: "Pagos reportados, confirmación, saldos y morosos.", points: [] },
  { icon: "🏛️", title: "Fiscal", desc: "Modo recibos (no fiscal) o facturas, RIF, IGTF configurable. La base queda lista para facturación fiscal cuando se decida.", points: [] },
]

const PANEL_OPERACION: Area[] = [
  { icon: "🅿️", title: "Estacionamiento", desc: "Tarifa siempre a la vista y editable, vehículos adentro con monto en vivo, confirmación de pagos, cortesías, abonados y el afiche QR para imprimir.", points: [] },
  { icon: "📢", title: "Publicidad", desc: "Pantallas, vallas, banners y redes con sus contrataciones, fechas y precios.", points: [] },
  { icon: "🩺", title: "Consultorios", desc: "Doctores, horarios semanales y la agenda de citas que entra desde la página pública.", points: [] },
  { icon: "🛡️", title: "Seguridad", desc: "Bitácora de vigilancia: rondas, incidentes, accesos y objetos perdidos con gravedad y cierre.", points: [] },
  { icon: "⭐", title: "Fidelidad", desc: "Clientes frecuentes con puntos por compras y canjes.", points: [] },
  { icon: "📄", title: "Documentos", desc: "Biblioteca real del centro comercial: reglamentos, circulares y planillas en PDF que el comerciante ve desde su cuenta.", points: [] },
  { icon: "🗂️", title: "Y el día a día completo", desc: "Comunicados, asambleas, control de accesos, áreas comunes, incidencias de mantenimiento, galería y atención al cliente.", points: [] },
]

const FUTURO = [
  { icon: "🚀", title: "Puesta en marcha con datos reales", desc: "Carga de los locales, contratos y tarifas reales del centro comercial, con acompañamiento y capacitación del equipo." },
  { icon: "🌍", title: "Dominio propio", desc: "La plataforma con la dirección del centro comercial (por ejemplo conceptolagranja.com) y su correo." },
  { icon: "👥", title: "Cuentas por rol para el equipo", desc: "Accesos separados para administración, caja, vigilancia y mantenimiento, cada uno con lo suyo." },
  { icon: "🧾", title: "Facturación fiscal", desc: "Cuando el centro comercial lo decida, se conecta la facturación homologada sin cambiar de plataforma." },
  { icon: "🔗", title: "Ventas automáticas para la renta porcentual", desc: "Los locales que usen el punto de venta integrado reportan sus ventas solas, sin escribir nada." },
  { icon: "📱", title: "App instalable y notificaciones", desc: "El portal se instala como aplicación en el teléfono y avisa de pagos, citas y comunicados." },
  { icon: "📈", title: "Reportes gerenciales", desc: "Cierres mensuales, comparativos de ingresos y exportes a Excel para la junta." },
]

export default function GuiaPage() {
  return (
    <div style={{ background: "#f6fbfe", color: C.ink, fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif", minHeight: "100vh" }}>
      {/* NAV */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(246,251,254,.92)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/concepto-logo.png" alt="" width={36} height={36} style={{ borderRadius: 9 }} />
          <strong style={{ fontSize: 16 }}>{BRAND.name} · Guía del sistema</strong>
          <a href="/portal" style={{ marginLeft: "auto", color: C.deep, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>Ir al portal →</a>
        </div>
      </header>

      {/* HERO */}
      <section style={{ background: `linear-gradient(150deg, ${C.deep}, ${C.blue})`, color: "#fff" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "46px 20px 40px" }}>
          <span style={{ display: "inline-block", background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.35)", borderRadius: 999, padding: "5px 14px", fontSize: 13, fontWeight: 700 }}>
            Versión beta · en funcionamiento con datos de demostración
          </span>
          <h1 style={{ fontSize: 38, lineHeight: 1.12, fontWeight: 800, margin: "16px 0 10px", maxWidth: 640 }}>
            Cómo funciona la plataforma digital del centro comercial
          </h1>
          <p style={{ fontSize: 17, opacity: 0.94, maxWidth: 640, lineHeight: 1.6, margin: 0 }}>
            Un solo sistema con tres caras: lo que ve el <b>visitante</b>, lo que maneja cada <b>comerciante</b> desde su cuenta,
            y el <b>panel privado</b> desde donde la administración controla todo el centro comercial. Todos los enlaces de esta
            guía se pueden probar ahora mismo.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "0 20px 60px" }}>
        {/* PÚBLICO */}
        <SectionTitle n="1" title="Lo que ve el visitante" subtitle="Abierto para cualquier persona, desde el teléfono, sin registrarse." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 16 }}>
          {PUBLICO.map((a) => <AreaCard key={a.title} a={a} />)}
        </div>

        {/* COMERCIANTE */}
        <SectionTitle n="2" title="La cuenta de cada comerciante" subtitle="Cada inquilino entra con su teléfono y un código de acceso." link={{ href: "/mi-cuenta", label: "mi-cuenta" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 16 }}>
          {COMERCIANTE.map((a) => <AreaCard key={a.title} a={a} />)}
        </div>

        {/* PANEL */}
        <SectionTitle n="3" title="El panel privado de administración" subtitle="El corazón del sistema. Se entra con clave privada." link={{ href: "/panel", label: "panel" }} />
        <h3 style={groupTitle}>Administración y dinero</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 14 }}>
          {PANEL_DINERO.map((a) => <AreaCard key={a.title} a={a} compact />)}
        </div>
        <h3 style={groupTitle}>Operación diaria</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 14 }}>
          {PANEL_OPERACION.map((a) => <AreaCard key={a.title} a={a} compact />)}
        </div>

        {/* FLUJO DEL DINERO */}
        <SectionTitle n="4" title="Cómo fluye el dinero" subtitle="El ciclo mensual completo, sin planillas ni cuadernos." />
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 18, padding: "22px 22px 10px" }}>
          {[
            ["Contratos", "Cada local tiene su contrato con canon, condominio y, si aplica, renta porcentual con mínimo garantizado."],
            ["Ventas", "El comerciante reporta sus ventas del mes desde su cuenta (o la administración las carga) y el sistema calcula la renta porcentual."],
            ["Emisión", "Con un botón se emite el cobro del mes a todos los locales: cada uno recibe su cargo y su recibo, y su saldo se actualiza."],
            ["Pagos", "El comerciante reporta su pago con referencia; la administración lo confirma y la morosidad baja sola. El resumen muestra los ingresos por fuente."],
          ].map(([t, d], i) => (
            <div key={t} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: i < 3 ? `1px solid #eef5fa` : "none", alignItems: "flex-start" }}>
              <span style={{ background: C.blue, color: "#fff", borderRadius: 999, minWidth: 30, height: 30, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 14 }}>{i + 1}</span>
              <div><b>{t}.</b> <span style={{ color: C.soft }}>{d}</span></div>
            </div>
          ))}
        </div>

        {/* BETA Y FUTURO */}
        <SectionTitle n="5" title="En qué fase está y hacia dónde crece" subtitle="Todo lo descrito arriba ya funciona; está cargado con datos de demostración para poderlo recorrer completo." />
        <div style={{ background: `linear-gradient(120deg, ${C.amber}22, ${C.magenta}14)`, border: `1px solid ${C.line}`, borderRadius: 18, padding: "18px 22px", marginBottom: 18 }}>
          <b>Fase actual: beta funcional.</b>
          <span style={{ color: C.soft }}> La plataforma está completa y operativa con un centro comercial de demostración (41 locales, contratos, cobros, estacionamiento, citas médicas). Es la versión para recorrer, opinar y ajustar antes de cargarla con la información real.</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 14 }}>
          {FUTURO.map((f) => (
            <div key={f.title} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 26 }}>{f.icon}</div>
              <div style={{ fontWeight: 800, margin: "8px 0 4px" }}>{f.title}</div>
              <div style={{ fontSize: 14, color: C.soft, lineHeight: 1.55 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* CIERRE */}
        <div style={{ marginTop: 34, background: `linear-gradient(120deg, ${C.deep}, ${C.blue})`, color: "#fff", borderRadius: 20, padding: "28px 26px", textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Recorra el sistema ahora mismo</div>
          <p style={{ opacity: 0.92, margin: "0 0 18px", fontSize: 15 }}>Empiece por el portal y toque cualquier tienda del directorio.</p>
          <a href="/portal" style={{ display: "inline-block", background: "#fff", color: C.deep, fontWeight: 800, borderRadius: 12, padding: "13px 26px", textDecoration: "none", fontSize: 15 }}>Abrir el portal</a>
        </div>
      </div>

      <footer style={{ borderTop: `1px solid ${C.line}`, padding: "20px", textAlign: "center", color: C.faint, fontSize: 13 }}>
        © {new Date().getFullYear()} {BRAND.name} · {BRAND.location}
      </footer>
    </div>
  )
}

function SectionTitle({ n, title, subtitle, link }: { n: string; title: string; subtitle: string; link?: { href: string; label: string } }) {
  return (
    <div style={{ margin: "40px 0 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ background: C.magenta, color: "#fff", borderRadius: 10, padding: "3px 11px", fontWeight: 800, fontSize: 14 }}>{n}</span>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{title}</h2>
        {link && <a href={link.href} style={{ color: C.deep, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>({link.label} →)</a>}
      </div>
      <p style={{ color: C.faint, margin: "6px 0 0", fontSize: 14 }}>{subtitle}</p>
    </div>
  )
}

function AreaCard({ a, compact }: { a: Area; compact?: boolean }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 24 }}>{a.icon}</span>
        <div style={{ fontWeight: 800, fontSize: 15.5 }}>{a.title}</div>
      </div>
      <p style={{ fontSize: 14, color: C.soft, lineHeight: 1.55, margin: "8px 0 0" }}>{a.desc}</p>
      {a.points.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: C.soft, fontSize: compact ? 13 : 13.5, lineHeight: 1.55 }}>
          {a.points.map((p) => <li key={p} style={{ marginBottom: 3 }}>{p}</li>)}
        </ul>
      )}
      {a.href && (
        <a href={a.href} style={{ marginTop: "auto", paddingTop: 12, color: C.deep, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
          Probarlo →
        </a>
      )}
    </div>
  )
}

const groupTitle: React.CSSProperties = { fontSize: 16, fontWeight: 800, color: C.deep, margin: "18px 0 10px" }
