import type { Metadata } from "next";
import { Anton, Playfair_Display } from "next/font/google";
import { BRAND } from "@/lib/brand";

// Fuente display condensada (títulos/hero) — el cuerpo sigue en la sans del sistema.
const displayFont = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// Serif editorial elegante para las superficies premium (hotel): titulares con
// aire de 5 estrellas, muy distinto al display condensado del resto.
const serifFont = Playfair_Display({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});
import { Analytics } from "@vercel/analytics/react";
import AuthBridge from "@/components/AuthBridge";
import BranchSwitcher from "@/components/BranchSwitcher";
import OfflineSync from "@/components/OfflineSync";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { getRawBusinessConfig } from "@/lib/orders";
import { buildBrandThemeCss } from "@/lib/theme";
import { getSiteUrl } from "@/lib/siteUrl";
import "./globals.css";

function cleanConfigText(value: unknown) {
  return String(value || "").trim();
}

// Descripción del negocio configurada por el dueño; el valor semilla del
// template ("Menú y pedidos") cuenta como no configurado.
function readBusinessDescription(config: Record<string, unknown>) {
  const description = cleanConfigText(config.businessShortDescription);

  return description && description !== "Menú y pedidos"
    ? description
    : BRAND.description;
}

// Metadata dinámica por cliente: el nombre sale de BRAND (fijo por código en
// cada copia del template, regla del rebrand) y la descripción de
// business_config. Open Graph/Twitter hacen que el link compartido por
// WhatsApp o Instagram muestre logo + nombre + descripción en vez de un link
// pelado.
export async function generateMetadata(): Promise<Metadata> {
  const config = await getRawBusinessConfig().catch(
    () => ({}) as Record<string, unknown>,
  );
  const businessName = BRAND.name;
  const description = readBusinessDescription(config);
  const title = businessName;

  return {
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: title,
      template: `%s | ${businessName}`,
    },
    description,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/favicon.ico",
      shortcut: "/favicon.ico",
      apple: "/demo/lidotel/lidotel-logo.png",
    },
    openGraph: {
      type: "website",
      siteName: businessName,
      title,
      description,
      url: "/",
      locale: "es_VE",
      images: [{ url: "/demo/lidotel/lidotel-fachada.jpg", alt: businessName }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/demo/lidotel/lidotel-fachada.jpg"],
    },
  };
}

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

// JSON-LD de restaurante (schema.org): con esto Google entiende que el sitio
// es un negocio de comida y puede mostrarlo con ficha en resultados locales.
// Solo incluye campos con valor real; todo sale de business_config.
async function getRestaurantJsonLd(): Promise<string> {
  try {
    const config = (await getRawBusinessConfig()) as Record<string, unknown>;
    const siteUrl = getSiteUrl();
    const phoneDigits = cleanConfigText(config.mainWhatsapp).replace(/\D+/g, "");
    const instagramUrl = cleanConfigText(config.instagramUrl);
    const locationLabel = cleanConfigText(config.locationLabel);

    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Hotel",
      name: BRAND.name,
      url: siteUrl,
      image: `${siteUrl}/logo.png`,
      starRating: { "@type": "Rating", ratingValue: "5" },
      description: readBusinessDescription(config),
    };

    if (phoneDigits) jsonLd.telephone = `+${phoneDigits}`;
    // El valor semilla del template ("Mesa") no es una dirección real.
    if (locationLabel.length >= 6 && locationLabel !== "Mesa") {
      jsonLd.address = locationLabel;
    }
    if (instagramUrl) jsonLd.sameAs = [instagramUrl];

    return JSON.stringify(jsonLd);
  } catch {
    return "";
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [themeCss, restaurantJsonLd] = await Promise.all([
    getThemeCss(),
    getRestaurantJsonLd(),
  ]);

  return (
    <html lang="es" className={`h-full antialiased ${displayFont.variable} ${serifFont.variable}`}>
      <head>
        {themeCss ? <style id="brand-theme" dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
        {restaurantJsonLd ? (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: restaurantJsonLd }} />
        ) : null}
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <AuthBridge />
        <ServiceWorkerRegister />
        <OfflineSync />
        <BranchSwitcher />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
