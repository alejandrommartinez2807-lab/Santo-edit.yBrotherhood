"use client";

import { useEffect } from "react";
import { buildBrandThemeCss } from "@/lib/theme";
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
  const response = await fetch(`/api/public/business-config?theme=${Date.now()}`, {
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

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
