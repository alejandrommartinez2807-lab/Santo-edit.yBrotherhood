#!/usr/bin/env bash
# Sube TODAS las variables de .env.local al proyecto Vercel del hotel (entorno production).
# Correr DESDE el worktree del hotel, DESPUES de 'vercel link' (necesita .vercel/).
# Uso:  bash deploy-hotel-env.sh
set -u
SCOPE="carlos-projects8"
ENVFILE=".env.local"

if [ ! -d ".vercel" ]; then
  echo "ERROR: no hay .vercel/ aqui. Corre primero 'vercel link' en este worktree." >&2
  exit 1
fi

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|\#*) continue;; esac
  key="${line%%=*}"
  val="${line#*=}"
  # Quitar comillas envolventes (dotenv las ignora, pero Vercel las guardaria literales)
  case "$val" in
    \"*\") val="${val#\"}"; val="${val%\"}" ;;
    \'*\') val="${val#\'}"; val="${val%\'}" ;;
  esac
  [ -z "$val" ] && { echo "-- salto $key (vacio)"; continue; }
  echo "-> $key"
  printf '%s' "$val" | npx vercel env add "$key" production --force --scope "$SCOPE" >/dev/null 2>&1 \
    && echo "   OK" || echo "   FALLO (revisar)"
done < "$ENVFILE"

echo "Listo. Variables cargadas en production."
