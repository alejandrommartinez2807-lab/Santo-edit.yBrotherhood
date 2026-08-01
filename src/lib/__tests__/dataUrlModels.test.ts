import { describe, expect, it } from "vitest"
import {
  DataUrlModelError,
  assertDataUrlModel,
  decodeDataUrlModel,
  getModelExtension,
  getModelMimeTypeFromFileName,
  parseDataUrlModel,
  sanitizeUploadedModelFileName,
} from "@/lib/dataUrlModels"

function dataUrl(mimeType: string, bytes: number[]) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`
}

// Cabecera real de un glTF binario: magic "glTF" + versión 2 + longitud.
const GLB_BYTES = [
  0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00, 0x0c, 0x00, 0x00, 0x00,
]
// USDZ es un ZIP sin comprimir: empieza con "PK\x03\x04".
const USDZ_BYTES = [0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]

const GLB_DATA_URL = dataUrl("model/gltf-binary", GLB_BYTES)
const USDZ_DATA_URL = dataUrl("model/vnd.usdz+zip", USDZ_BYTES)

describe("dataUrlModels — qué acepta", () => {
  it("acepta un .glb por su MIME", () => {
    expect(parseDataUrlModel(GLB_DATA_URL)?.mimeType).toBe("model/gltf-binary")
  })

  it("acepta un .usdz por su MIME", () => {
    expect(parseDataUrlModel(USDZ_DATA_URL)?.mimeType).toBe("model/vnd.usdz+zip")
  })

  it("acepta un .glb aunque el navegador mande application/octet-stream", () => {
    // Es el caso REAL: casi ningún navegador conoce el MIME de un .glb.
    const parsed = parseDataUrlModel(dataUrl("application/octet-stream", GLB_BYTES), {
      fileName: "hamburguesa-doble.glb",
    })

    expect(parsed?.mimeType).toBe("model/gltf-binary")
  })

  it("acepta un .usdz aunque venga sin MIME", () => {
    const parsed = parseDataUrlModel(dataUrl("", USDZ_BYTES), {
      fileName: "hamburguesa-doble.usdz",
    })

    expect(parsed?.mimeType).toBe("model/vnd.usdz+zip")
  })

  it("deduce el tipo por extensión", () => {
    expect(getModelMimeTypeFromFileName("Plato Del Día.GLB")).toBe("model/gltf-binary")
    expect(getModelMimeTypeFromFileName("plato.usdz")).toBe("model/vnd.usdz+zip")
    expect(getModelMimeTypeFromFileName("plato.png")).toBe("")
  })
})

describe("dataUrlModels — qué rechaza", () => {
  it("rechaza un archivo que no es .glb ni .usdz", () => {
    expect(() =>
      assertDataUrlModel(dataUrl("image/png", GLB_BYTES), { fileName: "plato.png" }),
    ).toThrow(DataUrlModelError)
  })

  it("rechaza una imagen aunque no venga el nombre del archivo", () => {
    expect(() => assertDataUrlModel(dataUrl("image/jpeg", GLB_BYTES))).toThrow(
      /\.glb o \.usdz/,
    )
  })

  it("rechaza la extensión falsa aunque el MIME diga que es un modelo", () => {
    // La extensión manda: nadie sube un modelo llamándolo .svg por accidente.
    expect(() =>
      assertDataUrlModel(GLB_DATA_URL, { fileName: "modelo.svg" }),
    ).toThrow(DataUrlModelError)
  })

  it("rechaza cualquier cosa que no sea un data url base64", () => {
    expect(parseDataUrlModel("https://cdn.com/plato.glb")).toBeNull()
    expect(parseDataUrlModel("")).toBeNull()
    expect(parseDataUrlModel(null)).toBeNull()
  })

  it("rechaza por peso con status 413", () => {
    try {
      assertDataUrlModel(GLB_DATA_URL, { maxBytes: 4 })
      throw new Error("debió rechazar por peso")
    } catch (error) {
      expect(error).toBeInstanceOf(DataUrlModelError)
      expect((error as DataUrlModelError).status).toBe(413)
    }
  })

  it("rechaza un archivo con extensión de modelo pero contenido falso", () => {
    // El bucket es PÚBLICO: sin la firma binaria se podría colar un HTML
    // llamado "plato.glb".
    const fakeGlb = `data:model/gltf-binary;base64,${Buffer.from(
      "<html>no soy un modelo</html>",
    ).toString("base64")}`

    expect(() => decodeDataUrlModel(fakeGlb, { fileName: "plato.glb" })).toThrow(
      /firma glTF/,
    )
  })

  it("rechaza un .usdz que no es un zip", () => {
    const fakeUsdz = `data:model/vnd.usdz+zip;base64,${Buffer.from("nope").toString("base64")}`

    expect(() => decodeDataUrlModel(fakeUsdz, { fileName: "plato.usdz" })).toThrow(
      /USDZ/,
    )
  })
})

describe("dataUrlModels — decodificado y nombre de archivo", () => {
  it("decodifica un .glb válido", () => {
    const decoded = decodeDataUrlModel(GLB_DATA_URL, { fileName: "plato.glb" })

    expect(decoded.mimeType).toBe("model/gltf-binary")
    expect(decoded.buffer.toString("ascii", 0, 4)).toBe("glTF")
  })

  it("decodifica un .usdz válido", () => {
    const decoded = decodeDataUrlModel(USDZ_DATA_URL, { fileName: "plato.usdz" })

    expect(decoded.mimeType).toBe("model/vnd.usdz+zip")
    expect(decoded.buffer.length).toBe(USDZ_BYTES.length)
  })

  it("limpia el nombre del archivo y le pone la extensión correcta", () => {
    expect(
      sanitizeUploadedModelFileName("Hamburguesa Doble ñ.glb", "modelo", "model/gltf-binary"),
    ).toBe("hamburguesa-doble-n.glb")

    expect(sanitizeUploadedModelFileName("", "modelo", "model/vnd.usdz+zip")).toBe(
      "modelo.usdz",
    )
  })

  it("mapea el MIME a su extensión", () => {
    expect(getModelExtension("model/gltf-binary")).toBe("glb")
    expect(getModelExtension("model/vnd.usdz+zip")).toBe("usdz")
  })
})
