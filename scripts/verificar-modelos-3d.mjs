// Verifica los .glb de public/modelos/ SIN navegador (el navegador se cuelga).
// Dos pasadas:
//   1. Estructura del contenedor GLB y del glTF por dentro, a mano.
//   2. Carga real con el GLTFLoader de three.js — el mismo parser que usa
//      <model-viewer> por debajo. Si three lo abre, el visor lo abre.
import { readFileSync, readdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const DIR = resolve(HERE, "..", "public", "modelos")

let failures = 0

function check(condition, message) {
  if (!condition) {
    failures += 1
    console.log(`   ✗ ${message}`)
  }
  return condition
}

function parseGlb(buffer) {
  check(buffer.toString("ascii", 0, 4) === "glTF", "magic glTF")
  check(buffer.readUInt32LE(4) === 2, "versión 2")
  check(buffer.readUInt32LE(8) === buffer.length, "largo declarado = largo real")

  let offset = 12
  let json = null
  let binary = null

  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset)
    const chunkType = buffer.readUInt32LE(offset + 4)
    const data = buffer.subarray(offset + 8, offset + 8 + chunkLength)

    if (chunkType === 0x4e4f534a) json = JSON.parse(data.toString("utf8"))
    if (chunkType === 0x004e4942) binary = data

    check(chunkLength % 4 === 0, "chunk alineado a 4 bytes")
    offset += 8 + chunkLength
  }

  return { json, binary }
}

const COMPONENT_BYTES = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }
const TYPE_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }

function validateGltf(json, binary) {
  check(Boolean(json.asset?.version), "tiene asset.version")
  check(json.buffers?.[0]?.byteLength === binary.length, "buffer declarado = binario real")

  json.accessors.forEach((accessor, index) => {
    const view = json.bufferViews[accessor.bufferView]
    const stride = COMPONENT_BYTES[accessor.componentType] * TYPE_COUNT[accessor.type]

    check(Boolean(view), `accessor ${index} apunta a un bufferView`)
    check(
      accessor.count * stride === view.byteLength,
      `accessor ${index}: count × stride = byteLength del view`,
    )
    check(
      view.byteOffset + view.byteLength <= binary.length,
      `accessor ${index}: el view cabe en el binario`,
    )
    check(view.byteOffset % 4 === 0, `accessor ${index}: view alineado a 4`)
  })

  let triangles = 0
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }

  for (const primitive of json.meshes[0].primitives) {
    const positionAccessor = json.accessors[primitive.attributes.POSITION]
    const normalAccessor = json.accessors[primitive.attributes.NORMAL]
    const indexAccessor = json.accessors[primitive.indices]

    check(Array.isArray(positionAccessor.min), "POSITION trae min/max (lo exige la spec)")
    check(
      positionAccessor.count === normalAccessor.count,
      "hay una normal por vértice",
    )
    check(indexAccessor.count % 3 === 0, "los índices son múltiplo de 3")
    triangles += indexAccessor.count / 3

    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis] = Math.min(bounds.min[axis], positionAccessor.min[axis])
      bounds.max[axis] = Math.max(bounds.max[axis], positionAccessor.max[axis])
    }

    // Índices dentro de rango.
    const indexView = json.bufferViews[indexAccessor.bufferView]
    const indices = new Uint32Array(
      binary.buffer.slice(
        binary.byteOffset + indexView.byteOffset,
        binary.byteOffset + indexView.byteOffset + indexView.byteLength,
      ),
    )
    let maxIndex = 0
    for (const value of indices) if (value > maxIndex) maxIndex = value
    check(
      maxIndex < positionAccessor.count,
      `índice máximo ${maxIndex} < ${positionAccessor.count} vértices`,
    )

    // Normales unitarias (si no, la iluminación sale mal).
    const normalView = json.bufferViews[normalAccessor.bufferView]
    const normals = new Float32Array(
      binary.buffer.slice(
        binary.byteOffset + normalView.byteOffset,
        binary.byteOffset + normalView.byteOffset + normalView.byteLength,
      ),
    )
    let worst = 0
    for (let i = 0; i < normals.length; i += 3) {
      const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2])
      worst = Math.max(worst, Math.abs(length - 1))
    }
    check(worst < 0.001, `normales unitarias (peor desvío ${worst.toFixed(5)})`)
  }

  return { triangles, bounds }
}

async function loadWithThree(path) {
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js")
  const buffer = readFileSync(path)
  const loader = new GLTFLoader()

  return new Promise((resolvePromise, rejectPromise) => {
    loader.parse(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      "",
      (gltf) => {
        let meshes = 0
        gltf.scene.traverse((node) => {
          if (node.isMesh) meshes += 1
        })
        resolvePromise(meshes)
      },
      rejectPromise,
    )
  })
}

// ------------------------------------------------------------------- USDZ
// No hay iPhone acá para abrir AR Quick Look, así que se verifica lo que SÍ se
// puede verificar: que el contenedor cumpla la spec de USDZ (zip sin comprimir,
// datos alineados a 64 bytes, CRC correcto, el USD primero) y que el .usda de
// adentro esté completo y bien balanceado.
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

function validateUsdz(buffer) {
  const eocdSignature = 0x06054b50
  let eocd = -1
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === eocdSignature) {
      eocd = i
      break
    }
  }

  if (!check(eocd >= 0, "tiene fin de directorio central (es un zip)")) return null

  const entryCount = buffer.readUInt16LE(eocd + 10)
  let centralOffset = buffer.readUInt32LE(eocd + 16)
  const entries = []

  for (let i = 0; i < entryCount; i += 1) {
    check(
      buffer.readUInt32LE(centralOffset) === 0x02014b50,
      `entrada ${i}: firma del directorio central`,
    )
    const nameLength = buffer.readUInt16LE(centralOffset + 28)
    const extraLength = buffer.readUInt16LE(centralOffset + 30)
    const commentLength = buffer.readUInt16LE(centralOffset + 32)
    const localOffset = buffer.readUInt32LE(centralOffset + 42)
    const name = buffer.toString("utf8", centralOffset + 46, centralOffset + 46 + nameLength)

    check(
      buffer.readUInt32LE(localOffset) === 0x04034b50,
      `${name}: firma de la cabecera local`,
    )
    check(buffer.readUInt16LE(localOffset + 8) === 0, `${name}: guardado SIN comprimir`)

    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength
    const size = buffer.readUInt32LE(localOffset + 22)
    const data = buffer.subarray(dataOffset, dataOffset + size)

    check(dataOffset % 64 === 0, `${name}: datos alineados a 64 bytes (offset ${dataOffset})`)
    check(
      crc32(data) === buffer.readUInt32LE(localOffset + 14),
      `${name}: CRC32 correcto`,
    )

    entries.push({ name, data })
    centralOffset += 46 + nameLength + extraLength + commentLength
  }

  check(
    /\.usd[ac]?$/.test(entries[0]?.name || ""),
    "el primer archivo del paquete es el USD",
  )

  const usda = entries[0].data.toString("utf8")
  check(usda.startsWith("#usda 1.0"), "el USD declara #usda 1.0")
  check(usda.includes("defaultPrim"), "declara defaultPrim")
  check(usda.includes('upAxis = "Y"'), "declara upAxis Y")
  check(usda.includes("UsdPreviewSurface"), "usa UsdPreviewSurface (lo que lee Quick Look)")

  const open = (usda.match(/\{/g) || []).length
  const close = (usda.match(/\}/g) || []).length
  check(open === close && open > 0, `llaves balanceadas (${open} abren, ${close} cierran)`)

  const meshes = (usda.match(/def Mesh /g) || []).length
  const materials = (usda.match(/def Material /g) || []).length
  check(meshes > 0 && meshes === materials, `${meshes} mallas y ${materials} materiales`)

  // Cada malla tiene que traer sus tres listas completas.
  const points = (usda.match(/point3f\[\] points = \[/g) || []).length
  const normals = (usda.match(/normal3f\[\] normals = \[/g) || []).length
  const faces = (usda.match(/int\[\] faceVertexIndices = \[/g) || []).length
  check(
    points === meshes && normals === meshes && faces === meshes,
    "cada malla trae points, normals y faceVertexIndices",
  )

  return { entries: entries.length, meshes }
}

const files = readdirSync(DIR).filter((name) => name.endsWith(".glb"))

for (const file of files) {
  const path = resolve(DIR, file)
  const buffer = readFileSync(path)
  console.log(`\n${file}  (${(buffer.length / 1024).toFixed(0)} KB)`)

  const before = failures
  const { json, binary } = parseGlb(buffer)
  const { triangles, bounds } = validateGltf(json, binary)

  const size = [0, 1, 2].map((axis) => (bounds.max[axis] - bounds.min[axis]) * 100)
  check(bounds.min[1] > -0.002 && bounds.min[1] < 0.002, "apoyado en y = 0 (para el AR)")
  check(
    Math.max(...size) < 60 && Math.max(...size) > 3,
    `tamaño real creíble sobre una mesa (${size.map((v) => v.toFixed(1)).join(" × ")} cm)`,
  )

  try {
    const meshes = await loadWithThree(path)
    check(meshes > 0, "three.js/GLTFLoader lo abre")
    console.log(
      `   ✓ estructura OK · ${triangles.toLocaleString("es")} triángulos · ${json.materials.length} materiales · ${size.map((v) => v.toFixed(1)).join(" × ")} cm · three.js: ${meshes} malla(s)`,
    )
  } catch (error) {
    failures += 1
    console.log(`   ✗ three.js no lo pudo abrir: ${error?.message || error}`)
  }

  const usdzPath = path.replace(/\.glb$/, ".usdz")
  const usdzBuffer = readFileSync(usdzPath)
  const usdz = validateUsdz(usdzBuffer)
  if (usdz) {
    console.log(
      `   ✓ ${file.replace(/\.glb$/, ".usdz")} (${(usdzBuffer.length / 1024).toFixed(0)} KB) · zip sin comprimir, alineado a 64 · ${usdz.meshes} mallas`,
    )
  }

  if (failures > before) console.log(`   → ${failures - before} problema(s)`)
}

console.log(
  failures === 0
    ? `\n✅ ${files.length} modelos verificados, sin problemas.`
    : `\n❌ ${failures} problema(s).`,
)

process.exit(failures === 0 ? 0 : 1)
