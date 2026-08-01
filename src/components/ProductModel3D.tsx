"use client";

// Visor 3D + Realidad Aumentada de un plato, dentro de la ficha del producto.
//
// Reglas de peso: la librería <model-viewer> pesa ~300 KB y la carta pública la
// abren clientes con datos móviles. Por eso NO se importa arriba: entra por
// import() dinámico dentro del efecto, o sea que solo se descarga cuando este
// componente se monta — y este componente solo se monta cuando el cliente abre
// la ficha de un producto QUE TIENE modelo. Mientras carga (o si falla) se ve
// exactamente la misma foto de siempre.

import Image from "next/image";
import { useEffect, useState } from "react";
import { Loader2, Rotate3d, Smartphone } from "lucide-react";

type ProductModel3DProps = {
  modelUrl: string;
  iosModelUrl?: string;
  posterUrl: string;
  name: string;
  /** Alto del visor: se le pasa el mismo que tenía la foto de la ficha. */
  className?: string;
};

// iPhone/iPad: la Realidad Aumentada la resuelve AR Quick Look y SOLO acepta
// .usdz. Sin ese archivo el plato igual gira en 3D, pero no se ofrece AR (un
// botón que no hace nada es peor que no tener botón).
function detectIsIOS() {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";

  if (/iPad|iPhone|iPod/i.test(userAgent)) return true;

  // iPadOS 13+ se hace pasar por Mac de escritorio.
  return /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
}

function PosterImage({ posterUrl, name }: { posterUrl: string; name: string }) {
  return (
    <Image
      src={posterUrl}
      alt={name}
      width={960}
      height={640}
      unoptimized
      className="h-full w-full object-cover"
      onError={(event) => {
        event.currentTarget.src = "/logoremovebg.png";
      }}
    />
  );
}

export default function ProductModel3D({
  modelUrl,
  iosModelUrl,
  posterUrl,
  name,
  className = "h-64 w-full sm:h-96",
}: ProductModel3DProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;

    import("@google/model-viewer")
      .then(() => {
        if (!cancelled) setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Si la librería no cargó (sin datos, red caída), el producto se ve como
  // siempre: la foto. Nunca un cuadro vacío ni un error en la cara del cliente.
  if (status === "failed") {
    return (
      <div className={`relative ${className}`}>
        <PosterImage posterUrl={posterUrl} name={name} />
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className={`relative ${className}`}>
        <PosterImage posterUrl={posterUrl} name={name} />
        <span className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-[rgba(var(--brand-primary-rgb),0.5)] bg-black/70 px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.14em] text-[var(--brand-primary)] backdrop-blur-sm">
          <Loader2 size={12} className="animate-spin" />
          Cargando 3D
        </span>
      </div>
    );
  }

  // AR disponible: en iPhone hace falta el .usdz; en Android alcanza el .glb
  // (Scene Viewer). En escritorio <model-viewer> esconde el botón solo.
  // Se calcula acá y no en un estado porque a esta altura `status` ya es
  // "ready", o sea que estamos en el cliente y `navigator` existe (el servidor
  // nunca renderiza esta rama: no hay riesgo de desajuste de hidratación).
  const canOfferAR = detectIsIOS() ? Boolean(iosModelUrl) : true;

  return (
    <div className={`relative ${className}`}>
      {/* touch-action="pan-y": el dedo sigue pudiendo desplazar la ficha hacia
          abajo; el giro del plato se toma solo en horizontal. */}
      <model-viewer
        src={modelUrl}
        ios-src={iosModelUrl || undefined}
        alt={name}
        poster={posterUrl}
        ar={canOfferAR}
        ar-modes="webxr scene-viewer quick-look"
        ar-scale="auto"
        ar-placement="floor"
        camera-controls
        auto-rotate
        rotation-per-second="18deg"
        touch-action="pan-y"
        shadow-intensity="1"
        environment-image="neutral"
        exposure="1"
        reveal="auto"
        loading="eager"
        className="h-full w-full bg-black"
      >
        {canOfferAR ? (
          // Sin posicionamiento propio: <model-viewer> ya coloca este slot
          // abajo y centrado. Solo le damos el look de la marca.
          <button
            slot="ar-button"
            type="button"
            className="flex items-center gap-2 whitespace-nowrap rounded-full bg-[var(--brand-primary)] px-4 py-2.5 text-[0.7rem] font-black uppercase tracking-[0.1em] text-black shadow-[0_12px_30px_-12px_rgba(var(--brand-primary-rgb),0.9)] transition hover:brightness-110 active:scale-[0.98]"
          >
            <Smartphone size={14} />
            Ver en tu mesa
          </button>
        ) : null}
      </model-viewer>

      {/* Arriba al centro: no choca con la categoría (izquierda) ni con la X
          de cerrar (derecha) de la ficha. */}
      <span className="pointer-events-none absolute left-1/2 top-4 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[rgba(var(--brand-primary-rgb),0.5)] bg-black/70 px-3 py-1.5 text-[0.6rem] font-black uppercase tracking-[0.12em] text-[var(--brand-primary)] backdrop-blur-sm">
        <Rotate3d size={12} />
        Gíralo con el dedo
      </span>
    </div>
  );
}
