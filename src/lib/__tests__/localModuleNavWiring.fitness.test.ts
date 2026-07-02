import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { LOCAL_MODULE_DEFINITIONS, LOCAL_MODULE_KEYS } from "../localPlans"

// ============================================================
// Test de arquitectura (fitness function) para la NAVEGACIÓN DEL STAFF.
//
// La barra de módulos (LocalModuleNav) tiene su propia lista NAV_ENTRIES,
// separada del registro de módulos (LOCAL_MODULE_DEFINITIONS). Si un módulo
// nuevo define su página (routePath) pero nadie agrega la entrada en la barra,
// el módulo queda "invisible": la página existe y el rol tiene permiso, pero
// no hay forma de llegar salvo escribiendo la URL. Esto ya pasó con Reservas
// (Fase 5).
//
// Este test falla si algún routePath del registro no tiene entrada en la
// barra, o si la barra apunta a claves de módulo que no existen.
// ============================================================

const SRC = resolve(__dirname, "..", "..")

// Extrae { key, href } de NAV_ENTRIES leyendo el archivo como texto: el
// componente es "use client" y no se importa desde tests de Node.
function readNavEntries(): Array<{ key: string; href: string }> {
  const text = readFileSync(resolve(SRC, "components", "LocalModuleNav.tsx"), "utf8")
  const block = text.match(/NAV_ENTRIES[^=]*=\s*\[([\s\S]*?)\n\]/)
  if (!block) {
    throw new Error("No se encontró NAV_ENTRIES en LocalModuleNav.tsx")
  }

  const entries: Array<{ key: string; href: string }> = []
  for (const match of block[1].matchAll(
    /key:\s*"([^"]+)"[\s\S]*?href:\s*"([^"]+)"/g,
  )) {
    entries.push({ key: match[1], href: match[2] })
  }
  return entries
}

describe("Navegación del staff · fitness function", () => {
  const navEntries = readNavEntries()

  it("hay entradas de navegación que revisar (el parser no se rompió)", () => {
    expect(navEntries.length).toBeGreaterThan(15)
  })

  it("cada entrada de la barra usa una clave de módulo real", () => {
    const unknown = navEntries.filter(
      (entry) => !LOCAL_MODULE_KEYS.includes(entry.key as never),
    )
    expect(
      unknown.map((entry) => entry.key),
      `Claves en NAV_ENTRIES que no existen en LOCAL_MODULE_KEYS: revisa typos`,
    ).toEqual([])
  })

  it("cada página de módulo del registro es alcanzable desde la barra", () => {
    // El panel principal ("/local-santo") tiene su propio enlace fijo en la
    // barra, no es una entrada del listado.
    const routePaths = new Set(
      LOCAL_MODULE_DEFINITIONS.map((m) => m.routePath).filter(
        (path): path is string => Boolean(path) && path !== "/local-santo",
      ),
    )
    const reachable = new Set(navEntries.map((entry) => entry.href))
    const missing = [...routePaths].filter((path) => !reachable.has(path))
    expect(
      missing,
      `Páginas de módulo sin entrada en LocalModuleNav (módulo invisible): ${missing.join(", ")}`,
    ).toEqual([])
  })
})
