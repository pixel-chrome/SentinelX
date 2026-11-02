#!/usr/bin/env bash
# Tests de reprise (CONTRACT.md section 9) : panne/redémarrage d'un service,
# puis vérification de ce qui est perdu ou pas.
#
# Usage : tests/recovery/recovery.sh
# Prérequis : la stack tourne (docker compose up -d), docker, curl, jq.

set -uo pipefail

APP=http://localhost:3000
PROM=http://localhost:9090
CT_SUPPORTDESK=sentinelx-supportdesk-1
CT_WAZUH=sentinelx-wazuh.manager-1

pass=0
fail=0

ok()   { echo "OK   $1"; pass=$((pass+1)); }
ko()   { echo "FAIL $1"; fail=$((fail+1)); }

echo "=== Cas 1 : docker compose stop/start d'un service ==="

code=$(curl -s -o /dev/null -w '%{http_code}' "$APP/login")
[ "$code" = "200" ] && ok "supportdesk répond avant la panne ($code)" || ko "supportdesk ne répond pas avant la panne ($code)"

docker stop "$CT_SUPPORTDESK" >/dev/null

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$APP/login" 2>/dev/null)
[ -z "$code" ] || [ "$code" = "000" ] && ok "supportdesk inatteignable pendant la panne" || ko "supportdesk répond encore pendant l'arrêt ($code)"

sleep 1
echo "--- cible Prometheus pendant la panne ---"
curl -s "$PROM/api/v1/targets" | jq -r '.data.activeTargets[] | select(.labels.job=="supportdesk") | .health'

docker start "$CT_SUPPORTDESK" >/dev/null

echo "=== Cas 2 : perte des sessions (en mémoire) ==="

cookie_jar=$(mktemp)
# attendre que l'appli soit prête après le restart
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$APP/login")
  [ "$code" = "200" ] && break
  sleep 1
done
[ "$code" = "200" ] || ko "supportdesk n'est pas remonté à temps"

curl -s -b "$cookie_jar" -c "$cookie_jar" -o /dev/null \
  --data-urlencode "email=jdupont@supportdesk.local" \
  --data-urlencode "password=User_123" \
  "$APP/login"

code=$(curl -s -o /dev/null -w '%{http_code}' -b "$cookie_jar" "$APP/tickets")
[ "$code" = "200" ] && ok "session valide juste après connexion ($code)" || ko "connexion initiale impossible ($code)"

docker stop "$CT_SUPPORTDESK" >/dev/null
docker start "$CT_SUPPORTDESK" >/dev/null
for i in $(seq 1 15); do
  c=$(curl -s -o /dev/null -w '%{http_code}' "$APP/login")
  [ "$c" = "200" ] && break
  sleep 1
done

code=$(curl -s -o /dev/null -w '%{http_code}' -b "$cookie_jar" "$APP/tickets")
if [ "$code" = "200" ]; then
  ko "la session a survécu au restart ($code), alors qu'elle est en mémoire"
else
  ok "session perdue après restart, redirection/refus ($code)"
fi
rm -f "$cookie_jar"

echo "=== Cas 3 : recréation de la base SQLite (container recréé, pas de volume pour le .db) ==="

before=$(curl -s "$APP/login" -o /dev/null -w '%{http_code}')
docker compose rm -f -s -v supportdesk >/dev/null
docker compose up -d supportdesk >/dev/null

for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$APP/login")
  [ "$code" = "200" ] && break
  sleep 1
done
[ "$code" = "200" ] && ok "supportdesk remonte après recréation du container ($code)" || ko "supportdesk ne remonte pas après recréation ($code)"

cookie_jar=$(mktemp)
curl -s -b "$cookie_jar" -c "$cookie_jar" -o /dev/null \
  --data-urlencode "email=admin@supportdesk.local" \
  --data-urlencode "password=Admin_123" \
  "$APP/login"
code=$(curl -s -o /dev/null -w '%{http_code}' -b "$cookie_jar" "$APP/tickets")
[ "$code" = "200" ] && ok "compte admin du seed toujours valide après recréation ($code) : la base a bien été reconstruite par seed.js" || ko "le seed n'a pas reconstruit la base ($code)"
rm -f "$cookie_jar"

echo "=== Cas 4 : cible Prometheus de nouveau UP ==="

sleep 6
health=$(curl -s "$PROM/api/v1/targets" | jq -r '.data.activeTargets[] | select(.labels.job=="supportdesk") | .health')
[ "$health" = "up" ] && ok "cible Prometheus 'supportdesk' de nouveau up" || ko "cible Prometheus toujours $health"

echo
echo "=== Résumé ==="
echo "OK: $pass  FAIL: $fail"
[ "$fail" -eq 0 ]
