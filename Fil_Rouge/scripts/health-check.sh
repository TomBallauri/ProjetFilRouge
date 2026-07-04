#!/usr/bin/env bash
# Post-deployment smoke test: verifies that a running environment
# (local, ou déployé sur Render/Vercel) répond correctement sur ses
# points d'entrée publics, sans nécessiter d'authentification.
#
# Usage:
#   ./scripts/health-check.sh https://projetfilrouge.onrender.com
#   ./scripts/health-check.sh http://localhost:3000
set -uo pipefail

BASE_URL="${1:-http://localhost:3000}"
FAILURES=0

check() {
  local method="$1" path="$2" expected="$3"
  local url="${BASE_URL}${path}"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" "$url")
  if [ "$code" = "$expected" ]; then
    printf '  [OK]   %-6s %-40s -> %s\n' "$method" "$path" "$code"
  else
    printf '  [FAIL] %-6s %-40s -> %s (attendu %s)\n' "$method" "$path" "$code" "$expected"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "Vérification de l'environnement : $BASE_URL"
echo "---"
check GET  "/api/challenges"   200
check GET  "/api/leaderboard"  200
check GET  "/api/cosmetics"    200
check GET  "/api/users/me"     401   # doit refuser sans token — vérifie que l'auth est bien active
check POST "/api/auth/login"   400   # doit rejeter un corps vide plutôt que planter (500)

echo "---"
if [ "$FAILURES" -eq 0 ]; then
  echo "Environnement conforme : tous les points de contrôle répondent comme attendu."
  exit 0
else
  echo "$FAILURES point(s) de contrôle en échec."
  exit 1
fi
