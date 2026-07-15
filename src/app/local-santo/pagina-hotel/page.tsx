"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Loader2, Save } from "lucide-react"
import ModuleAccessGuard from "@/components/ModuleAccessGuard"
import {
  DEFAULT_HOTEL_BOOKING_FIELDS,
  HOTEL_BOOKING_FIELD_DEFINITIONS,
  normalizeHotelBookingFields,
  type HotelBookingFieldId,
  type HotelBookingFieldMode,
  type HotelBookingFieldsConfig,
} from "@/lib/hotelBooking"
import {
  DEFAULT_HOTEL_SITE_EXTRAS,
  DEFAULT_HOTEL_UPSELL,
  normalizeHotelRoomTypeDetails,
  normalizeHotelSiteExtras,
  normalizeHotelUpsell,
  type HotelRoomTypeDetails,
  type HotelRoomTypeDetailsMap,
  type HotelSiteExtras,
  type HotelUpsellConfig,
} from "@/lib/hotelSite"

const OWNER_STORAGE_KEY = "santo_perrito_owner_session"

type Profile = {
  headline: string
  about: string
  amenities: string
  address: string
  phone: string
  email: string
  checkinTime: string
  checkoutTime: string
}

const EMPTY: Profile = {
  headline: "",
  about: "",
  amenities: "",
  address: "",
  phone: "",
  email: "",
  checkinTime: "15:00",
  checkoutTime: "12:00",
}

function authHeaders(): HeadersInit {
  const password =
    typeof window !== "undefined" ? window.sessionStorage.getItem(OWNER_STORAGE_KEY) || "" : ""
  return { "Content-Type": "application/json", "x-admin-password": password }
}

export default function PaginaHotelPage() {
  return (
    <ModuleAccessGuard moduleKey="hotelLanding" moduleName="Página del hotel">
      <PaginaHotelContent />
    </ModuleAccessGuard>
  )
}

function PaginaHotelContent() {
  const [profile, setProfile] = useState<Profile>(EMPTY)
  const [bookingFields, setBookingFields] = useState<HotelBookingFieldsConfig>(
    DEFAULT_HOTEL_BOOKING_FIELDS,
  )
  const [termsText, setTermsText] = useState("")
  const [termsDefault, setTermsDefault] = useState("")
  const [siteExtras, setSiteExtras] = useState<HotelSiteExtras>({ ...DEFAULT_HOTEL_SITE_EXTRAS })
  const [roomTypeDetails, setRoomTypeDetails] = useState<HotelRoomTypeDetailsMap>({})
  const [roomTypes, setRoomTypes] = useState<{ id: string; name: string }[]>([])
  const [upsell, setUpsell] = useState<HotelUpsellConfig>({ ...DEFAULT_HOTEL_UPSELL })
  const [servicesList, setServicesList] = useState<{ id: string; name: string }[]>([])
  const [packagesList, setPackagesList] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/hotel-profile", { headers: authHeaders(), cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setDenied(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo cargar")
      setDenied(false)
      setProfile({ ...EMPTY, ...(data.profile || {}) })
      setBookingFields(normalizeHotelBookingFields(data.bookingFields))
      setTermsText(String(data.termsText || ""))
      setTermsDefault(String(data.termsDefault || ""))
      setSiteExtras(normalizeHotelSiteExtras(data.siteExtras))
      setRoomTypeDetails(normalizeHotelRoomTypeDetails(data.roomTypeDetails))
      setUpsell(normalizeHotelUpsell(data.upsell))

      // Tipos de habitación para el detalle comercial (camas, m², vista…).
      const roomsRes = await fetch("/api/rooms", { headers: authHeaders(), cache: "no-store" })
      if (roomsRes.ok) {
        const roomsData = await roomsRes.json()
        const types = Array.isArray(roomsData.roomTypes) ? roomsData.roomTypes : []
        setRoomTypes(
          types.map((t: { id: unknown; name: unknown }) => ({
            id: String(t.id || ""),
            name: String(t.name || ""),
          })),
        )
      }

      // Servicios y paquetes activos, para asignarles su foto en el motor de
      // reservas. Si el módulo está apagado, la sección simplemente no sale.
      const mapNames = (list: unknown) =>
        Array.isArray(list)
          ? list
              .filter((item: { active?: unknown }) => item && item.active !== false)
              .map((item: { id?: unknown; name?: unknown }) => ({
                id: String(item.id || ""),
                name: String(item.name || ""),
              }))
          : []
      const [servicesRes, packagesRes] = await Promise.all([
        fetch("/api/resort-services", { headers: authHeaders(), cache: "no-store" }),
        fetch("/api/packages", { headers: authHeaders(), cache: "no-store" }),
      ])
      if (servicesRes.ok) {
        const servicesData = await servicesRes.json()
        setServicesList(mapNames(servicesData.services))
      }
      if (packagesRes.ok) {
        const packagesData = await packagesRes.json()
        setPackagesList(mapNames(packagesData.packages))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => ({ ...p, [key]: value }))
    setSaved(false)
  }

  function setFieldMode(id: HotelBookingFieldId, mode: HotelBookingFieldMode) {
    setBookingFields((f) => ({ ...f, [id]: mode }))
    setSaved(false)
  }

  function setExtra<K extends keyof HotelSiteExtras>(key: K, value: HotelSiteExtras[K]) {
    setSiteExtras((x) => ({ ...x, [key]: value }))
    setSaved(false)
  }

  function setTypeDetail(typeId: string, key: keyof HotelRoomTypeDetails, value: string) {
    setRoomTypeDetails((map) => {
      const current = map[typeId] || { beds: "", sizeM2: "", view: "", amenities: "", includes: "" }
      return { ...map, [typeId]: { ...current, [key]: value } }
    })
    setSaved(false)
  }

  function setUpsellField<K extends keyof HotelUpsellConfig>(key: K, value: HotelUpsellConfig[K]) {
    setUpsell((u) => ({ ...u, [key]: value }))
    setSaved(false)
  }

  function setUpsellImage(kind: "serviceImages" | "packageImages", id: string, url: string) {
    setUpsell((u) => {
      const map = { ...u[kind] }
      if (url.trim()) map[id] = url.trim()
      else delete map[id]
      return { ...u, [kind]: map }
    })
    setSaved(false)
  }

  async function save() {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/hotel-profile", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...profile,
          bookingFields,
          termsText,
          siteExtras,
          roomTypeDetails,
          upsell,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo guardar")
      setProfile({ ...EMPTY, ...(data.profile || {}) })
      setBookingFields(normalizeHotelBookingFields(data.bookingFields))
      setTermsText(String(data.termsText || ""))
      setSiteExtras(normalizeHotelSiteExtras(data.siteExtras))
      setRoomTypeDetails(normalizeHotelRoomTypeDetails(data.roomTypeDetails))
      setUpsell(normalizeHotelUpsell(data.upsell))
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-3 font-bold outline-none focus:border-[var(--brand-primary)]"

  return (
    <main className="min-h-screen bg-[var(--brand-cream)] px-4 py-8 text-[var(--brand-ink-2)]">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          <ArrowLeft size={16} /> Volver al panel
        </Link>
        <div className="mt-4 flex items-center justify-between gap-3">
          <h1 className="font-serif text-2xl text-[var(--brand-ink-3)] font-semibold">Página del hotel</h1>
          <a href="/hotel" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-[var(--brand-primary)]/40 bg-white px-3 py-2 text-xs font-bold uppercase text-[var(--brand-primary)]">
            <ExternalLink size={14} /> Ver /hotel
          </a>
        </div>
        <p className="text-sm font-bold text-[var(--brand-ink-2)]/65">Contenido de tu landing pública.</p>

        {denied ? (
          <p className="mt-8 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-5 font-bold text-[var(--brand-primary)]">
            Tu clave no tiene permiso para editar la página, o el módulo está desactivado.
          </p>
        ) : loading ? (
          <p className="mt-8 inline-flex items-center gap-2 font-bold"><Loader2 className="animate-spin" size={18} /> Cargando…</p>
        ) : (
          <div className="mt-6 grid gap-3 rounded-2xl border border-[var(--brand-primary)]/20 bg-white p-4">
            <input value={profile.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Titular (Bienvenido a…)" className={inputClass} />
            <textarea value={profile.about} onChange={(e) => set("about", e.target.value)} placeholder="Descripción del hotel" rows={4} className={inputClass} />
            <textarea value={profile.amenities} onChange={(e) => set("amenities", e.target.value)} placeholder="Amenidades (piscina, wifi, desayuno…)" rows={2} className={inputClass} />
            <input value={profile.address} onChange={(e) => set("address", e.target.value)} placeholder="Dirección" className={inputClass} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={profile.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Teléfono" className={inputClass} />
              <input value={profile.email} onChange={(e) => set("email", e.target.value)} placeholder="Email" className={inputClass} />
              <label className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold">
                <span className="text-xs font-bold uppercase text-[var(--brand-primary)]">Check-in</span>
                <input type="time" value={profile.checkinTime} onChange={(e) => set("checkinTime", e.target.value)} className="w-full bg-transparent font-bold outline-none" />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 px-4 py-2.5 font-bold">
                <span className="text-xs font-bold uppercase text-[var(--brand-primary)]">Check-out</span>
                <input type="time" value={profile.checkoutTime} onChange={(e) => set("checkoutTime", e.target.value)} className="w-full bg-transparent font-bold outline-none" />
              </label>
            </div>
            {/* Portada y estilo de la landing */}
            <div className="rounded-xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]/50 p-4">
              <p className="text-sm font-bold uppercase text-[var(--brand-ink-3)]">Portada y estilo</p>
              <p className="text-xs font-bold text-[var(--brand-ink-2)]/70">
                Los textos vacíos usan el diseño de fábrica. La foto de portada acepta un enlace
                (puedes subirla en Habitaciones → Fotos por tipo y copiar el enlace).
              </p>
              <div className="mt-3 grid gap-3">
                <input value={siteExtras.heroUrl} onChange={(e) => setExtra("heroUrl", e.target.value)} placeholder="Foto de portada (enlace https://…)" className={inputClass} />
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input value={siteExtras.tagline} onChange={(e) => setExtra("tagline", e.target.value)} placeholder="Frase corta bajo las estrellas (Hotel 5 estrellas · Valencia)" className={inputClass} />
                  <label className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-2.5 font-bold">
                    <span className="text-xs font-bold uppercase text-[var(--brand-primary)]">Estrellas</span>
                    <select
                      value={siteExtras.stars}
                      onChange={(e) => setExtra("stars", Number(e.target.value))}
                      className="bg-transparent font-bold outline-none"
                    >
                      {[5, 4, 3, 2, 1, 0].map((n) => (
                        <option key={n} value={n}>{n === 0 ? "Ocultar" : `${n}★`}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <input value={siteExtras.hallmarks} onChange={(e) => setExtra("hallmarks", e.target.value)} placeholder="Sellos separados por coma (5 Estrellas, Suites, Spa & Bienestar…)" className={inputClass} />
                <input value={siteExtras.quote} onChange={(e) => setExtra("quote", e.target.value)} placeholder="Cita de la banda con foto (Una experiencia inolvidable…)" className={inputClass} />
                <input value={siteExtras.mapsQuery} onChange={(e) => setExtra("mapsQuery", e.target.value)} placeholder="Búsqueda del mapa de Google (vacío = usa la dirección)" className={inputClass} />
              </div>
            </div>

            {/* Reseñas de Google (la landing muestra este total y deja 5 visibles) */}
            <div className="rounded-xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]/50 p-4">
              <p className="text-sm font-bold uppercase text-[var(--brand-ink-3)]">Reseñas de Google</p>
              <p className="text-xs font-bold text-[var(--brand-ink-2)]/70">
                Publica el total real de tu ficha de Google Maps: la landing muestra
                &quot;4.8 · 1.240 opiniones&quot; con solo 5 reseñas visibles. En 0 usa las
                reseñas internas del sistema.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-2.5 font-bold">
                  <span className="shrink-0 text-xs font-bold uppercase text-[var(--brand-primary)]">Opiniones</span>
                  <input
                    type="number"
                    min={0}
                    value={siteExtras.googleReviewsCount || ""}
                    onChange={(e) => setExtra("googleReviewsCount", Number(e.target.value) || 0)}
                    placeholder="1240"
                    className="w-full bg-transparent font-bold outline-none"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-[var(--brand-primary)]/25 bg-white px-4 py-2.5 font-bold">
                  <span className="shrink-0 text-xs font-bold uppercase text-[var(--brand-primary)]">Calificación</span>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={siteExtras.googleReviewsRating || ""}
                    onChange={(e) => setExtra("googleReviewsRating", Number(e.target.value) || 0)}
                    placeholder="4.8"
                    className="w-full bg-transparent font-bold outline-none"
                  />
                </label>
                <input
                  value={siteExtras.googleReviewsUrl}
                  onChange={(e) => setExtra("googleReviewsUrl", e.target.value)}
                  placeholder="Enlace a tu ficha de Google (botón 'Ver en Google')"
                  className={`${inputClass} sm:col-span-2`}
                />
              </div>
            </div>

            {/* WhatsApp y redes sociales */}
            <div className="rounded-xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]/50 p-4">
              <p className="text-sm font-bold uppercase text-[var(--brand-ink-3)]">WhatsApp y redes</p>
              <p className="text-xs font-bold text-[var(--brand-ink-2)]/70">
                Con WhatsApp lleno aparece el botón flotante y el enlace en contacto.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input value={siteExtras.whatsapp} onChange={(e) => setExtra("whatsapp", e.target.value)} placeholder="WhatsApp con código de país (58241…)" className={inputClass} />
                <input value={siteExtras.instagram} onChange={(e) => setExtra("instagram", e.target.value)} placeholder="Instagram (usuario)" className={inputClass} />
                <input value={siteExtras.facebook} onChange={(e) => setExtra("facebook", e.target.value)} placeholder="Facebook (usuario o enlace)" className={inputClass} />
                <input value={siteExtras.tiktok} onChange={(e) => setExtra("tiktok", e.target.value)} placeholder="TikTok (usuario)" className={inputClass} />
              </div>
            </div>

            {/* Detalle comercial por tipo de habitación */}
            {roomTypes.length > 0 && (
              <div className="rounded-xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]/50 p-4">
                <p className="text-sm font-bold uppercase text-[var(--brand-ink-3)]">
                  Detalle por tipo de habitación
                </p>
                <p className="text-xs font-bold text-[var(--brand-ink-2)]/70">
                  Camas, tamaño, vista y amenidades salen en la tarjeta pública de cada tipo
                  (como en los hoteles grandes). Deja vacío lo que no aplique.
                </p>
                <div className="mt-3 grid gap-3">
                  {roomTypes.map((t) => {
                    const d = roomTypeDetails[t.id] || {
                      beds: "",
                      sizeM2: "",
                      view: "",
                      amenities: "",
                      includes: "",
                    }
                    return (
                      <div key={t.id} className="rounded-lg border border-[var(--brand-primary)]/15 bg-white p-3">
                        <p className="text-sm font-bold text-[var(--brand-ink-3)]">{t.name}</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          <input value={d.beds} onChange={(e) => setTypeDetail(t.id, "beds", e.target.value)} placeholder="Camas (1 king…)" className={inputClass} />
                          <input value={d.sizeM2} onChange={(e) => setTypeDetail(t.id, "sizeM2", e.target.value)} placeholder="Tamaño m²" className={inputClass} />
                          <input value={d.view} onChange={(e) => setTypeDetail(t.id, "view", e.target.value)} placeholder="Vista (ciudad…)" className={inputClass} />
                        </div>
                        <input value={d.amenities} onChange={(e) => setTypeDetail(t.id, "amenities", e.target.value)} placeholder="Amenidades del tipo separadas por coma (wifi, A/C, TV, minibar…)" className={`${inputClass} mt-2`} />
                        <input
                          value={d.includes || ""}
                          onChange={(e) => setTypeDetail(t.id, "includes", e.target.value)}
                          placeholder="Incluido con la tarifa, separado por coma (desayuno buffet, spa, estacionamiento…)"
                          className={`${inputClass} mt-2`}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Servicios y paquetes ofrecidos al reservar */}
            <div className="rounded-xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]/50 p-4">
              <p className="text-sm font-bold uppercase text-[var(--brand-ink-3)]">
                Extras al reservar (servicios y paquetes)
              </p>
              <p className="text-xs font-bold text-[var(--brand-ink-2)]/70">
                Lo que el huésped puede agregar a su reserva. Con &quot;Solo texto&quot; se
                muestran como menciones sin foto. Las fotos aceptan un enlace (súbelas
                en Habitaciones → Fotos y copia el enlace).
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <label className="flex items-center justify-between gap-2 rounded-lg border border-[var(--brand-primary)]/15 bg-white px-3 py-2">
                  <span className="text-sm font-bold text-[var(--brand-ink-3)]">Ofrecer servicios</span>
                  <input
                    type="checkbox"
                    checked={upsell.showServices}
                    onChange={(e) => setUpsellField("showServices", e.target.checked)}
                    className="h-5 w-5 accent-[var(--brand-primary)]"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 rounded-lg border border-[var(--brand-primary)]/15 bg-white px-3 py-2">
                  <span className="text-sm font-bold text-[var(--brand-ink-3)]">Ofrecer paquetes</span>
                  <input
                    type="checkbox"
                    checked={upsell.showPackages}
                    onChange={(e) => setUpsellField("showPackages", e.target.checked)}
                    className="h-5 w-5 accent-[var(--brand-primary)]"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 rounded-lg border border-[var(--brand-primary)]/15 bg-white px-3 py-2">
                  <span className="text-sm font-bold text-[var(--brand-ink-3)]">Estilo</span>
                  <select
                    value={upsell.style}
                    onChange={(e) => setUpsellField("style", e.target.value === "texto" ? "texto" : "fotos")}
                    className="rounded-lg border border-[var(--brand-primary)]/25 bg-white px-2 py-1.5 text-sm font-bold outline-none"
                  >
                    <option value="fotos">Con fotos</option>
                    <option value="texto">Solo texto</option>
                  </select>
                </label>
              </div>
              {upsell.style === "fotos" && (servicesList.length > 0 || packagesList.length > 0) && (
                <div className="mt-3 grid gap-2">
                  {servicesList.map((s) => (
                    <label key={s.id} className="grid gap-1 rounded-lg border border-[var(--brand-primary)]/15 bg-white px-3 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <span className="truncate text-sm font-bold text-[var(--brand-ink-3)]">{s.name}</span>
                      <input
                        value={upsell.serviceImages[s.id] || ""}
                        onChange={(e) => setUpsellImage("serviceImages", s.id, e.target.value)}
                        placeholder="Foto del servicio (enlace https://…)"
                        className="w-full rounded-lg border border-[var(--brand-primary)]/20 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                      />
                    </label>
                  ))}
                  {packagesList.map((p) => (
                    <label key={p.id} className="grid gap-1 rounded-lg border border-[var(--brand-primary)]/15 bg-white px-3 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <span className="truncate text-sm font-bold text-[var(--brand-ink-3)]">📦 {p.name}</span>
                      <input
                        value={upsell.packageImages[p.id] || ""}
                        onChange={(e) => setUpsellImage("packageImages", p.id, e.target.value)}
                        placeholder="Foto del paquete (enlace https://…)"
                        className="w-full rounded-lg border border-[var(--brand-primary)]/20 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Qué datos pide el formulario de reserva pública */}
            <div className="rounded-xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]/50 p-4">
              <p className="text-sm font-bold uppercase text-[var(--brand-ink-3)]">
                Formulario de reserva
              </p>
              <p className="text-xs font-bold text-[var(--brand-ink-2)]/70">
                Elige qué datos se piden al huésped al reservar en línea. Nombre y teléfono
                siempre son obligatorios.
              </p>
              <div className="mt-3 grid gap-2">
                {HOTEL_BOOKING_FIELD_DEFINITIONS.map((def) => (
                  <label
                    key={def.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--brand-primary)]/15 bg-white px-3 py-2"
                  >
                    <span className="text-sm font-bold text-[var(--brand-ink-3)]">{def.label}</span>
                    <select
                      value={bookingFields[def.id]}
                      onChange={(e) => setFieldMode(def.id, e.target.value as HotelBookingFieldMode)}
                      className="rounded-lg border border-[var(--brand-primary)]/25 bg-white px-2 py-1.5 text-sm font-bold outline-none focus:border-[var(--brand-primary)]"
                    >
                      <option value="off">No pedir</option>
                      <option value="optional">Opcional</option>
                      <option value="required">Obligatorio</option>
                    </select>
                  </label>
                ))}
              </div>
            </div>
            {/* Términos y condiciones de la reserva pública */}
            <div className="rounded-xl border border-[var(--brand-primary)]/15 bg-[var(--brand-cream)]/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold uppercase text-[var(--brand-ink-3)]">
                  Términos y condiciones
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setTermsText(termsDefault)
                    setSaved(false)
                  }}
                  className="rounded-lg border border-[var(--brand-primary)]/25 bg-white px-2.5 py-1 text-xs font-bold uppercase text-[var(--brand-primary)]"
                >
                  Usar texto estándar
                </button>
              </div>
              <p className="mt-1 text-xs font-bold text-[var(--brand-ink-2)]/70">
                El huésped debe aceptarlos para reservar (se leen en /hotel/terminos). Si lo dejas
                vacío, se usa el texto estándar de la industria.
              </p>
              <textarea
                value={termsText}
                onChange={(e) => {
                  setTermsText(e.target.value)
                  setSaved(false)
                }}
                placeholder={termsDefault}
                rows={8}
                className={`${inputClass} mt-2 text-sm`}
              />
            </div>
            {error && <p className="font-bold text-red-600">{error}</p>}
            <button onClick={save} disabled={busy} className="inline-flex items-center justify-center gap-1 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-bold uppercase text-white disabled:opacity-50">
              {busy ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} {saved ? "Guardado ✓" : "Guardar página"}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
