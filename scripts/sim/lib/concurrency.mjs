// Carreras reales: se disparan en paralelo de verdad (Promise.all sobre
// fetches ya construidos), no llamadas secuenciales rápidas.
export async function race(fns) {
  return Promise.all(fns.map((fn) => fn()))
}

// Clasifica los resultados de una carrera donde SOLO UNO debía ganar.
export function raceOutcome(results, isWin) {
  const winners = results.filter(isWin)
  const losers = results.filter((r) => !isWin(r))
  return { winners, losers, oneWinner: winners.length === 1 }
}
