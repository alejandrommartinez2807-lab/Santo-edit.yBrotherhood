#!/usr/bin/env node
// ============================================================
// CREAR USUARIO DE PERSONAL — Supabase Auth (auth real)
// ------------------------------------------------------------
// Crea un usuario de Supabase Auth (email+clave) y su rol en staff_users.
// Lee las claves de .env.local.
//
// Uso:
//   node scripts/create-staff.mjs <email> <password> <rol> ["Nombre completo"]
//
// Roles: owner | manager | cashier | waiter | kitchen | delivery | support
//
// Ejemplo:
//   node scripts/create-staff.mjs caja@negocio.com Clave123 cashier "Caja Turno 1"
// ============================================================

import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]
    }),
)

const VALID = ["owner", "manager", "cashier", "waiter", "kitchen", "delivery", "support"]
const [email, password, role, fullName = ""] = process.argv.slice(2)

if (!email || !password || !role) {
  console.error('Uso: node scripts/create-staff.mjs <email> <password> <rol> ["Nombre"]')
  console.error("Roles: " + VALID.join(" | "))
  process.exit(1)
}
if (!VALID.includes(role)) {
  console.error(`Rol inválido "${role}". Usa: ${VALID.join(" | ")}`)
  process.exit(1)
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function main() {
  // 1. Crear (o reutilizar) el usuario de Supabase Auth, ya confirmado.
  let userId
  const created = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (created.error) {
    if (/already.*registered|exists/i.test(created.error.message)) {
      // Ya existe: buscarlo por email
      const list = await sb.auth.admin.listUsers()
      const found = list.data?.users?.find((u) => u.email === email)
      if (!found) throw new Error("El usuario ya existe pero no se pudo localizar.")
      userId = found.id
      console.log("Usuario ya existía, se reutiliza.")
    } else {
      throw new Error(created.error.message)
    }
  } else {
    userId = created.data.user.id
    console.log("Usuario de Auth creado.")
  }

  // 2. Insertar / actualizar su rol en staff_users.
  const up = await sb.from("staff_users").upsert({
    id: userId,
    email,
    full_name: fullName,
    role,
    is_active: true,
    updated_at: new Date().toISOString(),
  })
  if (up.error) throw new Error(up.error.message)

  console.log(`Listo: ${email} → rol "${role}"${fullName ? ` (${fullName})` : ""}`)
}

main().catch((e) => {
  console.error("Falló:", e.message)
  process.exit(1)
})
