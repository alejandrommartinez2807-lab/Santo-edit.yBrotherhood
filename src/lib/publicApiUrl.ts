"use client"

import { getSelectedBranchId } from "@/lib/branchClient"

/**
 * Añade la sede elegida a la URL de una ruta pública de lectura.
 *
 * AuthBridge ya manda la sede en la cabecera `x-branch-id`, y con eso al
 * servidor le basta. Pero el CDN construye su clave de caché solo con la URL,
 * así que una sede que viaja únicamente en cabecera obliga a responder
 * `no-store` para no servirle a un cliente la configuración de otra sede.
 *
 * Poniéndola también en la query, la URL identifica la respuesta y el borde
 * puede cachear por sede sin riesgo de mezcla. Ver `publicCacheHeaders`.
 */
export function publicApiUrl(path: string): string {
  const branchId = getSelectedBranchId()

  if (!branchId) return path

  const separator = path.includes("?") ? "&" : "?"

  return `${path}${separator}branch=${encodeURIComponent(branchId)}`
}
