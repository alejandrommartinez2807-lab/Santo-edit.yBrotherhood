# Separación Brotherhood ↔ Santo Perrito

Dos negocios distintos que comparten plantilla. Mapa de qué es de quién y
reglas para no volver a mezclarlos (11 jul 2026).

## Mapa de infraestructura

| Pieza | Brotherhood (activo, este repo) | Santo Perrito (congelado, NO tocar) |
|---|---|---|
| Sitio público | `brotherhood-xi.vercel.app` | `santo-edit.vercel.app` |
| Proyecto Vercel | `brotherhood` (`prj_xwIyKAyeuMulJocnZZw8QxoskHRe`) | `santo-edit` (`prj_WvNMmrUn1cDbioXLw0WGusO3M2tD`) |
| Supabase | `fpujezdaauedjvnhjzws.supabase.co` | `ocwplizdueirdjjuruix.supabase.co` |
| Código | Este repo (GitHub `alejandrommartinez2807-lab/Santo-edit.yBrotherhood`, rama `main`) | El deploy vigente del 3 jul 2026 (`santo-edit-rat88bwop`); su código equivale a la historia de este repo ANTES del rebrand |
| Deploys | Automático al hacer push a `main` (o `vercel --prod` desde este directorio) | **Ninguno.** El proyecto quedó sin conexión git a propósito |

## Qué pasó (para no repetirlo)

Al instalar la app de GitHub de Claude se creó el repo
`Santo-edit.yBrotherhood` y quedó conectado a **los dos** proyectos de
Vercel con rama de producción `main`. Cada push intentaba desplegar el
código Brotherhood también encima de Santo Perrito (se salvó porque esos
builds fallaban: el repo solo tenía un workflow). El 11 jul 2026 se
desconectó el repo del proyecto `santo-edit` y se publicó aquí el
historial completo.

Además, la BD de Brotherhood nació como copia de la de Santo Perrito:
los textos y colores del negocio en `business_config` traían la marca
vieja. Ya se limpiaron (textos Brotherhood + paleta negro/naranja del
código); los datos operativos (menú, pedidos, sedes) siempre fueron
independientes por ser proyectos Supabase distintos.

## Reglas

1. **Nunca** volver a conectar un repo git al proyecto Vercel `santo-edit`.
   Si Santo Perrito necesita cambios, se trabaja en una copia aparte del
   template con su propio repo (patrón Karma/Pecado), no desde este.
2. Los deploys desde este directorio van SIEMPRE a `brotherhood` (el
   enlace vive en `.vercel/project.json`; hay un backup del enlace viejo
   en `.vercel-santoperrito-backup/`, no restaurarlo).
3. `.env.local` apunta a la Supabase de Brotherhood; el backup
   `.env.local.bak-santoperrito` apunta a la vieja. No intercambiarlos.
4. La Supabase vieja tiene una tabla `push_subscriptions` creada por
   error (migración 0023 corrida en el proyecto equivocado). Es inofensiva;
   se puede eliminar con `drop table public.push_subscriptions;` desde su
   SQL Editor si se quiere dejar impecable.
