// <model-viewer> es un web component de Google: no existe en JSX.IntrinsicElements
// y sin esta declaración TypeScript lo rechaza. Se declaran solo los atributos
// que usa la carta pública (src, ios-src, ar, poster…), no la API completa.
import type { DetailedHTMLProps, HTMLAttributes } from "react"

type ModelViewerAttributes = {
  src?: string
  "ios-src"?: string
  alt?: string
  poster?: string
  ar?: boolean
  "ar-modes"?: string
  "ar-scale"?: string
  "ar-placement"?: string
  "camera-controls"?: boolean
  "auto-rotate"?: boolean
  "rotation-per-second"?: string
  "touch-action"?: string
  "shadow-intensity"?: string
  "environment-image"?: string
  exposure?: string
  reveal?: string
  loading?: "auto" | "lazy" | "eager"
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & ModelViewerAttributes,
        HTMLElement
      >
    }
  }
}
