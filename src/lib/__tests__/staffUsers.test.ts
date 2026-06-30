import { describe, expect, it } from "vitest"
import {
  createInternalStaffEmail,
  getStaffUsernameFromEmail,
  normalizeStaffUsername,
  resolveStaffLoginEmail,
} from "../staffIdentity"
import {
  createStaffAccessConfig,
  getDisplayName,
  getDisplayUsername,
  normalizeStaffUsersConfig,
} from "../staffUsers"

const STAFF_ID = "staff-1"

describe("staff user identity", () => {
  it("normaliza nombres de usuario sin obligar a usar correo", () => {
    expect(normalizeStaffUsername(" María Pérez ")).toBe("maria-perez")
    expect(normalizeStaffUsername("José.Caja_01")).toBe("jose.caja_01")
    expect(normalizeStaffUsername("maria@santo.local")).toBe("maria")
  })

  it("genera y resuelve el correo interno solo para compatibilidad técnica", () => {
    expect(createInternalStaffEmail("Maria")).toBe("maria@santo.local")
    expect(resolveStaffLoginEmail("jose")).toBe("jose@santo.local")
    expect(resolveStaffLoginEmail("admin@cliente.com")).toBe("admin@cliente.com")
    expect(getStaffUsernameFromEmail("cocina@santo.local")).toBe("cocina")
  })

  it("crea metadata simple con usuario, nombre visible, rol, permisos y sedes", () => {
    const config = createStaffAccessConfig({
      id: STAFF_ID,
      email: "maria@santo.local",
      username: "Maria",
      displayName: "María Pérez",
      role: "kitchen",
      permissionsMode: "custom",
      allowedModules: ["kitchen", "kitchenItems", "cashier", "invalid"],
      allBranches: false,
      allowedBranchIds: ["centro", "centro", "este"],
    })

    expect(config).toMatchObject({
      id: STAFF_ID,
      username: "maria",
      displayName: "María Pérez",
      permissionsMode: "custom",
      allowedModules: ["kitchen", "kitchenItems", "cashier"],
      allBranches: false,
      allowedBranchIds: ["centro", "este"],
    })
  })

  it("normaliza listas guardadas en business_config.config.staffUsers", () => {
    const users = normalizeStaffUsersConfig([
      {
        id: STAFF_ID,
        username: " Caja 01 ",
        displayName: "Caja",
        permissionsMode: "custom",
        allowedModules: ["cashier", "settings", "desconocido"],
        allBranches: false,
        allowedBranchIds: ["este", "este"],
      },
      { id: STAFF_ID, username: "duplicado" },
      { username: "sin-id" },
    ])

    expect(users).toHaveLength(1)
    expect(users[0]).toMatchObject({
      username: "caja-01",
      allowedModules: ["cashier", "settings"],
      allowedBranchIds: ["este"],
    })
  })

  it("muestra username y nombre visible sin exponer correos internos", () => {
    const config = createStaffAccessConfig({
      id: STAFF_ID,
      email: "legacy@example.com",
      username: "maria",
      displayName: "María",
      role: "cashier",
    })

    expect(getDisplayUsername("legacy@example.com", config)).toBe("maria")
    expect(getDisplayName("Legacy Name", config)).toBe("María")
  })
})
