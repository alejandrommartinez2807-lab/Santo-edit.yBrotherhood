import { NextResponse, type NextRequest } from "next/server"
import https from "node:https"
import zlib from "node:zlib"
import {
  getCachedExchangeRate,
  setCachedExchangeRate,
  type ExchangeRateCacheableResponse,
} from "@/lib/exchangeRateCache"
import { captureError } from "@/lib/monitoring"
import { enforceRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const BCV_EXCHANGE_URL =
  "https://www.bcv.org.ve/seccionportal/tipo-de-cambio-oficial-del-bcv"

const DOLAR_API_EURO_URL = "https://ve.dolarapi.com/v1/euros/oficial"

const FALLBACK_EURO_RATE = 602.18768455

type ExchangeRateResponse = ExchangeRateCacheableResponse


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

function htmlToText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  )
}

function parseVenezuelanNumber(value: string) {
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

function extractBcvEuroRate(html: string) {
  const text = htmlToText(html)

  const eurIndex = text.search(/\bEUR\b/i)

  if (eurIndex !== -1) {
    const eurArea = text.slice(eurIndex, eurIndex + 500)
    const rate = extractFirstValidRateFromText(eurArea)

    if (rate) {
      return rate
    }
  }

  const euroBlockMatch =
    html.match(/id=["']euro["'][\s\S]{0,2200}/i) ||
    html.match(/EUR[\s\S]{0,2200}/i)

  if (euroBlockMatch) {
    const rate = extractFirstValidRateFromText(htmlToText(euroBlockMatch[0]))

    if (rate) {
      return rate
    }
  }

  throw new Error("No se pudo extraer la tasa EUR desde el HTML del BCV")
}

function extractBcvValueDate(html: string) {
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

async function fetchBcvWithNativeHttps() {
  return new Promise<string>((resolve, reject) => {
    const request = https.get(
      BCV_EXCHANGE_URL,
      {
        timeout: 15000,
        rejectUnauthorized: false,
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Encoding": "gzip, deflate, br, identity",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        },
      },
      (response) => {
        const chunks: Buffer[] = []

        response.on("data", (chunk) => {
          chunks.push(Buffer.from(chunk))
        })

        response.on("end", () => {
          try {
            const rawBuffer = Buffer.concat(chunks)
            const encoding = String(response.headers["content-encoding"] || "")

            let decodedBuffer = rawBuffer

            if (encoding.includes("gzip")) {
              decodedBuffer = zlib.gunzipSync(rawBuffer)
            } else if (encoding.includes("deflate")) {
              decodedBuffer = zlib.inflateSync(rawBuffer)
            } else if (encoding.includes("br")) {
              decodedBuffer = zlib.brotliDecompressSync(rawBuffer)
            }

            resolve(decodedBuffer.toString("utf8"))
          } catch (error) {
            reject(error)
          }
        })
      }
    )

    request.on("timeout", () => {
      request.destroy(new Error("Timeout consultando el BCV"))
    })

    request.on("error", reject)
  })
}

async function fetchBcvHtml() {
  try {
    const response = await fetch(BCV_EXCHANGE_URL, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`BCV respondió con estado ${response.status}`)
    }

    return await response.text()
  } catch {
    return await fetchBcvWithNativeHttps()
  }
}

async function getBcvEuroRate(): Promise<ExchangeRateResponse> {
  const html = await fetchBcvHtml()
  const rate = extractBcvEuroRate(html)
  const valueDate = extractBcvValueDate(html)

  return {
    rate,
    currency: "EUR",
    source: "BCV",
    name: "Euro Oficial BCV",
    valueDate,
    updatedAt: new Date().toISOString(),
    fallback: false,
  }
}

async function getDolarApiEuroRate(): Promise<ExchangeRateResponse> {
  const response = await fetch(DOLAR_API_EURO_URL, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`DolarApi respondió con estado ${response.status}`)
  }

  const data = await response.json()
  const rate = Number(data.promedio)

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("DolarApi no devolvió un promedio válido")
  }

  return {
    rate,
    currency: "EUR",
    source: "DolarApi",
    name: "Euro Oficial",
    valueDate: data.fechaActualizacion,
    updatedAt: new Date().toISOString(),
    fallback: true,
    warning:
      "Se usó DolarApi porque no se pudo leer la tasa directamente desde el BCV.",
  }
}

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
}

function jsonExchangeRate(response: ExchangeRateResponse) {
  return NextResponse.json(response, {
    headers: NO_STORE_HEADERS,
  })
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(request, {
    id: "api-exchange-rate-get",
    limit: 120,
    windowMs: 60_000,
    message: "Demasiadas consultas de tasa. Espera unos segundos e intenta nuevamente.",
  })

  if (rateLimitResponse) return rateLimitResponse

  const cachedRate = getCachedExchangeRate()

  if (cachedRate) {
    return jsonExchangeRate(cachedRate)
  }

  try {
    const bcvRate = await getBcvEuroRate()

    return jsonExchangeRate(setCachedExchangeRate(bcvRate))
  } catch (bcvError) {
    captureError(bcvError, {
      route: "/api/exchange-rate",
      action: "GET_BCV_RATE",
    })

    try {
      const dolarApiRate = await getDolarApiEuroRate()
      const fallbackRate = {
        ...dolarApiRate,
        error:
          bcvError instanceof Error
            ? bcvError.message
            : "No se pudo leer el BCV",
      }

      return jsonExchangeRate(setCachedExchangeRate(fallbackRate))
    } catch (dolarApiError) {
      captureError(dolarApiError, {
        route: "/api/exchange-rate",
        action: "GET_DOLAR_API_RATE",
      })

      return jsonExchangeRate(
        setCachedExchangeRate({
          rate: FALLBACK_EURO_RATE,
          currency: "EUR",
          source: "Fallback local",
          name: "Euro Oficial BCV",
          valueDate: undefined,
          updatedAt: new Date().toISOString(),
          fallback: true,
          warning:
            "No se pudo leer la tasa oficial en este momento. Se usó una tasa de respaldo local.",
          error:
            dolarApiError instanceof Error
              ? dolarApiError.message
              : "Error desconocido",
        })
      )
    }
  }
}
