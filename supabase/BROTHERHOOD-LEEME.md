# Brotherhood — Fase 3: su propia base de datos (Supabase)

Objetivo: darle a **Brotherhood** una base de datos **independiente** de Santo Perrito.
Al terminar, la app mostrará la marca Brotherhood de verdad (nombre, colores, menú
vacío listo para cargar) y nada se comparte con Santo Perrito.

---

## Paso 1 — Crear el proyecto en Supabase (lo haces tú)

1. Entra a **https://supabase.com** e inicia sesión (o crea cuenta gratis).
2. **New project**. Nómbralo, por ejemplo, `brotherhood`.
3. Elige una contraseña de base de datos (guárdala) y la región más cercana.
4. Espera ~2 min a que termine de crearse.

## Paso 2 — Crear el esquema (lo haces tú, 1 solo pegado)

1. En el proyecto nuevo: menú lateral **SQL Editor** → **New query**.
2. Abre el archivo **`supabase/BROTHERHOOD-SETUP.sql`** de este repo, copia **TODO** y pégalo.
3. Pulsa **Run**. Debe decir *Success*. (Trae las 20 migraciones en orden; es idempotente.)
4. Verifica en **Table Editor** que aparecen tablas como `orders`, `tables`,
   `business_config`, `menu_products`. La tabla `tables` debe tener 6 filas y
   `business_config` **una fila con config vacía** (eso hace que salga la marca Brotherhood).

## Paso 3 — Conectar la app a esa base (lo haces tú; NO me pegues las claves en el chat)

En **Project Settings → API** copia estos 3 valores y ponlos en el archivo
`.env.local` de este worktree:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # "anon public"
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # "service_role" (secreta)
```

Y define las contraseñas de acceso del personal (invéntalas tú; son las que usarán
para entrar a cada rol). Mínimo la de admin y owner:

```env
ORDERS_API_SECRET=algo-largo-y-aleatorio
ORDERS_ADMIN_PASSWORD=...
ORDERS_OWNER_PASSWORD=...
ORDERS_MANAGER_PASSWORD=...
ORDERS_CASHIER_PASSWORD=...
ORDERS_KITCHEN_PASSWORD=...
ORDERS_DELIVERY_PASSWORD=...
ORDERS_SUPPORT_PASSWORD=...
```

> Puedes copiar el formato desde `.env.example`. `GOOGLE_SHEETS_WEB_APP_URL` es opcional.

## Paso 4 — Avísame

Cuando `.env.local` tenga las claves del proyecto **de Brotherhood**, dime y arranco
el servidor: ahí ya veremos Brotherhood con su marca y su menú vacío, y seguimos con
el rediseño (Fase 2).

---

### ¿Por qué esto separa de verdad los dos negocios?

La app lee el nombre, colores, logo y menú desde la **base de datos**. Mientras
apuntara a la base de Santo Perrito, mostraba Santo Perrito aunque el código dijera
Brotherhood. Con su propia base (config vacía), gana el default del código = Brotherhood.
