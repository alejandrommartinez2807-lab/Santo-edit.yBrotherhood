"use client"

import { useRef, useState } from "react"

type ApiFn = (path: string, init?: RequestInit) => Promise<Record<string, unknown>>

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ""))
    r.onerror = () => reject(new Error("No se pudo leer el archivo"))
    r.readAsDataURL(file)
  })
}

// Sube un archivo por el endpoint dado (con la auth que inyecte `api`) y devuelve la URL.
export async function uploadImageFile(api: ApiFn, endpoint: string, folder: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen")
  if (file.size > 6_000_000) throw new Error("La imagen es muy pesada (máx. 6 MB)")
  const dataUrl = await readAsDataURL(file)
  const d = await api(endpoint, { method: "POST", body: JSON.stringify({ dataUrl, folder, name: file.name.replace(/\.[^.]+$/, "") }) })
  const url = String(d.url || "")
  if (!url) throw new Error("No se recibió el enlace de la imagen")
  return url
}

// Campo de imagen: sube un archivo o pega una URL, con vista previa.
export default function ImageField({
  value,
  onChange,
  api,
  endpoint,
  folder,
  round,
}: {
  value: string
  onChange: (url: string) => void
  api: ApiFn
  endpoint: string
  folder: string
  round?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setErr("")
    try {
      const url = await uploadImageFile(api, endpoint, folder, file)
      onChange(url)
    } catch (e) { setErr(String((e as Error).message)) } finally { setBusy(false); if (fileRef.current) fileRef.current.value = "" }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div
          style={{
            width: 54, height: 54, flexShrink: 0, borderRadius: round ? 999 : 10, border: "1px solid #d5deeb",
            background: value ? `#fff url("${value.replace(/"/g, "")}") center/cover no-repeat` : "#f2f6fc",
            display: "grid", placeItems: "center", color: "#98a6ba", fontSize: 20, overflow: "hidden",
          }}
        >
          {!value && "🖼️"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Pega una URL o sube una imagen"
            style={{ width: "100%", padding: "9px 11px", borderRadius: 10, border: "1px solid #d5deeb", fontSize: 14, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} style={{ border: 0, background: "#eef3fb", color: "#16324f", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {busy ? "Subiendo…" : "⬆︎ Subir imagen"}
            </button>
            {value && (
              <button type="button" onClick={() => onChange("")} style={{ border: 0, background: "transparent", color: "#c0392b", fontSize: 13, cursor: "pointer" }}>Quitar</button>
            )}
          </div>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />
      {err && <div style={{ color: "#c0392b", fontSize: 12, marginTop: 6 }}>{err}</div>}
    </div>
  )
}
