#!/usr/bin/env bash
# Bootstraps a full local development environment for ChallengeHub
# (frontend + backend + database schema), from a fresh clone.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31mErreur:\033[0m %s\n' "$1" >&2; exit 1; }

# 1. Node version check
log "Vérification de la version de Node.js"
command -v node >/dev/null 2>&1 || fail "Node.js n'est pas installé."
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Node.js >= 18 requis (version détectée : $(node -v))."
fi
echo "Node.js $(node -v) OK"

# 2. Backend .env check (never overwrite an existing one)
log "Vérification du fichier backend/.env"
ENV_FILE="$BACKEND_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'EOF'
DATABASE_URL="postgresql://user:password@localhost:5432/challengehub?schema=public"
JWT_SECRET="change-me-in-local-dev"
GROQ_API_KEY=""
EOF
  echo "backend/.env créé avec des valeurs par défaut à compléter (DATABASE_URL, GROQ_API_KEY)."
else
  echo "backend/.env déjà présent, non modifié."
fi

# 3. Install dependencies
log "Installation des dépendances frontend"
(cd "$ROOT_DIR" && npm install)

log "Installation des dépendances backend"
(cd "$BACKEND_DIR" && npm install)

# 4. Prisma: generate client + apply migrations
log "Génération du client Prisma"
(cd "$BACKEND_DIR" && npx prisma generate)

log "Application des migrations sur la base cible (DATABASE_URL)"
(cd "$BACKEND_DIR" && npx prisma migrate deploy)

# 5. Seed
log "Peuplement initial de la base (défis par défaut, cosmétiques)"
(cd "$BACKEND_DIR" && npm run seed)

log "Environnement prêt."
echo "Backend  : cd backend && node index.js"
echo "Frontend : npm run dev"
