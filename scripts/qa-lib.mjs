// QA ronda 2026-07-27 · Infraestructura común de los scripts de la ronda.
// Lección de la línea base: en el puerto 3000 vivía el dev server de OTRA app
// (Pizzería 007, producción) y los e2e le escribieron pedidos. Por eso:
//  1) BASE por defecto es 3177 (el dev de esta ronda), nunca 3000.
//  2) assertBrotherhood() verifica la IDENTIDAD del server antes de escribir.
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

export const BASE = process.env.BASE || "http://localhost:3177"

export function loadEnvFile() {
  const text = readFileSync(".env.local", "utf8")
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=")
        return [
          line.slice(0, index).trim(),
          line.slice(index + 1).trim().replace(/^["']|["']$/g, ""),
        ]
      }),
  )
}

export const env = loadEnvFile()
export const ownerPassword = env.ORDERS_OWNER_PASSWORD

export const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

export const BRANCH_SAN_DIEGO = "3d8a8527-4b0b-4c81-aeb7-0c69454c63f6"
export const BRANCH_VINEDO = "04fb974d-bd2d-4086-ae9e-c74653309b04"

// El server respondiendo en BASE tiene que ser Brotherhood y hablar con el
// MISMO Supabase que .env.local. Si no, ningún script debe escribir.
export async function assertBrotherhood() {
  const res = await fetch(BASE + "/", { headers: { accept: "text/html" } })
  const html = await res.text()
  const title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] || "").trim()
  if (!/brotherhood/i.test(title)) {
    console.error(`✗ ABORTADO: el server en ${BASE} no es Brotherhood (title: "${title}").`)
    console.error("  Revisa el puerto — en esta máquina conviven dev servers de varios clientes.")
    process.exit(2)
  }
  return title
}

let pass = 0
let fail = 0
export function check(name, condition, detail = "") {
  console.log(`${condition ? "✓" : "✗ FALLA"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (condition) pass += 1
  else fail += 1
}

export function summary(label = "") {
  console.log(`\n==== ${label ? label + ": " : ""}${pass} OK, ${fail} fallas ====`)
  return fail
}

export function staffHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "x-local-password": ownerPassword,
    ...extra,
  }
}

export async function api(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: staffHeaders(headers),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { res, json, status: res.status }
}

export const get = (path, headers) => api("GET", path, undefined, headers)
export const post = (path, body, headers) => api("POST", path, body, headers)
export const patch = (path, body, headers) => api("PATCH", path, body, headers)
export const del = (path, headers) => api("DELETE", path, undefined, headers)
