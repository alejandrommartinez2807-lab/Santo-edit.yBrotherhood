import { NextResponse, type NextRequest } from "next/server"
import https from "node:https"
import zlib from "node:zlib"
import { extractBcvUsdRate, extractBcvValueDate } from "@/lib/bcvRates"
import {
  getCachedExchangeRate,
  setCachedExchangeRate,
  type ExchangeRateCacheableResponse,
} from "@/lib/exchangeRateCache"
import { getBusinessConfig } from "@/lib/ordersBusinessConfig"
import { captureError } from "@/lib/monitoring"
import { enforceRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const BCV_EXCHANGE_URL =
  "https://www.bcv.org.ve/seccionportal/tipo-de-cambio-oficial-del-bcv"

const DOLAR_API_USD_URL = "https://ve.dolarapi.com/v1/dolares/oficial"

// Última tasa oficial conocida al momento de escribir esto; solo se usa si
// fallan el BCV y DolarApi y no hay nada en caché.
const FALLBACK_USD_RATE = 667.05

type ExchangeRateResponse = ExchangeRateCacheableResponse

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

async function getBcvUsdRate(): Promise<ExchangeRateResponse> {
  const html = await fetchBcvHtml()
  const rate = extractBcvUsdRate(html)
  const valueDate = extractBcvValueDate(html)

  return {
    rate,
    currency: "USD",
    source: "BCV",
    name: "Dólar Oficial BCV",
    valueDate,
    updatedAt: new Date().toISOString(),
    fallback: false,
  }
}

async function getDolarApiUsdRate(): Promise<ExchangeRateResponse> {
  const response = await fetch(DOLAR_API_USD_URL, {
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
    currency: "USD",
    source: "DolarApi",
    name: "Dólar Oficial",
    valueDate: data.fechaActualizacion,
    updatedAt: new Date().toISOString(),
    fallback: true,
    warning:
      "Se usó DolarApi porque no se pudo leer la tasa directamente desde el BCV.",
  }
}

// Tasa fijada por el dueño en Configuración → "Tasa y moneda" (modo manual).
// Se resuelve en cada request (sin caché) para que un cambio del dueño se vea
// de inmediato; si la lectura de la config falla, seguimos con el BCV.
async function getManualRateFromConfig(): Promise<ExchangeRateResponse | null> {
  try {
    const config = await getBusinessConfig()

    if (config.exchangeRateMode !== "manual") return null

    const rate = Number(config.manualExchangeRate)

    if (!Number.isFinite(rate) || rate <= 0) return null

    return {
      rate,
      currency: "USD",
      source: "Negocio",
      name: "Tasa fijada por el negocio",
      valueDate: undefined,
      updatedAt: new Date().toISOString(),
      fallback: false,
      manual: true,
    }
  } catch (error) {
    captureError(error, {
      route: "/api/exchange-rate",
      action: "GET_MANUAL_RATE",
    })

    return null
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

  const manualRate = await getManualRateFromConfig()

  if (manualRate) {
    return jsonExchangeRate(manualRate)
  }

  const cachedRate = getCachedExchangeRate()

  if (cachedRate) {
    return jsonExchangeRate(cachedRate)
  }

  try {
    const bcvRate = await getBcvUsdRate()

    return jsonExchangeRate(setCachedExchangeRate(bcvRate))
  } catch (bcvError) {
    captureError(bcvError, {
      route: "/api/exchange-rate",
      action: "GET_BCV_RATE",
    })

    try {
      const dolarApiRate = await getDolarApiUsdRate()
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
          rate: FALLBACK_USD_RATE,
          currency: "USD",
          source: "Fallback local",
          name: "Dólar Oficial BCV",
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
