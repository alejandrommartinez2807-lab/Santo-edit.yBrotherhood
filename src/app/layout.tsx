import type { Metadata } from "next";
import { Anton } from "next/font/google";
import { BRAND } from "@/lib/brand";

// Fuente display condensada (títulos/hero) — el cuerpo sigue en la sans del sistema.
const displayFont = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
import AuthBridge from "@/components/AuthBridge";
import BranchSwitcher from "@/components/BranchSwitcher";
import OfflineSync from "@/components/OfflineSync";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { getRawBusinessConfig } from "@/lib/orders";
import { buildBrandThemeCss } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} | Menú y pedidos`,
    template: `%s | ${BRAND.name}`,
  },
  description: `Menú digital, pedidos y panel privado de ${BRAND.name}.`,
  manifest: "/manifest.webmanifest",
};

// Tema de marca: el dueño define los colores en Personalización (business_config)
// y aquí los inyectamos en el servidor (sin parpadeo). Si no hay colores
// personalizados o falla la lectura, se usan los de globals.css.
async function getThemeCss(): Promise<string> {
  const config = await getRawBusinessConfig();
  return buildBrandThemeCss({
    primary: config.themePrimaryColor,
    cream: config.themeCreamColor,
    accent: config.themeAccentColor,
  });
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeCss = await getThemeCss();

  return (
    <html lang="es" className={`h-full antialiased ${displayFont.variable}`}>
      <head>
        {themeCss ? <style id="brand-theme" dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <AuthBridge />
        <ServiceWorkerRegister />
        <OfflineSync />
        <BranchSwitcher />
        {children}
      </body>
    </html>
  );
}
