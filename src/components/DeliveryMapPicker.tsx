"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";

type DeliveryMapPickerProps = {
  // Centro inicial: el punto ya elegido por el cliente o, si no hay, el
  // local del negocio (viene del GET público de delivery-quote).
  initialLat: number;
  initialLng: number;
  onConfirm: (coords: { lat: number; lng: number }) => void;
  onClose: () => void;
};

// Mapa "elige tu punto de entrega" sin permisos del navegador: el pin queda
// fijo al centro y el cliente arrastra el mapa hasta su casa (el mismo patrón
// de las apps grandes de delivery). Funciona incluso dentro del navegador de
// WhatsApp/Instagram, donde el GPS suele estar bloqueado.
export default function DeliveryMapPicker({
  initialLat,
  initialLng,
  onConfirm,
  onClose,
}: DeliveryMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    let disposed = false;

    async function initMap() {
      // Leaflet toca window al importarse: solo se carga en el cliente y
      // únicamente cuando el cliente abre el mapa (no infla el bundle base).
      const leaflet = await import("leaflet");

      if (disposed || !containerRef.current || mapRef.current) return;

      const map = leaflet.map(containerRef.current, {
        center: [initialLat, initialLng],
        zoom: 16,
        zoomControl: true,
      });

      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
        .addTo(map);

      mapRef.current = map;
      setIsMapReady(true);
    }

    void initMap();

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initialLat, initialLng]);

  function handleConfirm() {
    const map = mapRef.current;
    if (!map) return;

    const center = map.getCenter();
    onConfirm({ lat: center.lat, lng: center.lng });
  }

  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-black/70 p-3 sm:items-center sm:justify-center">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[1.5rem] border-2 border-[var(--brand-border)] bg-[var(--brand-surface-2)] sm:h-[80vh] sm:max-w-lg">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
            Mueve el mapa hasta tu punto de entrega
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar mapa"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[var(--brand-border)] bg-[var(--brand-cream)] text-[var(--brand-ink)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative flex-1">
          <div ref={containerRef} className="absolute inset-0" />

          {!isMapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--brand-cream)]">
              <Loader2
                size={28}
                className="animate-spin text-[var(--brand-primary)]"
              />
            </div>
          )}

          {/* Pin fijo al centro: el punto elegido es siempre el centro del
              mapa. pointer-events-none para no robarle el arrastre al mapa;
              z-index sobre los panes de Leaflet (~400). */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full">
            <MapPin
              size={38}
              strokeWidth={2.5}
              className="text-[var(--brand-primary)] drop-shadow-[0_2px_2px_rgba(0,0,0,0.45)]"
              fill="var(--brand-accent)"
            />
          </div>
        </div>

        <div className="space-y-2 px-4 py-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isMapReady}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-3.5 text-xs font-black uppercase tracking-[0.1em] text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MapPin size={16} />
            Entregar en este punto
          </button>
          <p className="text-center text-[0.68rem] font-bold leading-4 text-[var(--brand-ink-2)]/55">
            Acerca el mapa y deja el pin justo sobre tu casa o edificio.
          </p>
        </div>
      </div>
    </div>
  );
}
