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
  const rotation = part.rotation
    ? rotationMatrix(part.rotation.axis, part.rotation.degrees)
    : [1, 0, 0, 0, 1, 0, 0, 0, 1]

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
  const rounded = Math.round(value * 100000) / 100000
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
  carne: { color: "#4E2A17", roughness: 0.85 },
  queso: { color: "#F0A81E", roughness: 0.55 },
  tomate: { color: "#C42B22", roughness: 0.45 },
  lechuga: { color: "#4E9A3E", roughness: 0.6 },
  cebolla: { color: "#E8DFE6", roughness: 0.5 },
  papa: { color: "#EDBB52", roughness: 0.7 },
  cartonRojo: { color: "#C62828", roughness: 0.7 },
  vaso: { color: "#F5F2EC", roughness: 0.35 },
  tapaRoja: { color: "#C62828", roughness: 0.5 },
  pitillo: { color: "#E23B3B", roughness: 0.4 },
  lata: { color: "#C8102E", roughness: 0.28, metallic: 0.25 },
  aluminio: { color: "#C9CCD1", roughness: 0.22, metallic: 0.85 },
}

function buildHamburguesa() {
  const groups = new Map()
  const random = makeRandom(20260801)

  // Pan de abajo: un poco más angosto abajo, como el real.
  addPart(groups, {
    geom: cylinder({ radiusTop: 1.02, radiusBottom: 0.9, height: 0.42, segments: 48 }),
    material: "pan",
    position: [0, 0.21, 0],
  })

  // Carne, ligeramente más ancha que el pan (se asoma).
  addPart(groups, {
    geom: cylinder({ radiusTop: 1.06, radiusBottom: 1.04, height: 0.3, segments: 48 }),
    material: "carne",
    position: [0, 0.57, 0],
  })

  // Queso: cuadrado girado, con las puntas cayendo por los lados.
  addPart(groups, {
    geom: box({ width: 1.95, height: 0.055, depth: 1.95 }),
    material: "queso",
    position: [0, 0.73, 0],
    rotation: { axis: "y", degrees: 24 },
  })

  // Tomate y lechuga.
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.96, radiusBottom: 0.96, height: 0.11, segments: 40 }),
    material: "tomate",
    position: [0, 0.81, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 1.12, radiusBottom: 1.0, height: 0.1, segments: 44 }),
    material: "lechuga",
    position: [0, 0.91, 0],
  })

  // Aros de cebolla asomando (tres arcos finos).
  for (let i = 0; i < 3; i += 1) {
    addPart(groups, {
      geom: cylinder({
        radiusTop: 0.62,
        radiusBottom: 0.62,
        height: 0.045,
        segments: 30,
        capTop: false,
        capBottom: false,
      }),
      material: "cebolla",
      position: [(i - 1) * 0.34, 0.98, (i - 1) * 0.16],
      scale: [1.25, 1, 1.25],
    })
  }

  // Pan de arriba: media esfera achatada.
  addPart(groups, {
    geom: sphere({ radius: 1.03, thetaLength: Math.PI / 2, widthSegments: 48, heightSegments: 18 }),
    material: "panDorado",
    position: [0, 1.02, 0],
    scale: [1, 0.72, 1],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 1.03, radiusBottom: 1.0, height: 0.12, segments: 48, capTop: false }),
    material: "panDorado",
    position: [0, 1.02, 0],
  })

  // Ajonjolí: granos repartidos sobre la cúpula (posición con semilla fija).
  for (let i = 0; i < 22; i += 1) {
    const theta = random() * 0.95
    const phi = random() * Math.PI * 2
    const r = 1.02
    addPart(groups, {
      geom: sphere({ radius: 0.055, widthSegments: 10, heightSegments: 7 }),
      material: "ajonjoli",
      position: [
        r * Math.sin(theta) * Math.cos(phi),
        1.02 + r * Math.cos(theta) * 0.72,
        r * Math.sin(theta) * Math.sin(phi),
      ],
      scale: [1.5, 0.7, 1],
      rotation: { axis: "y", degrees: (phi / DEG) % 360 },
    })
  }

  // Hamburguesa real: unos 11 cm de alto con el pan.
  fitToRealSize(groups, 0.11)
  return groups
}

function buildPapas() {
  const groups = new Map()
  const random = makeRandom(77712)

  // Cartón: prisma de 4 lados abierto arriba (cilindro de 4 segmentos).
  addPart(groups, {
    geom: cylinder({
      radiusTop: 0.85,
      radiusBottom: 0.55,
      height: 1.5,
      segments: 4,
      capTop: false,
    }),
    material: "cartonRojo",
    position: [0, 0.75, 0],
    rotation: { axis: "y", degrees: 45 },
  })

  // Papas asomando, cada una con su inclinación (semilla fija).
  for (let i = 0; i < 16; i += 1) {
    const lean = (random() - 0.5) * 26
    const height = 1.5 + random() * 0.8
    addPart(groups, {
      geom: box({ width: 0.11, height, depth: 0.11 }),
      material: "papa",
      position: [
        (random() - 0.5) * 0.9,
        1.1 + height / 2 - 0.35,
        (random() - 0.5) * 0.9,
      ],
      rotation: { axis: random() > 0.5 ? "x" : "z", degrees: lean },
    })
  }

  // Ración de papas: unos 16 cm de alto contando las que se asoman.
  fitToRealSize(groups, 0.16)
  return groups
}

function buildRefresco() {
  const groups = new Map()

  addPart(groups, {
    geom: cylinder({ radiusTop: 0.78, radiusBottom: 0.58, height: 1.9, segments: 44 }),
    material: "vaso",
    position: [0, 0.95, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.83, radiusBottom: 0.83, height: 0.14, segments: 44 }),
    material: "tapaRoja",
    position: [0, 1.94, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.3, radiusBottom: 0.3, height: 0.08, segments: 30 }),
    material: "tapaRoja",
    position: [0, 2.03, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.075, radiusBottom: 0.075, height: 1.3, segments: 18 }),
    material: "pitillo",
    position: [0.12, 2.5, 0.05],
    rotation: { axis: "z", degrees: -11 },
  })

  // Vaso mediano: unos 18 cm con el pitillo asomando.
  fitToRealSize(groups, 0.18)
  return groups
}

function buildLata() {
  const groups = new Map()

  // Lata de 355 ml: 6,6 cm de diámetro por 12,3 de alto.
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.33, radiusBottom: 0.33, height: 1, segments: 48, capTop: false }),
    material: "lata",
    position: [0, 0.58, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.265, radiusBottom: 0.33, height: 0.1, segments: 48, capTop: false }),
    material: "lata",
    position: [0, 1.13, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.33, radiusBottom: 0.285, height: 0.08, segments: 48, capTop: false }),
    material: "lata",
    position: [0, 0.04, 0],
  })
  addPart(groups, {
    geom: cylinder({ radiusTop: 0.275, radiusBottom: 0.265, height: 0.035, segments: 48 }),
    material: "aluminio",
    position: [0, 1.2, 0],
  })
  // Anilla.
  addPart(groups, {
    geom: cylinder({
      radiusTop: 0.075,
      radiusBottom: 0.075,
      height: 0.012,
      segments: 20,
      capTop: false,
      capBottom: false,
    }),
    material: "aluminio",
    position: [0.09, 1.225, 0],
    scale: [1, 1, 1.5],
  })

  fitToRealSize(groups, 0.123)
  return groups
}

// --------------------------------------------------------------------- main

const MODELOS = [
  { nombre: "hamburguesa", prim: "Hamburguesa", build: buildHamburguesa },
  { nombre: "papas", prim: "Papas", build: buildPapas },
  { nombre: "refresco", prim: "Refresco", build: buildRefresco },
  { nombre: "lata", prim: "Lata", build: buildLata },
]

mkdirSync(OUT_DIR, { recursive: true })

for (const modelo of MODELOS) {
  const groups = modelo.build()

  const glb = buildGlb(groups, MATERIALS)
  writeFileSync(resolve(OUT_DIR, `${modelo.nombre}.glb`), glb)

  const usda = buildUsda(groups, MATERIALS, modelo.prim)
  const usdz = buildUsdz([{ name: `${modelo.nombre}.usda`, data: usda }])
  writeFileSync(resolve(OUT_DIR, `${modelo.nombre}.usdz`), usdz)

  let triangles = 0
  for (const group of groups.values()) triangles += group.indices.length / 3

  console.log(
    modelo.nombre.padEnd(14),
    `glb ${(glb.length / 1024).toFixed(0)} KB`.padStart(11),
    `usdz ${(usdz.length / 1024).toFixed(0)} KB`.padStart(13),
    `${triangles.toLocaleString("es")} triángulos`.padStart(20),
    `${groups.size} materiales`,
  )
}

console.log(`\nListo en ${OUT_DIR}`)
