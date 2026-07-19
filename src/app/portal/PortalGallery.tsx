"use client"

import { useState } from "react"

type Item = { id: string; url: string; caption: string }

export default function PortalGallery({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!items.length) return null

  const show = (i: number) => setOpen(((i % items.length) + items.length) % items.length)

  return (
    <section id="galeria" style={{ background: "#fff", padding: "48px 0" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px" }}>
        <h2 style={{ fontSize: 27, fontWeight: 800, textAlign: "center", margin: "0 0 6px" }}>Galería</h2>
        <p style={{ textAlign: "center", color: "#5b6b82", margin: "0 0 28px" }}>Conoce los espacios y apartamentos.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
          {items.map((it, i) => (
            <button key={it.id} onClick={() => setOpen(i)} style={{ padding: 0, border: 0, borderRadius: 14, overflow: "hidden", cursor: "pointer", background: "#eef1f6", position: "relative", aspectRatio: "4 / 3" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.url} alt={it.caption} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {it.caption && (
                <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "linear-gradient(0deg,rgba(10,26,48,.7),transparent)", color: "#fff", fontSize: 13, fontWeight: 600, textAlign: "left", padding: "18px 12px 8px" }}>{it.caption}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {open !== null && (
        <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, background: "rgba(6,15,28,.92)", zIndex: 100, display: "grid", placeItems: "center", padding: 20 }}>
          <button onClick={(e) => { e.stopPropagation(); show(open - 1) }} style={navArrow("left")}>‹</button>
          <figure style={{ margin: 0, maxWidth: 1000, maxHeight: "88vh", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={items[open].url} alt={items[open].caption} style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 12, display: "block", margin: "0 auto" }} />
            {items[open].caption && <figcaption style={{ color: "#dbe6f5", marginTop: 10, fontSize: 15 }}>{items[open].caption}</figcaption>}
          </figure>
          <button onClick={(e) => { e.stopPropagation(); show(open + 1) }} style={navArrow("right")}>›</button>
          <button onClick={() => setOpen(null)} style={{ position: "fixed", top: 18, right: 22, background: "rgba(255,255,255,.15)", color: "#fff", border: 0, borderRadius: 999, width: 40, height: 40, fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
      )}
    </section>
  )
}

function navArrow(side: "left" | "right"): React.CSSProperties {
  return { position: "fixed", [side]: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,.15)", color: "#fff", border: 0, borderRadius: 999, width: 48, height: 48, fontSize: 30, cursor: "pointer", lineHeight: 1 }
}
