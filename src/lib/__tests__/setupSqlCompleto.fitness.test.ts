import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Guardia de entrega (auditoría 2026-08-02).
//
// `supabase/BROTHERHOOD-SETUP.sql` es el instalador de "un solo pegado" que
// sigue el cliente nuevo: la guía dice copiarlo entero en el SQL Editor y con
// eso queda la base lista. Se quedó congelado en la 0021 mientras el repo
// llegaba a la 0036: quince migraciones fuera. Un negocio instalado con ese
// archivo arrancaba sin la 0028 y la creación de pedidos fallaba en runtime,
// con un error de columna que nadie relaciona con "faltó pegar una migración".
//
// Si este test falla: corre `npm run setup:sql`.

const ROOT = join(__dirname, "..", "..", "..")
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations")
const SETUP_SQL = join(ROOT, "supabase", "BROTHERHOOD-SETUP.sql")

function listMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
}

describe("el instalador de un solo pegado está al día", () => {
  it("incluye TODAS las migraciones del repo", () => {
    const setup = readFileSync(SETUP_SQL, "utf8")
    const missing = listMigrations().filter((name) => !setup.includes(`>>> ${name}`))

    expect(
      missing,
      `Faltan en BROTHERHOOD-SETUP.sql:\n${missing.join("\n")}\n\nCorre: npm run setup:sql`,
    ).toEqual([])
  })

  it("las incluye EN ORDEN (una migración no puede depender de otra posterior)", () => {
    const setup = readFileSync(SETUP_SQL, "utf8")
    const orderInSetup = listMigrations().map((name) => ({
      name,
      at: setup.indexOf(`>>> ${name}`),
    }))

    const outOfOrder = orderInSetup.filter(
      (entry, index) => index > 0 && entry.at < orderInSetup[index - 1].at,
    )

    expect(outOfOrder.map((entry) => entry.name)).toEqual([])
  })

  it("no anuncia un número de migraciones distinto del que trae", () => {
    const setup = readFileSync(SETUP_SQL, "utf8")
    const bloques = setup.match(/>>> \d{4}_/g) || []

    expect(bloques.length).toBe(listMigrations().length)
  })

  it("el contenido de cada migración viaja completo, no solo su cabecera", () => {
    const setup = readFileSync(SETUP_SQL, "utf8")

    // Se comprueba la última migración, que es la que siempre se olvida.
    const ultima = listMigrations().at(-1) as string
    const contenido = readFileSync(join(MIGRATIONS_DIR, ultima), "utf8").trim()
    const primeraLineaSql = contenido
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("--")) as string

    expect(setup).toContain(primeraLineaSql)
  })
})
