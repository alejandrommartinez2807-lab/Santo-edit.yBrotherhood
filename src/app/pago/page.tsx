import { redirect } from "next/navigation"

// /pago no tiene contenido propio: la pasarela regresa a /pago/exito o
// /pago/cancelado. Si alguien entra a /pago a mano, lo llevamos a la portada.
export default function PagoPage() {
  redirect("/")
}
