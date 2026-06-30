# Migraciones de Supabase — Santo Edit

> ⚠️ **MUY IMPORTANTE.** En el proyecto Karma el problema de "no guarda" NO era el
> código: eran **migraciones de Supabase sin aplicar**. Aquí pasa lo mismo: si no
> aplicas estos SQL en tu proyecto de Supabase, la app de la Fase 1 en adelante
> **no podrá guardar nada**. Aplícalas antes de probar.

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `migrations/0001_initial_schema.sql` | Crea todas las tablas, tipos y RLS (cerrado por defecto). |
| `migrations/0002_seed_defaults.sql` | Mete las 6 mesas por defecto y la fila de configuración. |

## Cómo aplicarlas (la forma fácil, sin instalar nada)

1. Entra a tu proyecto en **https://supabase.com** → menú lateral **SQL Editor**.
2. Abre `0001_initial_schema.sql`, copia **todo** el contenido y pégalo en el editor.
3. Pulsa **Run**. Debe decir *Success*.
4. Repite con `0002_seed_defaults.sql`.
5. Comprueba en **Table Editor** que aparecen las tablas (`orders`, `open_accounts`,
   `tables`, etc.) y que `tables` ya tiene 6 filas.

> Son idempotentes: si las corres dos veces no rompen nada ni duplican datos.

## Qué necesito de ti para la Fase 1

Cuando tengas el proyecto creado, dame estos 3 datos (los encuentras en
**Project Settings → API**). Ponlos tú mismo en `.env.local`; **no me los pegues
en el chat** por seguridad:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # clave pública (anon)
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # clave secreta (service_role) — NUNCA al cliente
```

La `SUPABASE_SERVICE_ROLE_KEY` es la que usarán las API routes del servidor para
leer/escribir saltándose RLS. La `anon` se usará más adelante para el realtime y
el endpoint público del QR.

## Decisiones de diseño (para que sepas por qué está así)

- **Relacional** lo crítico: `orders`, `order_items`, `open_accounts`, `tables`,
  `payment_proofs`. Así hay integridad real y consultas rápidas.
- **JSONB** para lo muy anidado y cambiante: config del menú (`menu_products.config`),
  cierres de caja (`day_closes.summary`), config del negocio (`business_config.config`).
  Es lo pragmático: evita decenas de tablas para datos que la app ya maneja como objeto.
- **Una sola cuenta abierta por mesa**: índice único parcial sobre `open_accounts`
  cuando `status = 'Abierta'`. Esto es la base del flujo QR de la Fase 2: al escanear,
  si la mesa no tiene cuenta abierta se crea; si ya tiene, se reutiliza.
- **RLS activado y cerrado**: nadie lee/escribe desde el cliente todavía. Solo el
  servidor con la service role key. Las políticas públicas (estado de mesa para el QR)
  llegan en la migración de la Fase 2.
