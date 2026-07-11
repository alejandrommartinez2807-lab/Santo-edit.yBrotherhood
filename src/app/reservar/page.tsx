"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarCheck, CheckCircle2, Loader2, Users } from "lucide-react";
import { BRAND } from "@/lib/brand";

type CreatedReservation = {
  tableName: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  partySize: number;
};

// Reserva online pública: fecha + hora + personas; la mesa la asigna el
// sistema entre las mesas activas libres y la reserva cae directo en el
// módulo Reservas del panel. Franja fija de 90 minutos (misma regla del API).
export default function ReservarPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [reservationDate, setReservationDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [created, setCreated] = useState<CreatedReservation | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAvailability() {
      try {
        const response = await fetch("/api/public/reservations", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));

        if (!cancelled) setEnabled(Boolean(response.ok && data.enabled));
      } catch {
        if (!cancelled) setEnabled(false);
      }
    }

    checkAvailability();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/public/reservations${window.location.search}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          reservationDate,
          startTime,
          partySize,
          note,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setErrorMessage(String(data.error || "No se pudo registrar la reserva. Intenta de nuevo."));
        return;
      }

      setCreated(data.reservation as CreatedReservation);
    } catch {
      setErrorMessage("Sin conexión. Revisa tu internet e intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClassName =
    "w-full rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-3 text-sm font-bold text-[var(--brand-ink-3)] outline-none transition focus:border-[var(--brand-primary)] placeholder:text-[var(--brand-ink-2)]/40";

  const labelClassName =
    "text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-ink-2)]/70";

  return (
    <main className="flex min-h-screen items-start justify-center bg-[var(--brand-cream)] px-4 py-10 text-[var(--brand-ink-2)]">
      <section className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-ink-2)]/60 transition hover:text-[var(--brand-primary)]"
        >
          <ArrowLeft size={15} />
          Volver al menú
        </Link>

        <div className="mt-4 rounded-[2rem] border-4 border-[var(--brand-primary)] bg-[var(--brand-surface-2)] p-7 shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.12)]">
          {created ? (
            <div className="text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-primary)] text-black">
                <CheckCircle2 size={34} />
              </span>
              <h1 className="mt-4 text-2xl font-black uppercase text-[var(--brand-ink-3)]">
                ¡Reserva registrada!
              </h1>
              <div className="mt-5 space-y-2 rounded-2xl border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] px-4 py-4 text-left text-sm font-bold text-[var(--brand-ink-2)]/85">
                <p>
                  <span className="text-[var(--brand-primary)]">Fecha:</span> {created.reservationDate}
                </p>
                <p>
                  <span className="text-[var(--brand-primary)]">Hora:</span> {created.startTime} a {created.endTime}
                </p>
                <p>
                  <span className="text-[var(--brand-primary)]">Personas:</span> {created.partySize}
                </p>
                <p>
                  <span className="text-[var(--brand-primary)]">Mesa asignada:</span> {created.tableName}
                </p>
              </div>
              <p className="mt-4 text-xs font-bold leading-5 text-[var(--brand-ink-2)]/60">
                Guarda esta pantalla o toma captura. Si no puedes asistir, avísanos por WhatsApp
                para liberar la mesa.
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-black"
              >
                Volver al menú
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-primary)] text-black">
                  <CalendarCheck size={28} />
                </span>
                <h1 className="mt-4 text-2xl font-black uppercase text-[var(--brand-ink-3)]">
                  Reserva tu mesa
                </h1>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--brand-ink-2)]/70">
                  En {BRAND.name} te guardamos la mesa por 90 minutos desde tu hora de llegada.
                </p>
              </div>

              {enabled === null ? (
                <p className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-[var(--brand-ink-2)]/60">
                  <Loader2 size={16} className="animate-spin text-[var(--brand-primary)]" />
                  Consultando disponibilidad…
                </p>
              ) : null}

              {enabled === false ? (
                <div className="mt-6 rounded-2xl border-2 border-yellow-500/60 bg-yellow-500/10 px-4 py-3 text-center text-sm font-bold leading-6 text-yellow-500">
                  Las reservas online no están disponibles por ahora. Escríbenos por WhatsApp o
                  visítanos directamente.
                </div>
              ) : null}

              {enabled ? (
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="reserva-nombre" className={labelClassName}>
                      Nombre y apellido
                    </label>
                    <input
                      id="reserva-nombre"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Ej: María Pérez"
                      maxLength={80}
                      required
                      className={inputClassName}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="reserva-telefono" className={labelClassName}>
                      Teléfono (WhatsApp)
                    </label>
                    <input
                      id="reserva-telefono"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="0412-0000000"
                      inputMode="tel"
                      maxLength={25}
                      required
                      className={inputClassName}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label htmlFor="reserva-fecha" className={labelClassName}>
                        Fecha
                      </label>
                      <input
                        id="reserva-fecha"
                        type="date"
                        value={reservationDate}
                        onChange={(event) => setReservationDate(event.target.value)}
                        required
                        className={inputClassName}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="reserva-hora" className={labelClassName}>
                        Hora de llegada
                      </label>
                      <input
                        id="reserva-hora"
                        type="time"
                        value={startTime}
                        onChange={(event) => setStartTime(event.target.value)}
                        required
                        className={inputClassName}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="reserva-personas" className={labelClassName}>
                      <span className="inline-flex items-center gap-1.5">
                        <Users size={13} />
                        Personas
                      </span>
                    </label>
                    <input
                      id="reserva-personas"
                      type="number"
                      min={1}
                      max={30}
                      value={partySize}
                      onChange={(event) => setPartySize(Math.max(1, Number(event.target.value) || 1))}
                      required
                      className={inputClassName}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="reserva-nota" className={labelClassName}>
                      Nota (opcional)
                    </label>
                    <textarea
                      id="reserva-nota"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Cumpleaños, silla para bebé, zona preferida…"
                      maxLength={200}
                      rows={2}
                      className={`${inputClassName} resize-none`}
                    />
                  </div>

                  {errorMessage ? (
                    <p className="rounded-2xl border-2 border-red-500/50 bg-red-500/10 px-4 py-3 text-sm font-bold leading-5 text-red-300">
                      {errorMessage}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-black transition hover:opacity-90 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={17} className="animate-spin" />
                        Registrando…
                      </>
                    ) : (
                      "Confirmar reserva"
                    )}
                  </button>
                </form>
              ) : null}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
