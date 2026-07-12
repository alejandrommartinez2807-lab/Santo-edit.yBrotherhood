// Datos del cliente guardados en SU dispositivo (localStorage) al completar
// un pedido: nombre, teléfono y ubicación de entrega. La próxima vez que abra
// el formulario se rellenan solos; nunca viajan a otro dispositivo.

export type PublicCustomerProfile = {
  name: string;
  phone: string;
  mapsUrl: string;
  deliveryReference: string;
};

const STORAGE_KEY = "santo_public_customer_profile_v1";

const EMPTY_PROFILE: PublicCustomerProfile = {
  name: "",
  phone: "",
  mapsUrl: "",
  deliveryReference: "",
};

export function readPublicCustomerProfile(): PublicCustomerProfile {
  if (typeof window === "undefined") return { ...EMPTY_PROFILE };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_PROFILE };

    const parsed = JSON.parse(raw) as Partial<PublicCustomerProfile>;

    return {
      name: String(parsed.name || "").trim(),
      phone: String(parsed.phone || "").trim(),
      mapsUrl: String(parsed.mapsUrl || "").trim(),
      deliveryReference: String(parsed.deliveryReference || "").trim(),
    };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

// Guarda solo lo que venga con contenido: un pedido "Comer aquí" (sin
// teléfono ni ubicación) no borra la dirección guardada de un delivery previo.
export function savePublicCustomerProfile(
  profile: Partial<PublicCustomerProfile>,
) {
  if (typeof window === "undefined") return;

  try {
    const current = readPublicCustomerProfile();
    const clean = (value: unknown) => String(value || "").trim();

    const next: PublicCustomerProfile = {
      name: clean(profile.name) || current.name,
      phone: clean(profile.phone) || current.phone,
      mapsUrl: clean(profile.mapsUrl) || current.mapsUrl,
      deliveryReference:
        clean(profile.deliveryReference) || current.deliveryReference,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento (modo incógnito estricto) el flujo sigue normal.
  }
}
