# Seguridad — RLS de `order_branch_counters` + bucket `payment-proofs` privado

> Preparado 2026-07-24 tras la auditoría de la BD Brotherhood
> (`fpujezdaauedjvnhjzws`). Este archivo es una PROPUESTA lista para aplicar:
> nada aquí se ha ejecutado todavía. Aplica en el orden indicado.

Resumen de la auditoría: la BD está bien (todas las tablas sensibles bloquean
a la clave pública `anon`). Dos correcciones:

1. **`order_branch_counters`** quedó sin RLS (leve): la clave pública puede leer
   el correlativo de pedidos por sede. Se corrige con RLS.
2. **Bucket `payment-proofs` es público** (privacidad): los comprobantes de pago
   (capturas de transferencias de clientes) se sirven por URL pública
   permanente. Se pasa el bucket a privado y se sirven con **URLs firmadas**
   de corta duración.

---

## Paso 1 — Migración SQL

Guardar como `supabase/migrations/0032_security_rls_and_private_proofs.sql`
y aplicar con el flujo normal de migraciones.

```sql
-- 0032_security_rls_and_private_proofs.sql
-- Auditoría de seguridad 2026-07-24.

-- (1) order_branch_counters: faltaba RLS. Sin políticas, la clave anon no ve
--     nada; el trigger que asigna el correlativo corre con service role y se
--     salta RLS, así que la operación normal NO se ve afectada.
alter table order_branch_counters enable row level security;

-- (2) Bucket payment-proofs a PRIVADO. Los comprobantes dejan de ser legibles
--     por URL pública; el panel los mostrará con URLs firmadas (Paso 2).
--     menu-images se deja público a propósito (fotos del menú).
update storage.buckets
   set public = false
 where id = 'payment-proofs';
```

> **Rollback**: `alter table order_branch_counters disable row level security;`
> y `update storage.buckets set public = true where id = 'payment-proofs';`

---

## Paso 2 — Código: servir comprobantes con URLs firmadas

Al pasar el bucket a privado, las URLs públicas guardadas en
`payment_proofs.proof_image_url` dejan de abrir (darían 400/403). La solución
**no requiere migrar datos**: ya guardamos la ruta del archivo en
`proof_file_id` (y `proof_file_id_2`), así que regeneramos una URL firmada
fresca cada vez que se leen los comprobantes. El panel no cambia: sigue usando
`proof.proofImageUrl`, solo que ahora ese valor es una URL firmada temporal.

Archivo: **`src/lib/ordersPaymentProofs.ts`**

### 2.1 — Helper de firma (añadir cerca del tope, tras `PAYMENT_PROOFS_BUCKET`)

```ts
// Vigencia de las URLs firmadas de comprobantes. El panel las usa al vuelo
// (ver/abrir la imagen); 1 hora sobra y evita que un link reenviado sirva
// para siempre.
const SIGNED_PROOF_TTL_SECONDS = 60 * 60

// Genera una URL firmada de corta duración para una ruta del bucket privado.
// Si no hay ruta o falla la firma, devuelve "" (el panel muestra "sin imagen").
async function signProofPath(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  path: string,
): Promise<string> {
  const cleanPath = cleanText(path)
  if (!cleanPath) return ""

  const { data, error } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(cleanPath, SIGNED_PROOF_TTL_SECONDS)

  if (error || !data?.signedUrl) return ""
  return data.signedUrl
}
```

### 2.2 — Firmar al leer (dentro de `getPaymentProofs`, reemplazar el `return`)

Antes:

```ts
  return (data ?? []).map((row) => paymentProofRowToProof(row as Record<string, unknown>))
```

Después:

```ts
  const proofs = (data ?? []).map((row) =>
    paymentProofRowToProof(row as Record<string, unknown>),
  )

  // Bucket privado: reemplazamos la URL guardada por una URL firmada fresca,
  // generada desde la ruta del archivo (proofFileId). Cubre comprobantes
  // viejos y nuevos sin migrar datos.
  return Promise.all(
    proofs.map(async (proof) => ({
      ...proof,
      proofImageUrl: proof.proofFileId
        ? await signProofPath(supabase, proof.proofFileId)
        : "",
      proofImageUrl2: proof.proofFileId2
        ? await signProofPath(supabase, proof.proofFileId2)
        : "",
    })),
  )
}
```

> `getPaymentProofs` ya es `async` y sus llamadores hacen `await`, así que
> devolver `Promise.all(...)` no cambia la firma pública.

### 2.3 — Al subir (dentro de `uploadProofImage`)

`getPublicUrl` sobre un bucket privado devuelve una URL que ya no abre. Como el
panel ahora firma al leer, lo que se guarde en `proof_image_url` es solo un
respaldo informativo. Reemplazar:

Antes:

```ts
  const { data: publicData } = supabase.storage.from(PAYMENT_PROOFS_BUCKET).getPublicUrl(path)
  return { url: publicData?.publicUrl || "", fileId: path }
```

Después:

```ts
  // Bucket privado: no hay URL pública estable. Guardamos una URL firmada
  // inicial como respaldo, pero la fuente de verdad para mostrar es la ruta
  // (fileId), que getPaymentProofs vuelve a firmar en cada lectura.
  const signedUrl = await signProofPath(supabase, path)
  return { url: signedUrl, fileId: path }
```

---

## Paso 3 — Verificación

1. `npx tsc --noEmit` y `npx vitest run --dir ./src` (399+ verdes).
2. En el panel de **Comprobantes** (`/local-santo/comprobantes`): abrir un
   comprobante viejo y uno nuevo — la imagen debe verse (URL con `?token=`).
3. Prueba negativa: copiar la URL pública vieja de un comprobante
   (`/storage/v1/object/public/payment-proofs/...`) y abrirla sin sesión →
   ahora debe dar **400/403** (antes daba 200). Una URL firmada
   (`/object/sign/...?token=`) sí abre, y caduca en 1 h.

## Nota para clientes futuros
Los buckets se crean `public:true` al montar la BD (checklist de cliente nuevo).
Aplicar este mismo patrón —`payment-proofs` privado + URLs firmadas— en Karma,
Pecado y cualquier BD nueva. `menu-images` sí puede quedar público.
