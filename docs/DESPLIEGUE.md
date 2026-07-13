# Runbook de despliegue

Cómo publicar cada marca, cómo revertir, y cómo automatizar el deploy de Brotherhood. Contexto general en [`TRASPASO-TECNICO.md`](TRASPASO-TECNICO.md) §8.

## Antes de cualquier deploy (checklist)

1. `git status` limpio y en la rama correcta.
2. **Aplicar migraciones pendientes** en el SQL Editor de Supabase del proyecto de esa marca (archivos nuevos en `supabase/migrations/`). Son idempotentes.
3. Verificar en local (o confiar en el CI verde):
   ```bash
   npm run lint && npx tsc --noEmit && npm test && npm run build
   ```

## Santo Perrito (rama `main`)

Deploy por git en Vercel: al hacer `git push origin main`, Vercel publica. (Confirmar en Vercel → Project → Settings → Git que el auto-deploy de `main` está activo.)

Si necesitas forzarlo manual desde la carpeta enlazada al proyecto de Santo Perrito:
```bash
npx vercel --prod
```

## Brotherhood (rama `brotherhood-publico`) — MANUAL

Brotherhood **no** se publica al hacer push. Desde la carpeta enlazada al proyecto Vercel `brotherhood`:
```bash
cd "D:/Santo edit"
git checkout brotherhood-publico   # asegúrate de estar en la rama publicada
npx vercel --prod
```
El deploy sube los **archivos en disco** de esa carpeta (no una rama remota): confirma que estás en `brotherhood-publico` y con los últimos commits.

## Revertir (rollback)

- **Rápido, sin código:** Vercel → Deployments → busca el deployment bueno anterior → `⋯` → **Promote to Production**.
- **Por código:** `git revert <commit>` y volver a desplegar. (Evita `reset --hard` en ramas publicadas.)
- **Si el problema es de datos/migración:** restaurar respaldo (`npm run restore`) o revertir la migración con un `.sql` inverso. Ten un backup reciente (`npm run backup`) antes de migraciones grandes.

## Automatizar el deploy de Brotherhood (opcional, recomendado)

Para dejar de depender del `npx vercel --prod` manual, hay un workflow **manual-dispatch** en [`.github/workflows/deploy-brotherhood.yml`](../.github/workflows/deploy-brotherhood.yml): se dispara a mano desde GitHub → Actions → *Deploy Brotherhood* → **Run workflow**. No publica solo en cada push (evita sorpresas); solo cuando tú lo lanzas.

**Requiere** configurar estos *secrets* del repo (Settings → Secrets and variables → Actions), tomados del proyecto Vercel de Brotherhood:

| Secret | De dónde sale |
|---|---|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` (`orgId`) del proyecto Brotherhood |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` (`projectId`) del proyecto Brotherhood |

Mientras no cargues los secrets, el workflow existe pero no hace nada (no se dispara solo). Sigue valiendo el flujo manual de arriba.

> Recordatorio: aunque el deploy se automatice, **las migraciones de Supabase siguen siendo manuales** hasta que se automaticen (ver roadmap en el traspaso técnico).
