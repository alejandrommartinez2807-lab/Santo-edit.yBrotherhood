// Monto escrito por el CLIENTE en la página pública → número.
//
// Vive aparte (y no en @/lib/localOrderMoney) para no arrastrar el módulo de
// caja al bundle público: aquella copia trae tipos y helpers de pedidos locales.
// La REGLA es la misma que parseMoneyInput() de caja y cleanMoney() de
// /api/payment-proofs, y así debe seguir: el servidor vuelve a parsear lo que
// manda el cliente, y si las reglas divergen el monto cambia entre pantalla y
// caja.
//
// Historia: la versión que vivía dentro de PublicOrderPaymentSection solo hacía
// replace(",", ".") y NO entendía el separador de miles. "9.648,99" daba 0 y
// "3.632" daba 3,63 (mil veces menos). Con el monto a pagar mostrado como
// "Bs 9.648,99" CON punto de miles, el cliente que reescribía el campo copiando
// lo de arriba mandaba 0 — o un monto 1000× menor que caja recibía como bueno.
//
// Con coma Y punto manda el que va ÚLTIMO: ese es el separador decimal.
//   "9.648,99" → 9648.99   (es-VE)
//   "3,632.50" → 3632.5    (en-US)
// Con solo punto se respeta como decimal ("13.00" → 13), que es lo que escribe
// quien reporta en divisas. Eso deja "3.632" ambiguo y se lee 3,63: es
// indecidible sin más contexto y se resuelve igual en todo el sistema.
export function parsePublicMoneyInput(value: string) {
  const rawValue = String(value || "").trim().replace(/\s/g, "");
  if (!rawValue) return 0;

  const hasComma = rawValue.includes(",");
  const hasDot = rawValue.includes(".");
  let normalized = rawValue;

  if (hasComma && hasDot) {
    normalized =
      rawValue.lastIndexOf(",") > rawValue.lastIndexOf(".")
        ? rawValue.replace(/\./g, "").replace(",", ".")
        : rawValue.replace(/,/g, "");
  } else if (hasComma) {
    normalized = rawValue.replace(",", ".");
  }

  const numberValue = Number(normalized);
  if (!Number.isFinite(numberValue) || numberValue < 0) return 0;
  return Math.round((numberValue + Number.EPSILON) * 100) / 100;
}

// Monto precargado en los campos en BOLÍVARES: coma decimal (como lo escribe la
// gente aquí y como enseña el placeholder "0,00") y SIN separador de miles —
// con puntos de miles el parser lo leería como otra cifra.
export function toVesInputAmount(value: number) {
  return value.toFixed(2).replace(".", ",");
}
