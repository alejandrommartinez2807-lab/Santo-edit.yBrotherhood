// Cálculo de tarifa de estacionamiento (puro, compartido por panel y público).
export type ParkingConfig = {
  free_minutes: number
  rate_per_hour: number
  daily_cap: number
  rate_currency?: string
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// Devuelve minutos transcurridos y monto a cobrar a un instante dado.
export function computeParkingFee(enteredAtIso: string, atMs: number, cfg: ParkingConfig): { minutes: number; amount: number } {
  const start = new Date(enteredAtIso).getTime()
  if (!Number.isFinite(start)) return { minutes: 0, amount: 0 }
  const minutes = Math.max(0, Math.floor((atMs - start) / 60000))
  const billable = Math.max(0, minutes - (cfg.free_minutes || 0))
  const hours = Math.ceil(billable / 60) // se cobra por hora o fracción
  let amount = round2(hours * (cfg.rate_per_hour || 0))
  if (cfg.daily_cap && cfg.daily_cap > 0) {
    const days = Math.max(1, Math.ceil(minutes / (60 * 24)))
    amount = Math.min(amount, round2(cfg.daily_cap * days))
  }
  return { minutes, amount }
}
