import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, it, expect } from "vitest"
import { config, proxy } from "@/proxy"

// Blindaje R1 (auditoría 2026-07-24): TODA la autorización de rol/sede depende
// de que el middleware `src/proxy.ts` (1) cubra todas las rutas /api y (2)
// BORRE los headers x-staff-* que mande el cliente (anti-spoofing). Si alguien
// baja Next <16, renombra el archivo, cambia el matcher o quita un delete, la
// seguridad se cae en silencio. Este test hace que ese cambio ROMPA los tests.

const CRITICAL_STRIPPED_HEADERS = [
  "x-staff-role",
  "x-staff-branch-ids",
  "x-staff-modules",
  "x-staff-permissions-mode",
  "x-staff-all-branches",
  "x-staff-id",
]

describe("proxy security (anti-spoofing)", () => {
  it("cubre todas las rutas /api", () => {
    expect(config.matcher).toBe("/api/:path*")
  })

  it("exporta el middleware como función `proxy` (Next 16)", () => {
    expect(typeof proxy).toBe("function")
  })

  it("BORRA todos los headers x-staff-* críticos que envíe el cliente", () => {
    const source = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8")
    for (const header of CRITICAL_STRIPPED_HEADERS) {
      expect(
        source.includes(`headers.delete("${header}")`),
        `El middleware ya no borra ${header}: un cliente podría falsificarlo.`,
      ).toBe(true)
    }
  })

  it("solo reemite el rol tras verificar un Bearer contra Supabase Auth", () => {
    const source = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8")
    // El rol reenviado debe salir SIEMPRE de getStaffAccessFromToken (token
    // verificado), nunca del header entrante.
    expect(source).toContain("getStaffAccessFromToken")
    expect(source).toContain('authorization.startsWith("Bearer ")')
  })
})
