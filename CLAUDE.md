# Instrucciones del proyecto

## Protocolo Open/Close (guía maestra)

Existe `GUIA-MAESTRA.md` en la raíz (untracked a propósito: contiene
información de todos los clientes): el mapa vivo de TODOS los proyectos,
con estado, pendientes, bitácora y el punto de retorno de la última sesión.

- **Si el mensaje del usuario empieza con `Open`** (p. ej. "Open brotherhood"):
  LEER `GUIA-MAESTRA.md` ANTES de tocar nada — como mínimo la sección
  "👉 PRÓXIMA SESIÓN", la sección del proyecto nombrado y la última entrada
  de la bitácora — y arrancar por los pendientes que ahí se indican.
- **Si el usuario escribe `Close`**: ACTUALIZAR y guardar `GUIA-MAESTRA.md`
  antes de terminar — sección del proyecto tocado, entrada de bitácora con
  fecha (qué se modificó Y qué memorias se actualizaron), y reescribir
  "👉 PRÓXIMA SESIÓN" con el punto de retorno exacto.
- Si nace un proyecto nuevo, agregarlo ese mismo día al inventario de la guía.

## Reglas vitales (el detalle vive en la guía maestra)

- Brotherhood es un CLIENTE REAL en producción (brotherhood-xi.vercel.app).
  **Nunca tocar producción de 5 p.m. en adelante** (el local abre a las 6);
  las baterías QA que crean pedidos de prueba solo van por la mañana.
- Verificación estándar: `npx tsc --noEmit` + `npm test` + `npm run build`
  (el navegador local se cuelga). ⚠️ `.env.local` apunta al Supabase de
  PRODUCCIÓN de Brotherhood.
- ⚠️ `.vercelignore` es sagrado: sin él, el deploy sube 18 GB con el código
  y los `.env` de los demás clientes.
- Las migraciones SQL las aplica el usuario en Supabase; aquí solo se
  escriben los `.sql` (atajo: `supabase/BROTHERHOOD-SETUP.sql`, idempotente).
- Los deploys son manuales: `npx vercel --prod --yes`. Git no publica nada.
