// Genera los modelos 3D de demostración de la carta (public/modelos/*.glb).
//
// Por qué generados por código y no descargados: los modelos van al sitio
// público de un cliente real, así que no queremos assets de terceros con su
// licencia colgando. Estos son nuestros, se regeneran con `node
// scripts/generar-modelos-3d.mjs` y salen byte a byte iguales (nada de
// Math.random suelto: hay un generador con semilla fija).
//
// Escala: glTF trabaja en METROS y el AR los usa tal cual. Cada modelo se
// escala al tamaño real del plato para que aparezca del tamaño correcto sobre
// la mesa; si no, el cliente vería una hamburguesa de dos metros.

import { mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(HERE, "..", "public", "modelos")

// ---------------------------------------------------------------- utilidades

/** Generador con semilla: mismo resultado en cada corrida. */
function makeRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

/** sRGB (#RRGGBB) → lineal, que es el espacio de baseColorFactor en glTF. */
function hexToLinear(hex) {
  const clean = hex.replace("#", "")
  const toLinear = (channel) => {
    const value = parseInt(clean.slice(channel * 2, channel * 2 + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return [toLinear(0), toLinear(1), toLinear(2)]
}

const DEG = Math.PI / 180

function rotationMatrix(axis, degrees) {
  const angle = degrees * DEG
  const c = Math.cos(angle)
  const s = Math.sin(angle)

  if (axis === "x") return [1, 0, 0, 0, c, -s, 0, s, c]
  if (axis === "y") return [c, 0, s, 0, 1, 0, -s, 0, c]
  return [c, -s, 0, s, c, 0, 0, 0, 1]
}

function applyMatrix(m, x, y, z) {
  return [
    m[0] * x + m[1] * y + m[2] * z,
    m[3] * x + m[4] * y + m[5] * z,
    m[6] * x + m[7] * y + m[8] * z,
  ]
}

function multiplyMatrix(a, b) {
  const out = new Array(9).fill(0)
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      out[row * 3 + col] =
        a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col]
    }
  }
  return out
}

/**
 * `rotation` acepta un solo giro o una lista, que se aplica EN ORDEN. Hace
 * falta para piezas como el chorizo: primero se acuesta (90° en X) y después
 * se orienta sobre la hamburguesa (giro en Y).
 */
function buildRotation(rotation) {
  const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1]

  if (!rotation) return identity

  const steps = Array.isArray(rotation) ? rotation : [rotation]

  return steps.reduce(
    (accumulated, step) => multiplyMatrix(rotationMatrix(step.axis, step.degrees), accumulated),
    identity,
  )
}

// --------------------------------------------------------------- primitivas
// Cada primitiva devuelve { positions, normals, indices } en arrays planos.

function cylinder({
  radiusTop = 1,
  radiusBottom = 1,
  height = 1,
  segments = 40,
  capTop = true,
  capBottom = true,
}) {
  const positions = []
  const normals = []
  const indices = []
  const halfHeight = height / 2
  const slope = (radiusBottom - radiusTop) / height

  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const normalLength = Math.hypot(1, slope)

    positions.push(radiusTop * cos, halfHeight, radiusTop * sin)
    normals.push(cos / normalLength, slope / normalLength, sin / normalLength)
    positions.push(radiusBottom * cos, -halfHeight, radiusBottom * sin)
    normals.push(cos / normalLength, slope / normalLength, sin / normalLength)
  }

  for (let i = 0; i < segments; i += 1) {
    const a = i * 2
    indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3)
  }

  const addCap = (radius, y, normalY) => {
    if (radius <= 0) return
    const center = positions.length / 3
    positions.push(0, y, 0)
    normals.push(0, normalY, 0)

    for (let i = 0; i <= segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2
      positions.push(radius * Math.cos(angle), y, radius * Math.sin(angle))
      normals.push(0, normalY, 0)
    }

    for (let i = 0; i < segments; i += 1) {
      const a = center + 1 + i
      if (normalY > 0) indices.push(center, a + 1, a)
      else indices.push(center, a, a + 1)
    }
  }

  if (capTop) addCap(radiusTop, halfHeight, 1)
  if (capBottom) addCap(radiusBottom, -halfHeight, -1)

  return { positions, normals, indices }
}

function sphere({
  radius = 1,
  widthSegments = 36,
  heightSegments = 20,
  thetaStart = 0,
  thetaLength = Math.PI,
}) {
  const positions = []
  const normals = []
  const indices = []

  for (let iy = 0; iy <= heightSegments; iy += 1) {
    const v = iy / heightSegments
    const theta = thetaStart + v * thetaLength

    for (let ix = 0; ix <= widthSegments; ix += 1) {
      const u = ix / widthSegments
      const phi = u * Math.PI * 2
      const nx = -Math.cos(phi) * Math.sin(theta)
      const ny = Math.cos(theta)
      const nz = Math.sin(phi) * Math.sin(theta)

      positions.push(radius * nx, radius * ny, radius * nz)
      normals.push(nx, ny, nz)
    }
  }

  const rowSize = widthSegments + 1
  for (let iy = 0; iy < heightSegments; iy += 1) {
    for (let ix = 0; ix < widthSegments; ix += 1) {
      const a = iy * rowSize + ix
      const b = a + rowSize
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }

  return { positions, normals, indices }
}

function box({ width = 1, height = 1, depth = 1 }) {
  const x = width / 2
  const y = height / 2
  const z = depth / 2
  const faces = [
    { normal: [0, 0, 1], corners: [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]] },
    { normal: [0, 0, -1], corners: [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]] },
    { normal: [1, 0, 0], corners: [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]] },
    { normal: [-1, 0, 0], corners: [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]] },
    { normal: [0, 1, 0], corners: [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]] },
    { normal: [0, -1, 0], corners: [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]] },
  ]

  const positions = []
  const normals = []
  const indices = []

  faces.forEach((face, index) => {
    face.corners.forEach((corner) => {
      positions.push(corner[0], corner[1], corner[2])
      normals.push(face.normal[0], face.normal[1], face.normal[2])
    })
    const base = index * 4
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })

  return { positions, normals, indices }
}

// ------------------------------------------------------- montaje de piezas

/**
 * Aplica escala → rotación → traslación a una primitiva y la acumula en el
 * grupo de su material. Las normales usan R·S⁻¹ normalizada (lo correcto con
 * escalas no uniformes: si no, un disco achatado se ilumina mal).
 */
function addPart(groups, part) {
  const { geom, material } = part
  const scale = part.scale || [1, 1, 1]
  const position = part.position || [0, 0, 0]
  const rotation = buildRotation(part.rotation)

  if (!groups.has(material)) {
    groups.set(material, { positions: [], normals: [], indices: [] })
  }

  const group = groups.get(material)
  const offset = group.positions.length / 3

  for (let i = 0; i < geom.positions.length; i += 3) {
    const [px, py, pz] = applyMatrix(
      rotation,
      geom.positions[i] * scale[0],
      geom.positions[i + 1] * scale[1],
      geom.positions[i + 2] * scale[2],
    )
    group.positions.push(px + position[0], py + position[1], pz + position[2])

    const [nx, ny, nz] = applyMatrix(
      rotation,
      geom.normals[i] / scale[0],
      geom.normals[i + 1] / scale[1],
      geom.normals[i + 2] / scale[2],
    )
    const length = Math.hypot(nx, ny, nz) || 1
    group.normals.push(nx / length, ny / length, nz / length)
  }

  for (const index of geom.indices) group.indices.push(index + offset)
}

/** Escala todo el modelo al tamaño real en metros y lo apoya en y = 0. */
function fitToRealSize(groups, targetHeightMeters) {
  let minY = Infinity
  let maxY = -Infinity

  for (const group of groups.values()) {
    for (let i = 1; i < group.positions.length; i += 3) {
      if (group.positions[i] < minY) minY = group.positions[i]
      if (group.positions[i] > maxY) maxY = group.positions[i]
    }
  }

  const factor = targetHeightMeters / (maxY - minY)

  for (const group of groups.values()) {
    for (let i = 0; i < group.positions.length; i += 3) {
      group.positions[i] *= factor
      group.positions[i + 1] = (group.positions[i + 1] - minY) * factor
      group.positions[i + 2] *= factor
    }
  }
}

// -------------------------------------------------------------- salida GLB

function buildGlb(groups, materials) {
  const json = {
    asset: { version: "2.0", generator: "Santo edit · generar-modelos-3d" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [] }],
    materials: [],
    accessors: [],
    bufferViews: [],
    buffers: [],
  }

  const chunks = []
  let byteOffset = 0

  const pushBufferView = (typedArray, target) => {
    const bytes = Buffer.from(
      typedArray.buffer,
      typedArray.byteOffset,
      typedArray.byteLength,
    )
    const padding = (4 - (bytes.length % 4)) % 4
    json.bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: bytes.length,
      target,
    })
    chunks.push(bytes)
    if (padding) chunks.push(Buffer.alloc(padding))
    byteOffset += bytes.length + padding
    return json.bufferViews.length - 1
  }

  for (const [materialName, group] of groups) {
    const spec = materials[materialName]
    json.materials.push({
      name: materialName,
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorFactor: [...hexToLinear(spec.color), 1],
        metallicFactor: spec.metallic ?? 0,
        roughnessFactor: spec.roughness ?? 0.75,
      },
    })

    const positions = new Float32Array(group.positions)
    const normals = new Float32Array(group.normals)
    const indices = new Uint32Array(group.indices)

    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < positions.length; i += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        if (positions[i + axis] < min[axis]) min[axis] = positions[i + axis]
        if (positions[i + axis] > max[axis]) max[axis] = positions[i + axis]
      }
    }

    const positionView = pushBufferView(positions, 34962)
    const normalView = pushBufferView(normals, 34962)
    const indexView = pushBufferView(indices, 34963)

    json.accessors.push(
      {
        bufferView: positionView,
        componentType: 5126,
        count: positions.length / 3,
        type: "VEC3",
        min,
        max,
      },
      {
        bufferView: normalView,
        componentType: 5126,
        count: normals.length / 3,
        type: "VEC3",
      },
      {
        bufferView: indexView,
        componentType: 5125,
        count: indices.length,
        type: "SCALAR",
      },
    )

    const base = json.accessors.length - 3
    json.meshes[0].primitives.push({
      attributes: { POSITION: base, NORMAL: base + 1 },
      indices: base + 2,
      material: json.materials.length - 1,
    })
  }

  const binary = Buffer.concat(chunks)
  json.buffers.push({ byteLength: binary.length })

  const jsonBuffer = Buffer.from(JSON.stringify(json), "utf8")
  const jsonPadding = (4 - (jsonBuffer.length % 4)) % 4
  const jsonChunk = Buffer.concat([jsonBuffer, Buffer.alloc(jsonPadding, 0x20)])
  const binPadding = (4 - (binary.length % 4)) % 4
  const binChunk = Buffer.concat([binary, Buffer.alloc(binPadding)])

  const header = Buffer.alloc(12)
  header.write("glTF", 0, "ascii")
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8)

  const jsonHeader = Buffer.alloc(8)
  jsonHeader.writeUInt32LE(jsonChunk.length, 0)
  jsonHeader.writeUInt32LE(0x4e4f534a, 4)

  const binHeader = Buffer.alloc(8)
  binHeader.writeUInt32LE(binChunk.length, 0)
  binHeader.writeUInt32LE(0x004e4942, 4)

  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk])
}

// ------------------------------------------------------------- salida USDZ
// El AR de iPhone (AR Quick Look) no lee .glb: solo USDZ. Un .usdz es un ZIP
// SIN comprimir con los datos de cada archivo alineados a 64 bytes, y el
// primero tiene que ser el USD. Adentro va un .usda (USD en texto plano).

/** Números cortos: el .usda es texto y sin esto pesa el doble. */
function num(value) {
  const rounded = Math.round(value * 10000) / 10000
  return Object.is(rounded, -0) ? "0" : String(rounded)
}

function buildUsda(groups, materials, primName) {
  const lines = [
    "#usda 1.0",
    "(",
    `    defaultPrim = "${primName}"`,
    "    metersPerUnit = 1",
    '    upAxis = "Y"',
    ")",
    "",
    `def Xform "${primName}" (`,
    '    kind = "component"',
    ")",
    "{",
    '    def Scope "Looks"',
    "    {",
  ]

  for (const materialName of groups.keys()) {
    const spec = materials[materialName]
    const [r, g, b] = hexToLinear(spec.color)
    lines.push(
      `        def Material "${materialName}"`,
      "        {",
      `            token outputs:surface.connect = </${primName}/Looks/${materialName}/PBR.outputs:surface>`,
      "",
      '            def Shader "PBR"',
      "            {",
      '                uniform token info:id = "UsdPreviewSurface"',
      `                color3f inputs:diffuseColor = (${num(r)}, ${num(g)}, ${num(b)})`,
      `                float inputs:metallic = ${num(spec.metallic ?? 0)}`,
      `                float inputs:roughness = ${num(spec.roughness ?? 0.75)}`,
      "                token outputs:surface",
      "            }",
      "        }",
    )
  }

  lines.push("    }", "")

  for (const [materialName, group] of groups) {
    const vertexCount = group.positions.length / 3
    const points = []
    const normals = []

    for (let i = 0; i < group.positions.length; i += 3) {
      points.push(
        `(${num(group.positions[i])}, ${num(group.positions[i + 1])}, ${num(group.positions[i + 2])})`,
      )
      normals.push(
        `(${num(group.normals[i])}, ${num(group.normals[i + 1])}, ${num(group.normals[i + 2])})`,
      )
    }

    lines.push(
      `    def Mesh "${materialName}_malla"`,
      "    {",
      "        uniform bool doubleSided = 1",
      '        uniform token subdivisionScheme = "none"',
      `        int[] faceVertexCounts = [${new Array(group.indices.length / 3).fill(3).join(", ")}]`,
      `        int[] faceVertexIndices = [${group.indices.join(", ")}]`,
      `        point3f[] points = [${points.join(", ")}]`,
      `        normal3f[] normals = [${normals.join(", ")}] (`,
      '            interpolation = "vertex"',
      "        )",
      `        rel material:binding = </${primName}/Looks/${materialName}>`,
      "    }",
      "",
    )

    if (vertexCount === 0) throw new Error(`malla vacía: ${materialName}`)
  }

  lines.push("}", "")
  return Buffer.from(lines.join("\n"), "utf8")
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let value = i
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[i] = value >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

// Fecha fija (1 ago 2026) para que el archivo salga idéntico en cada corrida.
const DOS_DATE = ((2026 - 1980) << 9) | (8 << 5) | 1
const DOS_TIME = 0

function buildUsdz(entries) {
  const parts = []
  const central = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8")
    const crc = crc32(entry.data)

    // Relleno para que los DATOS empiecen en múltiplo de 64 (lo exige USDZ).
    // Un campo "extra" no puede medir menos de 4 bytes: si falta menos, se
    // suma un bloque entero.
    let padding = (64 - ((offset + 30 + name.length) % 64)) % 64
    if (padding > 0 && padding < 4) padding += 64

    const extra = Buffer.alloc(padding)
    if (padding) {
      extra.writeUInt16LE(0xffff, 0) // id reservado: los lectores lo saltan
      extra.writeUInt16LE(padding - 4, 2)
    }

    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(0, 6)
    header.writeUInt16LE(0, 8) // método 0 = sin comprimir (obligatorio en USDZ)
    header.writeUInt16LE(DOS_TIME, 10)
    header.writeUInt16LE(DOS_DATE, 12)
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(entry.data.length, 18)
    header.writeUInt32LE(entry.data.length, 22)
    header.writeUInt16LE(name.length, 26)
    header.writeUInt16LE(padding, 28)

    const localOffset = offset
    parts.push(header, name, extra, entry.data)
    offset += 30 + name.length + padding + entry.data.length

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(0, 10)
    centralHeader.writeUInt16LE(DOS_TIME, 12)
    centralHeader.writeUInt16LE(DOS_DATE, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(entry.data.length, 20)
    centralHeader.writeUInt32LE(entry.data.length, 24)
    centralHeader.writeUInt16LE(name.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(localOffset, 42)
    central.push(centralHeader, name)
  }

  const centralBuffer = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralBuffer.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...parts, centralBuffer, end])
}

// -------------------------------------------------------------- los platos

const MATERIALS = {
  pan: { color: "#D9A05B", roughness: 0.82 },
  panDorado: { color: "#C98443", roughness: 0.8 },
  ajonjoli: { color: "#F3E2BE", roughness: 0.6 },
  // Más oscura que el pan y que el queso: si no, la carne no se distingue en
  // la miniatura de la ficha.
  carne: { color: "#3E2012", roughness: 0.85 },
  pollo: { color: "#C98C3C", roughness: 0.78 },
  veggie: { color: "#6B5B32", roughness: 0.8 },
  queso: { color: "#F0A81E", roughness: 0.55 },
  quesoGouda: { color: "#EFCB70", roughness: 0.5 },
  cheddarSalsa: { color: "#E8912B", roughness: 0.4 },
  tomate: { color: "#C42B22", roughness: 0.45 },
  lechuga: { color: "#4E9A3E", roughness: 0.6 },
  cebolla: { color: "#E8DFE6", roughness: 0.5 },
  cebollaCaramelizada: { color: "#9C5F22", roughness: 0.55 },
  tocineta: { color: "#8E3B22", roughness: 0.6 },
  chorizo: { color: "#7E2318", roughness: 0.62 },
  champi: { color: "#C9AE8B", roughness: 0.7 },
  jalapeno: { color: "#3F8B33", roughness: 0.45 },
  pepinillo: { color: "#6E8F3A", roughness: 0.45 },
  papa: { color: "#EDBB52", roughness: 0.7 },
  nugget: { color: "#D89F45", roughness: 0.75 },
  nuggetPicante: { color: "#C4551F", roughness: 0.45 },
  cartonRojo: { color: "#C62828", roughness: 0.7 },
  bowl: { color: "#2E2E2E", roughness: 0.6 },
  bandeja: { color: "#3A2A20", roughness: 0.7 },
  tabla: { color: "#6B4B2E", roughness: 0.75 },
  bbq: { color: "#3B1D12", roughness: 0.35 },
  // El glaseado de sriracha va brillante: es lo que dice "caramelizado".
  sriracha: { color: "#C4441C", roughness: 0.32 },
  // Pan de batata: más anaranjado que el brioche, que es lo que distingue
  // a la AMERICAN BASIC en la foto.
  panBatata: { color: "#D98F45", roughness: 0.82 },
  panBatataDorado: { color: "#C0702C", roughness: 0.8 },
  vaso: { color: "#F5F2EC", roughness: 0.35 },
  tapaRoja: { color: "#C62828", roughness: 0.5 },
  pitillo: { color: "#E23B3B", roughness: 0.4 },
  lata: { color: "#C8102E", roughness: 0.28, metallic: 0.25 },
  aluminio: { color: "#C9CCD1", roughness: 0.22, metallic: 0.85 },
  botella: { color: "#8A5A2B", roughness: 0.2 },
  botellaAgua: { color: "#DCEAF2", roughness: 0.4 },
  etiqueta: { color: "#C8102E", roughness: 0.55 },
  tapaBotella: { color: "#B3121E", roughness: 0.5 },
}

// Malla más liviana que la primera versión: en un teléfono no se nota la
// diferencia y hay ~30 modelos, así que cada triángulo se paga 30 veces.
const SEG = 32

// ------------------------------------------------------- burger paramétrico
// Se arma por capas de abajo hacia arriba. Los extras salen de lo que dice la
// descripción real del plato (tocineta, chorizo, champiñones, jalapeños…), así
// que dos hamburguesas distintas del menú NO se ven iguales.

const CARNES = {
  smash: { alto: 0.17, radio: 1.07, material: "carne" },
  res: { alto: 0.34, radio: 1.05, material: "carne" },
  pollo: { alto: 0.28, radio: 1.04, material: "pollo" },
  veggie: { alto: 0.26, radio: 1.02, material: "veggie" },
}

// La loncha mide 1,58 y no 1,95: con el pan en radio ~1,03, a 1,95 las
// esquinas llegaban a 1,38 y sobresalían un 34%. Con UNA loncha pasaba por
// queso derretido; con 2 a 5 apiladas quedaban unas alas amarillas que tapaban
// la carne y el pan. A 1,58 la esquina llega a 1,12: asoma lo justo.
function apilarQueso(groups, y, material, giro) {
  addPart(groups, {
    geom: box({ width: 1.58, height: 0.05, depth: 1.58 }),
    material,
    position: [0, y, 0],
    rotation: { axis: "y", degrees: giro },
  })
  return 0.05
}

function apilarTocineta(groups, y, random) {
  for (let i = 0; i < 3; i += 1) {
    addPart(groups, {
      geom: box({ width: 1.85, height: 0.055, depth: 0.24 }),
      material: "tocineta",
      position: [0, y + 0.028, (i - 1) * 0.4],
      rotation: { axis: "y", degrees: (random() - 0.5) * 20 },
    })
  }
  return 0.06
}

function apilarChorizo(groups, y, random) {
  for (let i = 0; i < 5; i += 1) {
    const angulo = random() * 360
    const distancia = 0.42 + random() * 0.36
    addPart(groups, {
      geom: cylinder({ radiusTop: 0.15, radiusBottom: 0.15, height: 0.44, segments: 14 }),
      material: "chorizo",
      position: [
        Math.cos((angulo * Math.PI) / 180) * distancia,
        y + 0.15,
        Math.sin((angulo * Math.PI) / 180) * distancia,
      ],
      // Acostado (90° en X) y luego girado sobre la hamburguesa.
      rotation: [
        { axis: "x", degrees: 90 },
        { axis: "y", degrees: angulo },
      ],
    })
  }
  return 0.3
}

function apilarChampi(groups, y, random) {
  for (let i = 0; i < 6; i += 1) {
    const angulo = random() * Math.PI * 2
    const distancia = 0.42 + random() * 0.42
    addPart(groups, {
      geom: cylinder({ radiusTop: 0.21, radiusBottom: 0.24, height: 0.09, segments: 16 }),
      material: "champi",
      position: [Math.cos(angulo) * distancia, y + 0.045, Math.sin(angulo) * distancia],
    })
  }
  return 0.09
}

function apilarJalapeno(groups, y, random) {
  for (let i = 0; i < 7; i += 1) {
    const angulo = random() * Math.PI * 2
    const distancia = 0.45 + random() * 0.45
    addPart(groups, {
      geom: cylinder({
        radiusTop: 0.12,
        radiusBottom: 0.12,
        height: 0.06,
        segments: 14,
        capTop: false,
        capBottom: false,
      }),
      material: "jalapeno",
      position: [Math.cos(angulo) * distancia, y + 0.03, Math.sin(angulo) * distancia],
    })
  }
  return 0.06
}

function apilarPepinillo(groups, y, random) {
  for (let i = 0; i < 4; i += 1) {
    const angulo = random() * Math.PI * 2
    const distancia = 0.45 + random() * 0.4
    addPart(groups, {
      geom: cylinder({ radiusTop: 0.23, radiusBottom: 0.23, height: 0.055, segments: 16 }),
      material: "pepinillo",
      position: [Math.cos(angulo) * distancia, y + 0.028, Math.sin(angulo) * distancia],
    })
  }
  return 0.055
}

function apilarCebollaCaramelizada(groups, y) {
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.95, radiusBottom: 0.9, height: 0.09, segments: SEG }),
    material: "cebollaCaramelizada",
    position: [0, y + 0.045, 0],
  })
  return 0.09
}

function apilarEnsalada(groups, y) {
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.96, radiusBottom: 0.96, height: 0.11, segments: SEG }),
    material: "tomate",
    position: [0, y + 0.055, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 1.12, radiusBottom: 1.0, height: 0.1, segments: SEG + 4 }),
    material: "lechuga",
    position: [0, y + 0.16, 0],
  })
  return 0.21
}

function apilarCebollaCruda(groups, y) {
  for (let i = 0; i < 3; i += 1) {
    addPart(groups, {
      geom: cylinder({
        radiusTop: 0.6,
        radiusBottom: 0.6,
        height: 0.045,
        segments: 26,
        capTop: false,
        capBottom: false,
      }),
      material: "cebolla",
      position: [(i - 1) * 0.32, y + 0.022, (i - 1) * 0.15],
      scale: [1.25, 1, 1.25],
    })
  }
  return 0.05
}

const EXTRAS = {
  tocineta: apilarTocineta,
  chorizo: apilarChorizo,
  champi: apilarChampi,
  jalapeno: apilarJalapeno,
  pepinillo: apilarPepinillo,
  cebollaCaramelizada: (groups, y) => apilarCebollaCaramelizada(groups, y),
  ensalada: (groups, y) => apilarEnsalada(groups, y),
  cebolla: (groups, y) => apilarCebollaCruda(groups, y),
}

function buildBurger({
  carnes = 1,
  tipoCarne = "smash",
  quesos = 1,
  tipoQueso = "queso",
  extras = [],
  semilla = 20260801,
} = {}) {
  const groups = new Map()
  const random = makeRandom(semilla)
  let y = 0

  // Pan de abajo.
  addPart(groups, {
    geom: cylinder({ radiusTop: 1.02, radiusBottom: 0.9, height: 0.42, segments: SEG }),
    material: "pan",
    position: [0, 0.21, 0],
  })
  y += 0.42

  // Carne + queso, tantas veces como diga la ficha del plato.
  const carne = CARNES[tipoCarne]
  const quesosPorCarne = carnes > 0 ? quesos / carnes : 0
  let quesosPuestos = 0

  for (let i = 0; i < carnes; i += 1) {
    addPart(groups, {
      geom: cylinder({
        radiusTop: carne.radio,
        radiusBottom: carne.radio - 0.02,
        height: carne.alto,
        segments: SEG,
      }),
      material: carne.material,
      position: [0, y + carne.alto / 2, 0],
    })
    y += carne.alto

    // El pollo crispy lleva unos grumos del empanizado, si no parece un disco.
    if (tipoCarne === "pollo") {
      for (let j = 0; j < 7; j += 1) {
        const angulo = random() * Math.PI * 2
        const distancia = 0.3 + random() * 0.6
        addPart(groups, {
          geom: sphere({ radius: 0.1, widthSegments: 8, heightSegments: 6 }),
          material: "pollo",
          position: [Math.cos(angulo) * distancia, y - 0.03, Math.sin(angulo) * distancia],
          scale: [1, 0.55, 1],
        })
      }
    }

    const objetivo = Math.round(quesosPorCarne * (i + 1))
    while (quesosPuestos < objetivo) {
      y += apilarQueso(groups, y + 0.025, tipoQueso, 18 + quesosPuestos * 26)
      quesosPuestos += 1
    }
  }

  while (quesosPuestos < quesos) {
    y += apilarQueso(groups, y + 0.025, tipoQueso, 18 + quesosPuestos * 26)
    quesosPuestos += 1
  }

  for (const extra of extras) {
    const apilar = EXTRAS[extra]
    if (!apilar) throw new Error(`extra desconocido: ${extra}`)
    y += apilar(groups, y, random)
  }

  // Pan de arriba: media esfera achatada + falda + ajonjolí.
  addPart(groups, {
    geom: cylinder({ radiusTop: 1.03, radiusBottom: 1.0, height: 0.12, segments: SEG, capTop: false }),
    material: "panDorado",
    position: [0, y + 0.06, 0],
  })
  addPart(groups, {
    geom: sphere({ radius: 1.03, thetaLength: Math.PI / 2, widthSegments: SEG, heightSegments: 12 }),
    material: "panDorado",
    position: [0, y + 0.06, 0],
    scale: [1, 0.5, 1],
  })

  for (let i = 0; i < 14; i += 1) {
    const theta = random() * 0.95
    const phi = random() * Math.PI * 2
    addPart(groups, {
      geom: sphere({ radius: 0.055, widthSegments: 8, heightSegments: 5 }),
      material: "ajonjoli",
      position: [
        1.02 * Math.sin(theta) * Math.cos(phi),
        y + 0.06 + 1.02 * Math.cos(theta) * 0.5,
        1.02 * Math.sin(theta) * Math.sin(phi),
      ],
      scale: [1.5, 0.7, 1],
      rotation: { axis: "y", degrees: (phi * 180) / Math.PI },
    })
  }

  return groups
}

// ------------------------------------------------------------------ antojos

function buildPapas({ cheddar = false, tocineta = false, semilla = 77712 } = {}) {
  const groups = new Map()
  const random = makeRandom(semilla)

  addPart(groups, {
    geom: cylinder({
      radiusTop: 0.98,
      radiusBottom: 0.64,
      height: 1.7,
      segments: 4,
      capTop: false,
    }),
    material: "cartonRojo",
    position: [0, 0.85, 0],
    rotation: { axis: "y", degrees: 45 },
  })

  // El cartón es un prisma de 4 caras: su radio útil es el de las CARAS
  // (radio × cos 45 ≈ 0,707), no el de las esquinas. Si una papa se pasa de
  // ahí, atraviesa la pared y se ve pegada por fuera.
  const BASE_Y = 1.25
  const DESPLAZAMIENTO = 0.32

  for (let i = 0; i < 18; i += 1) {
    const alto = 1.05 + random() * 0.6
    addPart(groups, {
      geom: box({ width: 0.11, height: alto, depth: 0.11 }),
      material: "papa",
      position: [
        (random() - 0.5) * 2 * DESPLAZAMIENTO,
        BASE_Y + alto / 2,
        (random() - 0.5) * 2 * DESPLAZAMIENTO,
      ],
      rotation: { axis: random() > 0.5 ? "x" : "z", degrees: (random() - 0.5) * 24 },
    })
  }

  if (cheddar) {
    for (let i = 0; i < 14; i += 1) {
      const angulo = random() * Math.PI * 2
      const distancia = random() * 0.42
      addPart(groups, {
        geom: sphere({ radius: 0.19, widthSegments: 10, heightSegments: 7 }),
        material: "cheddarSalsa",
        position: [
          Math.cos(angulo) * distancia,
          2.05 + random() * 0.55,
          Math.sin(angulo) * distancia,
        ],
        scale: [1.3, 0.5, 1.3],
      })
    }
  }

  if (tocineta) {
    for (let i = 0; i < 9; i += 1) {
      const angulo = random() * Math.PI * 2
      const distancia = random() * 0.36
      addPart(groups, {
        geom: box({ width: 0.19, height: 0.07, depth: 0.13 }),
        material: "tocineta",
        position: [
          Math.cos(angulo) * distancia,
          2.25 + random() * 0.5,
          Math.sin(angulo) * distancia,
        ],
        rotation: { axis: "y", degrees: random() * 90 },
      })
    }
  }

  return groups
}

function buildBites({ picante = false, semilla = 5150 } = {}) {
  const groups = new Map()
  const random = makeRandom(semilla)
  const material = picante ? "nuggetPicante" : "nugget"

  addPart(groups, {
    geom: cylinder({
      radiusTop: 1.05,
      radiusBottom: 0.8,
      height: 0.8,
      segments: 4,
      capTop: false,
    }),
    material: "cartonRojo",
    position: [0, 0.4, 0],
    rotation: { axis: "y", degrees: 45 },
  })

  // Bien achatados y alargados: una esfera poco deformada parecía una bolita
  // (y en la versión picante, cerezas).
  for (let i = 0; i < 11; i += 1) {
    const angulo = random() * Math.PI * 2
    const distancia = random() * 0.4
    addPart(groups, {
      geom: sphere({ radius: 0.26, widthSegments: 12, heightSegments: 8 }),
      material,
      position: [
        Math.cos(angulo) * distancia,
        0.66 + random() * 0.5,
        Math.sin(angulo) * distancia,
      ],
      scale: [1.5, 0.5, 0.85],
      rotation: [
        { axis: "z", degrees: (random() - 0.5) * 40 },
        { axis: "y", degrees: random() * 180 },
      ],
    })
  }

  return groups
}

function buildBowl({ semilla = 909 } = {}) {
  const groups = new Map()
  const random = makeRandom(semilla)

  addPart(groups, {
    geom: cylinder({ radiusTop: 1.25, radiusBottom: 0.8, height: 0.8, segments: SEG, capTop: false }),
    material: "bowl",
    position: [0, 0.4, 0],
  })

  for (let i = 0; i < 16; i += 1) {
    const angulo = random() * Math.PI * 2
    const distancia = random() * 0.75
    addPart(groups, {
      geom: box({ width: 0.11, height: 0.75, depth: 0.11 }),
      material: "papa",
      position: [Math.cos(angulo) * distancia, 0.78 + random() * 0.18, Math.sin(angulo) * distancia],
      rotation: { axis: random() > 0.5 ? "x" : "z", degrees: (random() - 0.5) * 80 },
    })
  }

  for (let i = 0; i < 13; i += 1) {
    const angulo = random() * Math.PI * 2
    const distancia = random() * 0.8
    addPart(groups, {
      geom: sphere({ radius: 0.22, widthSegments: 10, heightSegments: 7 }),
      material: "cheddarSalsa",
      position: [Math.cos(angulo) * distancia, 1.02 + random() * 0.12, Math.sin(angulo) * distancia],
      scale: [1.35, 0.5, 1.35],
    })
  }

  for (let i = 0; i < 5; i += 1) {
    const angulo = random() * Math.PI * 2
    const distancia = random() * 0.6
    addPart(groups, {
      geom: sphere({ radius: 0.26, widthSegments: 10, heightSegments: 7 }),
      material: "nugget",
      position: [Math.cos(angulo) * distancia, 1.2, Math.sin(angulo) * distancia],
      scale: [1.25, 0.7, 0.95],
      rotation: { axis: "y", degrees: random() * 180 },
    })
  }

  return groups
}

// ------------------------------------------------------------------ bebidas

function buildRefresco() {
  const groups = new Map()

  addPart(groups, {
    geom: cylinder({ radiusTop: 0.78, radiusBottom: 0.58, height: 1.9, segments: SEG + 8 }),
    material: "vaso",
    position: [0, 0.95, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.83, radiusBottom: 0.83, height: 0.14, segments: SEG + 8 }),
    material: "tapaRoja",
    position: [0, 1.94, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.3, radiusBottom: 0.3, height: 0.08, segments: 24 }),
    material: "tapaRoja",
    position: [0, 2.03, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.075, radiusBottom: 0.075, height: 1.3, segments: 16 }),
    material: "pitillo",
    position: [0.12, 2.5, 0.05],
    rotation: { axis: "z", degrees: -11 },
  })

  return groups
}

function buildLata() {
  const groups = new Map()

  addPart(groups, {
    geom: cylinder({ radiusTop: 0.33, radiusBottom: 0.33, height: 1, segments: SEG + 8, capTop: false }),
    material: "lata",
    position: [0, 0.58, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.265, radiusBottom: 0.33, height: 0.1, segments: SEG + 8, capTop: false }),
    material: "lata",
    position: [0, 1.13, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.33, radiusBottom: 0.285, height: 0.08, segments: SEG + 8, capTop: false }),
    material: "lata",
    position: [0, 0.04, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.275, radiusBottom: 0.265, height: 0.035, segments: SEG + 8 }),
    material: "aluminio",
    position: [0, 1.2, 0],
  })
  addPart(groups, {
    geom: cylinder({
      radiusTop: 0.075,
      radiusBottom: 0.075,
      height: 0.012,
      segments: 18,
      capTop: false,
      capBottom: false,
    }),
    material: "aluminio",
    position: [0.09, 1.225, 0],
    scale: [1, 1, 1.5],
  })

  return groups
}

function buildBotella({ agua = false } = {}) {
  const groups = new Map()
  const cuerpo = agua ? "botellaAgua" : "botella"

  addPart(groups, {
    geom: cylinder({ radiusTop: 0.42, radiusBottom: 0.42, height: 1.85, segments: SEG, capTop: false }),
    material: cuerpo,
    position: [0, 0.95, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.4, radiusBottom: 0.42, height: 0.06, segments: SEG }),
    material: cuerpo,
    position: [0, 0.03, 0],
  })
  // Hombro y cuello.
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.19, radiusBottom: 0.42, height: 0.5, segments: SEG, capTop: false }),
    material: cuerpo,
    position: [0, 2.12, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.17, radiusBottom: 0.19, height: 0.26, segments: SEG, capTop: false }),
    material: cuerpo,
    position: [0, 2.5, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.2, radiusBottom: 0.2, height: 0.22, segments: SEG }),
    material: agua ? "aluminio" : "tapaBotella",
    position: [0, 2.72, 0],
  })
  // Etiqueta.
  addPart(groups, {
    geom: cylinder({
      radiusTop: 0.435,
      radiusBottom: 0.435,
      height: 1.05,
      segments: SEG,
      capTop: false,
      capBottom: false,
    }),
    material: agua ? "botellaAgua" : "etiqueta",
    position: [0, 1.05, 0],
  })

  return groups
}

// ------------------------------------------------------------------- combos
// Los sub-modelos se normalizan a METROS antes de juntarlos: si no, cada uno
// viene en sus propias unidades de diseño y la bandeja saldría con una
// hamburguesa gigante al lado de una lata diminuta.

function fusionar(destino, origen, { escala = 1, desplazamiento = [0, 0, 0] } = {}) {
  for (const [material, group] of origen) {
    if (!destino.has(material)) {
      destino.set(material, { positions: [], normals: [], indices: [] })
    }

    const acumulado = destino.get(material)
    const offset = acumulado.positions.length / 3

    for (let i = 0; i < group.positions.length; i += 3) {
      acumulado.positions.push(
        group.positions[i] * escala + desplazamiento[0],
        group.positions[i + 1] * escala + desplazamiento[1],
        group.positions[i + 2] * escala + desplazamiento[2],
      )
      acumulado.normals.push(group.normals[i], group.normals[i + 1], group.normals[i + 2])
    }

    for (const index of group.indices) acumulado.indices.push(index + offset)
  }
}

function enMetros(groups, alturaReal) {
  fitToRealSize(groups, alturaReal)
  return groups
}

function buildCombo() {
  const groups = new Map()
  const ALTO_BANDEJA = 0.012

  addPart(groups, {
    geom: box({ width: 0.46, height: ALTO_BANDEJA, depth: 0.34 }),
    material: "bandeja",
    position: [0, ALTO_BANDEJA / 2, 0],
  })

  fusionar(
    groups,
    enMetros(buildBurger({ carnes: 2, quesos: 2, extras: ["tocineta", "ensalada"] }), 0.115),
    { desplazamiento: [-0.115, ALTO_BANDEJA, -0.02] },
  )
  fusionar(
    groups,
    enMetros(
      buildBurger({ carnes: 2, quesos: 2, extras: ["tocineta", "cebollaCaramelizada"], semilla: 4242 }),
      0.115,
    ),
    { desplazamiento: [0.02, ALTO_BANDEJA, 0.05] },
  )
  fusionar(groups, enMetros(buildPapas({ cheddar: true }), 0.16), {
    desplazamiento: [0.15, ALTO_BANDEJA, -0.04],
  })
  fusionar(groups, enMetros(buildLata(), 0.123), {
    desplazamiento: [-0.02, ALTO_BANDEJA, -0.1],
  })

  return groups
}

// ------------------------------------------------- los 7 más vendidos
// Ranking sacado de `order_items` de producción (1 ago 2026): estos 7 platos
// son el 77% de todas las unidades vendidas. Por eso llevan modelo PROPIO y
// con más detalle, en vez de compartir uno de familia como el resto del menú.

// 1º · CHEDDAR BOWL — 23,2% de las ventas.
// "300grs de papas importadas, bañadas en queso cheddar con topping de
//  nuggets, tocineta y BBQ."
function buildCheddarBowl() {
  const groups = new Map()
  const random = makeRandom(99001)

  addPart(groups, {
    geom: cylinder({ radiusTop: 1.5, radiusBottom: 0.98, height: 0.66, segments: SEG + 8, capTop: false }),
    material: "bowl",
    position: [0, 0.33, 0],
  })
  addPart(groups, {
    geom: cylinder({
      radiusTop: 1.55,
      radiusBottom: 1.5,
      height: 0.07,
      segments: SEG + 8,
      capTop: false,
      capBottom: false,
    }),
    material: "bowl",
    position: [0, 0.66, 0],
  })

  // Papas apretadas, llenando el bowl (300 g es bastante).
  for (let i = 0; i < 30; i += 1) {
    const angulo = random() * Math.PI * 2
    const distancia = random() * 1.05
    addPart(groups, {
      geom: box({ width: 0.115, height: 0.62 + random() * 0.4, depth: 0.115 }),
      material: "papa",
      position: [Math.cos(angulo) * distancia, 0.5 + random() * 0.32, Math.sin(angulo) * distancia],
      rotation: [
        { axis: "z", degrees: (random() - 0.5) * 120 },
        { axis: "y", degrees: random() * 360 },
      ],
    })
  }

  // Cheddar: una capa que cae por encima y chorrea por el borde.
  addPart(groups, {
    geom: cylinder({ radiusTop: 1.28, radiusBottom: 1.34, height: 0.13, segments: SEG + 8 }),
    material: "cheddarSalsa",
    position: [0, 0.86, 0],
  })
  for (let i = 0; i < 9; i += 1) {
    const angulo = (i / 9) * Math.PI * 2
    addPart(groups, {
      geom: sphere({ radius: 0.12, widthSegments: 10, heightSegments: 7 }),
      material: "cheddarSalsa",
      position: [Math.cos(angulo) * 1.4, 0.62 - random() * 0.14, Math.sin(angulo) * 1.4],
      scale: [0.9, 1.25, 0.9],
    })
  }

  // Topping: nuggets, tocineta y el hilo de BBQ.
  for (let i = 0; i < 6; i += 1) {
    const angulo = random() * Math.PI * 2
    const distancia = random() * 0.85
    addPart(groups, {
      geom: sphere({ radius: 0.27, widthSegments: 12, heightSegments: 8 }),
      material: "nugget",
      position: [Math.cos(angulo) * distancia, 1.0, Math.sin(angulo) * distancia],
      scale: [1.4, 0.55, 0.9],
      rotation: { axis: "y", degrees: random() * 180 },
    })
  }
  for (let i = 0; i < 12; i += 1) {
    const angulo = random() * Math.PI * 2
    const distancia = random() * 1.05
    addPart(groups, {
      geom: box({ width: 0.2, height: 0.06, depth: 0.13 }),
      material: "tocineta",
      position: [Math.cos(angulo) * distancia, 1.03 + random() * 0.08, Math.sin(angulo) * distancia],
      rotation: { axis: "y", degrees: random() * 180 },
    })
  }
  // BBQ: manchas oscuras y aplastadas. Con cilindros salían unas brochetas
  // metálicas atravesando el plato.
  for (let i = 0; i < 16; i += 1) {
    const angulo = random() * Math.PI * 2
    const distancia = random() * 1.1
    addPart(groups, {
      geom: sphere({ radius: 0.12, widthSegments: 8, heightSegments: 6 }),
      material: "bbq",
      position: [Math.cos(angulo) * distancia, 1.02 + random() * 0.06, Math.sin(angulo) * distancia],
      scale: [1.7, 0.22, 1.2],
      rotation: { axis: "y", degrees: random() * 180 },
    })
  }

  return groups
}

// 2º · BOMBASTYC — 20,2%. Es promo: burger smash + tu "holy" al lado.
function buildBombastyc() {
  const groups = new Map()
  const random = makeRandom(99002)
  const ALTO_TABLA = 0.011

  addPart(groups, {
    geom: box({ width: 0.34, height: ALTO_TABLA, depth: 0.21 }),
    material: "tabla",
    position: [0, ALTO_TABLA / 2, 0],
  })

  fusionar(
    groups,
    enMetros(
      buildBurger({ carnes: 1, quesos: 1, extras: ["tocineta", "pepinillo"], semilla: 99012 }),
      0.105,
    ),
    { desplazamiento: [-0.075, ALTO_TABLA, 0] },
  )

  // El "holy" al lado, en su bandejita.
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.075, radiusBottom: 0.058, height: 0.05, segments: 4, capTop: false }),
    material: "cartonRojo",
    position: [0.085, ALTO_TABLA + 0.025, 0],
    rotation: { axis: "y", degrees: 45 },
  })
  for (let i = 0; i < 7; i += 1) {
    const angulo = random() * Math.PI * 2
    const distancia = random() * 0.035
    addPart(groups, {
      geom: sphere({ radius: 0.019, widthSegments: 10, heightSegments: 7 }),
      material: "nugget",
      position: [
        0.085 + Math.cos(angulo) * distancia,
        ALTO_TABLA + 0.05 + random() * 0.022,
        Math.sin(angulo) * distancia,
      ],
      scale: [1.5, 0.55, 0.9],
      rotation: { axis: "y", degrees: random() * 180 },
    })
  }

  return groups
}

// 3º · HOLY DRAGON´S — 8,2%.
// "Bites de pechuga Crispy Spice caramelizados en nuestra reducción de Sriracha."
function buildHolyDragons() {
  const groups = new Map()
  const random = makeRandom(99003)

  addPart(groups, {
    geom: cylinder({ radiusTop: 1.0, radiusBottom: 0.8, height: 0.88, segments: 4, capTop: false }),
    material: "cartonRojo",
    position: [0, 0.44, 0],
    rotation: { axis: "y", degrees: 45 },
  })

  // Caramelizados: el glaseado va brillante (roughness baja) y bien apilados.
  for (let i = 0; i < 14; i += 1) {
    const angulo = random() * Math.PI * 2
    const distancia = random() * 0.5
    addPart(groups, {
      geom: sphere({ radius: 0.27, widthSegments: 12, heightSegments: 8 }),
      material: "sriracha",
      position: [
        Math.cos(angulo) * distancia,
        0.72 + random() * 0.48,
        Math.sin(angulo) * distancia,
      ],
      scale: [1.2, 0.62, 0.92],
      rotation: [
        { axis: "z", degrees: (random() - 0.5) * 45 },
        { axis: "y", degrees: random() * 180 },
      ],
    })
  }

  // Ajonjolí encima, como sale el plato.
  for (let i = 0; i < 16; i += 1) {
    const angulo = random() * Math.PI * 2
    const distancia = random() * 0.55
    addPart(groups, {
      geom: sphere({ radius: 0.042, widthSegments: 6, heightSegments: 5 }),
      material: "ajonjoli",
      position: [
        Math.cos(angulo) * distancia,
        1.08 + random() * 0.16,
        Math.sin(angulo) * distancia,
      ],
      scale: [1.4, 0.6, 1],
    })
  }

  return groups
}

// 4º · FRENCH FRIES PARTY — 7,0%. "Ración de 1 kg": es una cesta para compartir.
function buildFriesParty() {
  const groups = new Map()
  const random = makeRandom(99004)

  addPart(groups, {
    geom: cylinder({ radiusTop: 1.6, radiusBottom: 1.25, height: 0.98, segments: SEG, capTop: false }),
    material: "cartonRojo",
    position: [0, 0.49, 0],
  })
  addPart(groups, {
    geom: cylinder({
      radiusTop: 1.67,
      radiusBottom: 1.6,
      height: 0.08,
      segments: SEG,
      capTop: false,
      capBottom: false,
    }),
    material: "cartonRojo",
    position: [0, 0.98, 0],
  })

  // Un kilo: montaña de papas, unas paradas y otras acostadas.
  for (let i = 0; i < 46; i += 1) {
    const angulo = random() * Math.PI * 2
    const distancia = random() * 1.35
    const acostada = random() > 0.78
    addPart(groups, {
      geom: box({ width: 0.115, height: 0.85 + random() * 0.65, depth: 0.115 }),
      material: "papa",
      position: [
        Math.cos(angulo) * distancia,
        0.78 + random() * 0.6,
        Math.sin(angulo) * distancia,
      ],
      rotation: [
        { axis: "z", degrees: acostada ? 62 + random() * 34 : (random() - 0.5) * 30 },
        { axis: "y", degrees: random() * 360 },
      ],
    })
  }

  return groups
}

// 5º · AMERICAN BASIC — 6,6%.
// "Pan brioche de BATATA, smash de 75grs, queso americano, tocineta crujiente,
//  pepinillos." El pan de batata es más anaranjado: es lo que la distingue.
function buildAmericanBasic() {
  const groups = buildBurger({
    carnes: 1,
    quesos: 1,
    extras: ["tocineta", "pepinillo"],
    semilla: 99005,
  })

  // Se repinta el pan: el generador lo deja en los materiales `pan` y
  // `panDorado`, y acá van los de batata.
  for (const [origen, destino] of [["pan", "panBatata"], ["panDorado", "panBatataDorado"]]) {
    const grupo = groups.get(origen)
    if (grupo) {
      groups.set(destino, grupo)
      groups.delete(origen)
    }
  }

  return groups
}

// 6º · PAPAS AMERICANAS — 6,1%.
// "300grs de papas importadas grandes con cheddar y tocineta."
function buildPapasAmericanas() {
  const groups = buildPapas({ cheddar: true, tocineta: true, semilla: 99006 })
  const random = makeRandom(99016)

  // Más cheddar que la versión de familia: acá el queso es el protagonista.
  for (let i = 0; i < 10; i += 1) {
    const angulo = random() * Math.PI * 2
    addPart(groups, {
      geom: sphere({ radius: 0.16, widthSegments: 10, heightSegments: 7 }),
      material: "cheddarSalsa",
      position: [
        Math.cos(angulo) * (0.1 + random() * 0.32),
        2.32 + random() * 0.36,
        Math.sin(angulo) * (0.1 + random() * 0.32),
      ],
      scale: [1.45, 0.42, 1.45],
    })
  }

  return groups
}

// 7º · EL BARCO + REFRESCO — 6,1%. "(2) Hamburguesas DOBLE + …": es el barco.
function buildBarco() {
  const groups = new Map()
  const ALTO = 0.014

  // El "barco": bandeja alargada con paredes inclinadas.
  addPart(groups, {
    geom: box({ width: 0.5, height: ALTO, depth: 0.26 }),
    material: "bandeja",
    position: [0, ALTO / 2, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.2, radiusBottom: 0.16, height: 0.05, segments: 4, capTop: false, capBottom: false }),
    material: "bandeja",
    position: [0, ALTO + 0.025, 0],
    rotation: { axis: "y", degrees: 45 },
    scale: [1.85, 1, 1],
  })

  fusionar(
    groups,
    enMetros(buildBurger({ carnes: 2, quesos: 2, extras: ["tocineta", "pepinillo"], semilla: 99007 }), 0.125),
    { desplazamiento: [-0.155, ALTO, -0.005] },
  )
  fusionar(
    groups,
    enMetros(buildBurger({ carnes: 2, quesos: 2, extras: ["tocineta", "cebollaCaramelizada"], semilla: 99017 }), 0.125),
    { desplazamiento: [-0.03, ALTO, 0.035] },
  )
  fusionar(groups, enMetros(buildPapas({ cheddar: true, semilla: 99027 }), 0.15), {
    desplazamiento: [0.115, ALTO, -0.03],
  })
  fusionar(groups, enMetros(buildLata(), 0.123), { desplazamiento: [0.205, ALTO, 0.05] })

  return groups
}

// --------------------------------------------------------------------- main
// `altura` = alto real en metros. `null` = el modelo ya viene en metros
// (los combos, que se arman juntando sub-modelos ya escalados).

const MODELOS = [
  // Hamburguesas de carne
  { nombre: "burger-smash", prim: "Burger", altura: 0.102,
    build: () => buildBurger({ carnes: 1, quesos: 1, extras: ["tocineta", "ensalada"] }) },
  { nombre: "burger-smash-picante", prim: "BurgerPicante", altura: 0.105,
    build: () => buildBurger({ carnes: 1, quesos: 1, extras: ["tocineta", "jalapeno", "cebollaCaramelizada"], semilla: 311 }) },
  { nombre: "burger-smash-dulce", prim: "BurgerDulce", altura: 0.104,
    build: () => buildBurger({ carnes: 1, quesos: 1, extras: ["tocineta", "cebollaCaramelizada"], semilla: 512 }) },
  { nombre: "burger-doble", prim: "BurgerDoble", altura: 0.124,
    build: () => buildBurger({ carnes: 2, quesos: 2, extras: ["tocineta", "pepinillo"], semilla: 720 }) },
  { nombre: "burger-doble-champi", prim: "BurgerDobleChampi", altura: 0.128,
    build: () => buildBurger({ carnes: 2, quesos: 2, extras: ["tocineta", "champi", "cebollaCaramelizada"], semilla: 833 }) },
  { nombre: "burger-doble-picante", prim: "BurgerDoblePicante", altura: 0.126,
    build: () => buildBurger({ carnes: 2, quesos: 2, extras: ["tocineta", "jalapeno"], semilla: 944 }) },
  { nombre: "burger-doble-chorizo", prim: "BurgerDobleChorizo", altura: 0.132,
    build: () => buildBurger({ carnes: 2, quesos: 2, extras: ["chorizo", "cebollaCaramelizada"], semilla: 1055 }) },
  { nombre: "burger-doble-dulce", prim: "BurgerDobleDulce", altura: 0.126,
    build: () => buildBurger({ carnes: 2, quesos: 2, extras: ["tocineta", "cebollaCaramelizada"], semilla: 1077 }) },
  { nombre: "burger-doble-gouda", prim: "BurgerDobleGouda", altura: 0.126,
    build: () => buildBurger({ carnes: 2, quesos: 2, tipoQueso: "quesoGouda", extras: ["tocineta", "cebollaCaramelizada"], semilla: 1166 }) },
  { nombre: "burger-res", prim: "BurgerRes", altura: 0.118,
    build: () => buildBurger({ carnes: 1, tipoCarne: "res", quesos: 1, extras: ["tocineta", "ensalada"], semilla: 1277 }) },
  { nombre: "burger-res-champi", prim: "BurgerResChampi", altura: 0.122,
    build: () => buildBurger({ carnes: 1, tipoCarne: "res", quesos: 1, extras: ["tocineta", "champi", "cebollaCaramelizada"], semilla: 1388 }) },
  { nombre: "burger-res-chorizo", prim: "BurgerResChorizo", altura: 0.128,
    build: () => buildBurger({ carnes: 1, tipoCarne: "res", quesos: 2, extras: ["chorizo", "cebollaCaramelizada"], semilla: 1499 }) },
  { nombre: "burger-res-pepinillo", prim: "BurgerResClasica", altura: 0.118,
    build: () => buildBurger({ carnes: 1, tipoCarne: "res", quesos: 1, extras: ["tocineta", "pepinillo"], semilla: 1610 }) },
  { nombre: "burger-res-dulce", prim: "BurgerResDulce", altura: 0.122,
    build: () => buildBurger({ carnes: 1, tipoCarne: "res", quesos: 1, extras: ["tocineta", "cebollaCaramelizada"], semilla: 1655 }) },
  { nombre: "burger-res-doble", prim: "BurgerResDoble", altura: 0.152,
    build: () => buildBurger({ carnes: 2, tipoCarne: "res", quesos: 4, extras: ["tocineta", "pepinillo"], semilla: 1721 }) },
  { nombre: "burger-triple", prim: "BurgerTriple", altura: 0.155,
    build: () => buildBurger({ carnes: 3, quesos: 3, extras: ["tocineta", "champi", "cebollaCaramelizada"], semilla: 1832 }) },
  { nombre: "burger-monster", prim: "BurgerMonster", altura: 0.19,
    build: () => buildBurger({ carnes: 5, quesos: 5, extras: ["tocineta", "pepinillo"], semilla: 1943 }) },
  // Hamburguesas de pollo
  { nombre: "burger-pollo", prim: "BurgerPollo", altura: 0.118,
    build: () => buildBurger({ carnes: 1, tipoCarne: "pollo", quesos: 1, extras: ["tocineta", "ensalada"], semilla: 2054 }) },
  { nombre: "burger-pollo-champi", prim: "BurgerPolloChampi", altura: 0.122,
    build: () => buildBurger({ carnes: 1, tipoCarne: "pollo", quesos: 1, extras: ["tocineta", "champi", "cebollaCaramelizada"], semilla: 2165 }) },
  { nombre: "burger-pollo-chorizo", prim: "BurgerPolloChorizo", altura: 0.128,
    build: () => buildBurger({ carnes: 1, tipoCarne: "pollo", quesos: 2, extras: ["chorizo", "tocineta"], semilla: 2276 }) },
  { nombre: "burger-pollo-picante", prim: "BurgerPolloPicante", altura: 0.12,
    build: () => buildBurger({ carnes: 1, tipoCarne: "pollo", quesos: 1, extras: ["jalapeno", "cebollaCaramelizada"], semilla: 2387 }) },
  { nombre: "burger-pollo-clasica", prim: "BurgerPolloClasica", altura: 0.118,
    build: () => buildBurger({ carnes: 1, tipoCarne: "pollo", quesos: 2, extras: ["tocineta", "pepinillo"], semilla: 2498 }) },
  { nombre: "burger-pollo-doble", prim: "BurgerPolloDoble", altura: 0.15,
    build: () => buildBurger({ carnes: 2, tipoCarne: "pollo", quesos: 4, extras: ["tocineta", "pepinillo"], semilla: 2609 }) },
  { nombre: "burger-mixta", prim: "BurgerMixta", altura: 0.155,
    build: () => {
      // DOUBLE TROUBLE: una de pollo y una de res en el mismo pan.
      const groups = buildBurger({ carnes: 1, tipoCarne: "res", quesos: 2, extras: ["tocineta"], semilla: 2720 })
      const arriba = buildBurger({ carnes: 1, tipoCarne: "pollo", quesos: 2, extras: ["pepinillo"], semilla: 2831 })
      // Solo la parte de arriba del segundo: se descarta su pan de abajo.
      fusionar(groups, arriba, { desplazamiento: [0, 0.62, 0] })
      return groups
    } },
  // Otras
  { nombre: "burger-veggie", prim: "BurgerVeggie", altura: 0.112,
    build: () => buildBurger({ carnes: 1, tipoCarne: "veggie", quesos: 1, extras: ["ensalada", "cebolla"], semilla: 2942 }) },
  { nombre: "burger-kids", prim: "BurgerKids", altura: 0.085,
    build: () => buildBurger({ carnes: 1, quesos: 1, extras: ["tocineta"], semilla: 3053 }) },
  // Antojos
  { nombre: "papas", prim: "Papas", altura: 0.16, build: () => buildPapas() },
  { nombre: "papas-cheddar", prim: "PapasCheddar", altura: 0.16,
    build: () => buildPapas({ cheddar: true, tocineta: true, semilla: 3164 }) },
  { nombre: "papas-jumbo", prim: "PapasJumbo", altura: 0.22, build: () => buildPapas({ semilla: 3275 }) },
  { nombre: "bites", prim: "Bites", altura: 0.1, build: () => buildBites() },
  { nombre: "bites-picante", prim: "BitesPicante", altura: 0.1,
    build: () => buildBites({ picante: true, semilla: 3386 }) },
  { nombre: "bowl-cheddar", prim: "BowlCheddar", altura: 0.115, build: () => buildBowl() },
  // Bebidas
  { nombre: "lata", prim: "Lata", altura: 0.123, build: () => buildLata() },
  { nombre: "botella", prim: "Botella", altura: 0.31, build: () => buildBotella() },
  { nombre: "botella-agua", prim: "BotellaAgua", altura: 0.24,
    build: () => buildBotella({ agua: true }) },
  { nombre: "refresco", prim: "Refresco", altura: 0.18, build: () => buildRefresco() },
  // Combos
  { nombre: "combo", prim: "Combo", altura: null, build: () => buildCombo() },
  // Los 7 más vendidos, con modelo propio (77% de las unidades)
  { nombre: "cheddar-bowl", prim: "CheddarBowl", altura: 0.13, build: () => buildCheddarBowl() },
  { nombre: "bombastyc", prim: "Bombastyc", altura: null, build: () => buildBombastyc() },
  { nombre: "holy-dragons", prim: "HolyDragons", altura: 0.105, build: () => buildHolyDragons() },
  { nombre: "fries-party", prim: "FriesParty", altura: 0.2, build: () => buildFriesParty() },
  { nombre: "american-basic", prim: "AmericanBasic", altura: 0.105, build: () => buildAmericanBasic() },
  { nombre: "papas-americanas", prim: "PapasAmericanas", altura: 0.17, build: () => buildPapasAmericanas() },
  { nombre: "barco", prim: "Barco", altura: null, build: () => buildBarco() },
]

mkdirSync(OUT_DIR, { recursive: true })

let totalGlb = 0
let totalUsdz = 0

for (const modelo of MODELOS) {
  const groups = modelo.build()
  if (modelo.altura !== null) fitToRealSize(groups, modelo.altura)

  const glb = buildGlb(groups, MATERIALS)
  writeFileSync(resolve(OUT_DIR, `${modelo.nombre}.glb`), glb)

  const usda = buildUsda(groups, MATERIALS, modelo.prim)
  const usdz = buildUsdz([{ name: `${modelo.nombre}.usda`, data: usda }])
  writeFileSync(resolve(OUT_DIR, `${modelo.nombre}.usdz`), usdz)

  totalGlb += glb.length
  totalUsdz += usdz.length

  let triangles = 0
  for (const group of groups.values()) triangles += group.indices.length / 3

  console.log(
    modelo.nombre.padEnd(24),
    `glb ${(glb.length / 1024).toFixed(0)} KB`.padStart(11),
    `usdz ${(usdz.length / 1024).toFixed(0)} KB`.padStart(13),
    `${triangles.toLocaleString("es")} tri`.padStart(12),
    `${groups.size} mat`,
  )
}

console.log(
  `\n${MODELOS.length} modelos · ${(totalGlb / 1024 / 1024).toFixed(2)} MB en .glb · ${(totalUsdz / 1024 / 1024).toFixed(2)} MB en .usdz`,
)
console.log(`Listo en ${OUT_DIR}`)
