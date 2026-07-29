// Generador determinista de escenarios: misma semilla → misma semana.
// (Regla de reproducibilidad: nada de Math.random sin semilla.)

function hashString(text) {
  let h = 1779033703 ^ text.length
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

export function makeRng(seed) {
  let a = hashString(seed)
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)]
}

export function pickInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1))
}

const FIRST = [
  "Ana", "Luis", "Carla", "Pedro", "María", "José", "Gaby", "Andrés", "Paola",
  "Ramón", "Sofía", "Diego", "Valeria", "Héctor", "Camila", "Iván", "Rosa",
  "Óscar", "Elena", "Franklin", "Yusmary", "Deibis", "Marbella", "Néstor",
]
const LAST = [
  "Pérez", "García", "Rodríguez", "López", "Sira", "Blanco", "Torres",
  "Núñez", "Aponte", "Salazar", "Mora", "Rivas", "Zambrano", "Colmenares",
]

export function customerName(rng, tag) {
  return `SIM ${pick(rng, FIRST)} ${pick(rng, LAST)} ${tag}`
}

export function customerPhone(rng) {
  const prefix = pick(rng, ["0412", "0414", "0416", "0424", "0426"])
  let digits = ""
  for (let i = 0; i < 7; i += 1) digits += Math.floor(rng() * 10)
  return prefix + digits
}

// IP determinista por índice de cliente (cada cliente = un dispositivo).
export function customerIp(dayNumber, index) {
  return `10.${100 + dayNumber}.${Math.floor(index / 250)}.${(index % 250) + 2}`
}
