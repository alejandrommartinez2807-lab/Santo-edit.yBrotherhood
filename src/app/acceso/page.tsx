"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LogIn, LogOut, Loader2, ShieldCheck } from "lucide-react"
import { getSupabaseBrowser } from "@/lib/supabaseBrowser"
import { BRAND } from "@/lib/brand"

export default function AccesoPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseBrowser()
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user?.email ?? null)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessionEmail(session?.user?.email ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        setError("Correo o contraseña incorrectos.")
        return
      }
      router.push("/local-santo")
    } catch {
      setError("No se pudo iniciar sesión. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await getSupabaseBrowser().auth.signOut()
    setSessionEmail(null)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--brand-cream)] px-4 py-10 text-[var(--brand-ink-2)]">
      <section className="w-full max-w-md rounded-[2rem] border-4 border-[var(--brand-primary)] bg-white p-6 shadow-[0_12px_0_rgba(var(--brand-primary-rgb),0.12)] sm:p-8">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-primary)]">
            <ShieldCheck size={28} />
          </span>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            Acceso del personal
          </p>
          <h1 className="mt-1 text-2xl font-black uppercase text-[var(--brand-ink-3)]">
            {BRAND.name}
          </h1>
        </div>

        {checking ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="animate-spin text-[var(--brand-primary)]" size={24} />
          </div>
        ) : sessionEmail ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-2xl border-2 border-emerald-600/25 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
              Sesión iniciada como <strong>{sessionEmail}</strong>
            </p>
            <button
              onClick={() => router.push("/local-santo")}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)]"
            >
              Entrar al panel
            </button>
            <button
              onClick={() => router.push("/local-santo/usuarios")}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)]/40 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
            >
              Gestionar usuarios
            </button>
            <button
              onClick={() => router.push("/local-santo/reportes")}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)]/40 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
            >
              Ver reportes
            </button>
            <button
              onClick={() => router.push("/local-santo/sucursales")}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)]/40 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
            >
              Gestionar sucursales
            </button>
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-primary)]"
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                Correo
              </label>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-primary)]">
                Contraseña
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full rounded-2xl border-2 border-[var(--brand-primary)]/25 bg-white px-4 py-3 text-base font-bold text-[var(--brand-ink)] outline-none focus:border-[var(--brand-primary)]"
              />
            </div>

            {error ? (
              <p className="text-sm font-bold text-red-700">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brand-primary)] bg-[var(--brand-accent)] px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-[var(--brand-ink)] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <LogIn size={18} />
              )}
              {loading ? "Entrando…" : "Iniciar sesión"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-[0.7rem] font-bold text-[var(--brand-ink-2)]/55">
          ¿Olvidaste tu clave? Pídele al dueño que la restablezca.
        </p>
      </section>
    </main>
  )
}
