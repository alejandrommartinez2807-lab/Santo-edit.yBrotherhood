"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";

// Mini mapa SOLO de lectura: muestra el punto de entrega elegido (como la
// tarjeta "Confirmar dirección" de las apps grandes). No se puede arrastrar;
// para mover el pin está el botón "Ajustar" que abre el mapa interactivo.
export default function DeliveryPointPreviewMap({
  lat,
  lng,
  heightClassName = "h-36",
}: {
  lat: number;
  lng: number;
  heightClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    let disposed = false;

    async function initMap() {
      const leaflet = await import("leaflet");

      if (disposed || !containerRef.current) return;

      if (mapRef.current) {
        // Si el punto cambió (ajustó el marcador), solo se recentra.
        mapRef.current.setView([lat, lng], 16, { animate: false });
        return;
      }

      const map = leaflet.map(containerRef.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: false,
      });

      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        })
        .addTo(map);

      mapRef.current = map;
      setIsMapReady(true);
    }

    void initMap();

    return () => {
      disposed = true;
    };
  }, [lat, lng]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    // "isolate" encierra los z-index internos de Leaflet (llegan a 400+): sin
    // esto el mapa se pinta ENCIMA de la barra superior fija del checkout.
    <div
      className={`pointer-events-none relative isolate w-full overflow-hidden rounded-2xl border-2 border-[var(--brand-border)] ${heightClassName}`}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {!isMapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--brand-cream)]">
          <Loader2
            size={22}
            className="animate-spin text-[var(--brand-primary)]"
          />
        </div>
      )}

      <div className="absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full">
        <MapPin
          size={34}
          strokeWidth={2.5}
          className="text-[var(--brand-primary)] drop-shadow-[0_2px_2px_rgba(0,0,0,0.45)]"
          fill="var(--brand-accent)"
        />
      </div>
    </div>
  );
}
