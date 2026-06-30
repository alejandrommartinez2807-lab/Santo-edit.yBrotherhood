// Utilidades pequeñas compartidas del carrito (puras).

export function cleanText(value: unknown) {
  return String(value || "").trim();
}

export function cleanWhatsappNumber(value: unknown) {
  const rawValue = cleanText(value);
  const onlyDigits = rawValue.replace(/\D/g, "");

  if (!onlyDigits) return "";

  if (onlyDigits.startsWith("00")) {
    return onlyDigits.slice(2);
  }

  if (onlyDigits.startsWith("0") && onlyDigits.length === 11) {
    return `58${onlyDigits.slice(1)}`;
  }

  return onlyDigits;
}
