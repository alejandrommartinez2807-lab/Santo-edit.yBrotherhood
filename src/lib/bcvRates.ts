// Parsing puro de la tasa oficial del BCV (bcv.org.ve) — funciones sin red
// para poder probarlas con HTML de ejemplo. La página publica los bloques por
// moneda (id="dolar", id="euro"); aquí extraemos la tasa del DÓLAR, que es la
// moneda en la que están los precios del negocio.

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&Aacute;/g, "Á")
    .replace(/&Eacute;/g, "É")
    .replace(/&Iacute;/g, "Í")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&Uacute;/g, "Ú")
    .replace(/&Ntilde;/g, "Ñ")
}

export function htmlToText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  )
}

export function parseVenezuelanNumber(value: string) {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")

  const number = Number(normalized)

  if (!Number.isFinite(number) || number <= 0) {
    return null
  }

  return number
}

function extractFirstValidRateFromText(text: string) {
  const matches = [...text.matchAll(/(\d{1,5}(?:[.,]\d{4,12}))/g)]

  for (const match of matches) {
    const parsed = parseVenezuelanNumber(match[1])

    if (parsed && parsed > 50 && parsed < 100000) {
      return parsed
    }
  }

  return null
}

// Tasa oficial USD. El bloque del dólar del BCV lleva id="dolar" y el texto
// visible la palabra "USD"; probamos ambas rutas antes de rendirnos.
export function extractBcvUsdRate(html: string) {
  const dollarBlockMatch = html.match(/id=["']dolar["'][\s\S]{0,2200}/i)

  if (dollarBlockMatch) {
    const rate = extractFirstValidRateFromText(htmlToText(dollarBlockMatch[0]))

    if (rate) {
      return rate
    }
  }

  const text = htmlToText(html)
  const usdIndex = text.search(/\bUSD\b/i)

  if (usdIndex !== -1) {
    const usdArea = text.slice(usdIndex, usdIndex + 500)
    const rate = extractFirstValidRateFromText(usdArea)

    if (rate) {
      return rate
    }
  }

  throw new Error("No se pudo extraer la tasa USD desde el HTML del BCV")
}

export function extractBcvValueDate(html: string) {
  const text = htmlToText(html)

  const valueDateMatch = text.match(
    /Fecha\s*Valor\s*:\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ,\s]+\d{1,2}\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\s+\d{4})/i
  )

  if (valueDateMatch?.[1]) {
    return valueDateMatch[1].trim()
  }

  const fallbackDateMatch = text.match(/Fecha\s*Valor\s*:\s*([^|]{6,90})/i)

  if (fallbackDateMatch?.[1]) {
    return fallbackDateMatch[1].trim()
  }

  return undefined
}
