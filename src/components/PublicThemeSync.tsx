"use client";

import { useEffect } from "react";
import { buildBrandThemeCss } from "@/lib/theme";
import { BRANCH_CHANGE_EVENT } from "@/lib/branchClient";
import { publicApiUrl } from "@/lib/publicApiUrl";
import { setPublicCurrencySymbol } from "@/utils/formatCurrency";

type PublicThemeConfig = {
  themePrimaryColor?: unknown;
  themeAccentColor?: unknown;
  themeCreamColor?: unknown;
  publicCurrencySymbol?: unknown;
};

function getBusinessConfigPayload(value: unknown): PublicThemeConfig {
  if (!value || typeof value !== "object") return {};

  const source = value as Record<string, unknown>;
  const businessConfig = source.businessConfig;

  if (businessConfig && typeof businessConfig === "object") {
    return businessConfig as PublicThemeConfig;
  }

  return source as PublicThemeConfig;
}

function applyThemeCss(css: string) {
  if (!css) return;

  const existingStyle =
    document.getElementById("brand-theme") ||
    document.getElementById("brand-theme-client");

  if (existingStyle) {
    existingStyle.textContent = css;
    return;
  }

  const style = document.createElement("style");
  style.id = "brand-theme-client";
  style.textContent = css;
  document.head.appendChild(style);
}

async function syncPublicTheme() {
  // Sin `?theme=${Date.now()}`: ese parámetro hacía única cada petición, así
  // que el CDN no podía guardar la respuesta nunca.
  const response = await fetch(publicApiUrl("/api/public/business-config"), {
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.ok) return;

  const config = getBusinessConfigPayload(data);
  const css = buildBrandThemeCss({
    primary: config.themePrimaryColor,
    cream: config.themeCreamColor,
    accent: config.themeAccentColor,
  });

  applyThemeCss(css);

  // Símbolo de moneda del sitio público ($/€) elegido por el dueño.
  setPublicCurrencySymbol(config.publicCurrencySymbol);
}

export default function PublicThemeSync() {
  useEffect(() => {
    let isMounted = true;

    async function runSync() {
      try {
        if (!isMounted) return;
        await syncPublicTheme();
      } catch {
        // Si la configuración pública tarda o falla, se conserva el tema que ya está renderizado.
      }
    }

    runSync();

    const handleFocus = () => {
      runSync();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") runSync();
    };
    // El cliente cambió de sucursal: el tema y el símbolo de moneda son parte
    // de la configuración POR SEDE, así que hay que volver a pedirlos. Sin
    // esto, cambiar de sede dejaba puestos los colores de la anterior hasta
    // recargar, y con la caché del borde esa copia equivocada se queda pegada.
    const handleBranchChange = () => {
      runSync();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener(BRANCH_CHANGE_EVENT, handleBranchChange);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(BRANCH_CHANGE_EVENT, handleBranchChange);
    };
  }, []);

  return null;
}
