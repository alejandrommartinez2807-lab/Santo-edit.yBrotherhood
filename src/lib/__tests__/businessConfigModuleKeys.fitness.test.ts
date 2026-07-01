import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { LOCAL_MODULE_DEFINITIONS } from "../localPlans"

// ============================================================
// Test de arquitectura (fitness function) para la CONFIGURACIÓN DE MÓDULOS.
//
// El tipo BusinessConfig está definido en DOS lugares (no se pueden unificar de
// golpe por la frontera cliente/servidor):
//   - servidor:  src/lib/ordersBusinessConfig.ts   (canónico, con acceso a DB)
//   - pantalla:  src/app/local-santo/configuracion/page.tsx  ("use client")
//
// Cuando un módulo del registro (LOCAL_MODULE_DEFINITIONS) define un
// `ownerConfigKey`, ESE key debe existir en los defaults de AMBOS archivos. Si
// falta en la página, `isBusinessConfigKey` devuelve false y el interruptor del
// módulo NO guarda nada (bug silencioso: el módulo se ve "muerto"). Esto ya pasó
// con Compras, Inventario alertas y Sucursales.
//
// Este test falla si algún módulo con ownerConfigKey no está cableado en los dos
// lados, evitando que la duplicación del tipo vuelva a esconder módulos.
// ============================================================

const SRC = resolve(__dirname, "..", "..")

const OWNER_CONFIG_KEYS = LOCAL_MODULE_DEFINITIONS.map((m) => m.ownerConfigKey).filter(
  (key): key is string => Boolean(key),
)

// Extrae los nombres de propiedad del objeto DEFAULT_BUSINESS_CONFIG de un
// archivo, sin importar el módulo (evita arrastrar código server/cliente).
function readDefaultConfigKeys(relPath: string): Set<string> {
  const text = readFileSync(resolve(SRC, relPath), "utf8")
  // El objeto termina en un `}` a inicio de línea (los cierres anidados van
  // indentados). Sirve tanto para `};` (página) como `}` (servidor).
  const block = text.match(/DEFAULT_BUSINESS_CONFIG[^=]*=\s*\{([\s\S]*?)\n\};?/)
  if (!block) {
    throw new Error(`No se encontró el objeto DEFAULT_BUSINESS_CONFIG en ${relPath}`)
  }

  const keys = new Set<string>()
  for (const match of block[1].matchAll(/^\s*([a-zA-Z0-9_]+):/gm)) {
    keys.add(match[1])
  }
  return keys
}

describe("Configuración de módulos · fitness function", () => {
  it("hay ownerConfigKeys para revisar (el registro no está vacío)", () => {
    expect(OWNER_CONFIG_KEYS.length).toBeGreaterThan(20)
  })

  it("cada ownerConfigKey existe en los defaults del servidor (ordersBusinessConfig.ts)", () => {
    const serverKeys = readDefaultConfigKeys("lib/ordersBusinessConfig.ts")
    const missing = OWNER_CONFIG_KEYS.filter((key) => !serverKeys.has(key))
    expect(
      missing,
      `Módulos sin cablear en ordersBusinessConfig.ts: ${missing.join(", ")}`,
    ).toEqual([])
  })

  it("cada ownerConfigKey existe en los defaults de la página (el interruptor persiste)", () => {
    const pageKeys = readDefaultConfigKeys("app/local-santo/configuracion/page.tsx")
    const missing = OWNER_CONFIG_KEYS.filter((key) => !pageKeys.has(key))
    expect(
      missing,
      `Módulos sin cablear en configuracion/page.tsx (su interruptor no guardaría nada): ${missing.join(", ")}`,
    ).toEqual([])
  })
})
