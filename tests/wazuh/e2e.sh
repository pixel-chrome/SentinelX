#!/usr/bin/env bash
# Test de bout en bout : joue une attaque par règle contre l'appli réelle et vérifie que Wazuh lève la bonne alerte.
# Chaîne testée : requête -> logger -> app.log -> manager Wazuh -> alerts.json.
# Usage : tests/wazuh/e2e.sh   (compose démarré, appli sur BASE_URL). Outils : curl, jq, docker.
# Attention : génère de vraies alertes. Ne pas le lancer pendant une mesure de faux positifs.
# Variables : BASE_URL (http://localhost:3000), CONTAINER (sentinelx-wazuh.manager-1), WAIT (30 s d'attente max par règle)
cd "$(dirname "$0")" || exit 1
BASE_URL=${BASE_URL:-http://localhost:3000}
CONTAINER=${CONTAINER:-sentinelx-wazuh.manager-1}
WAIT=${WAIT:-30}
UA='sx-attack-e2e'
JAR=$(mktemp)
trap 'rm -f "$JAR"' EXIT
pass=0; fail=0

# Connexion : le cookie de session est gardé dans $JAR.
login() {
  : > "$JAR"
  curl -s -o /dev/null -c "$JAR" -b "$JAR" -A "$UA" --data-urlencode "email=$1" --data-urlencode "password=$2" "$BASE_URL/login"
}

# Alertes de la règle $1 (une ligne JSON par alerte).
alerts_of() {
  docker exec "$CONTAINER" cat /var/ossec/logs/alerts/alerts.json 2>/dev/null | jq -c --arg id "$1" 'select(.rule.id == $id)' 2>/dev/null
}

# check <règle> <niveau attendu> <titre> <fonction qui envoie l'attaque>
check() {
  local id=$1 level=$2 title=$3 attack=$4
  local before start last got delay
  before=$(alerts_of "$id" | wc -l)
  start=$(date +%s)
  "$attack"
  for _ in $(seq "$WAIT"); do
    if [ "$(alerts_of "$id" | wc -l)" -gt "$before" ]; then break; fi
    sleep 1
  done
  delay=$(( $(date +%s) - start ))
  last=$(alerts_of "$id" | tail -n +"$((before + 1))" | head -1)
  if [ -z "$last" ]; then
    echo "FAIL $id  aucune alerte en ${WAIT} s  $title"; fail=$((fail+1)); return
  fi
  got=$(echo "$last" | jq -r '.rule.level')
  if [ "$got" = "$level" ]; then
    echo "OK   $id  niveau $got  après ${delay} s  source=$(echo "$last" | jq -r '.data.source_ip')  $title"; pass=$((pass+1))
  else
    echo "FAIL $id  niveau attendu=$level obtenu=$got  $title"; fail=$((fail+1))
  fi
}

# --- Les attaques ---

atk_brute_force() {   # 5 échecs de login en moins de 60 s
  for i in 1 2 3 4 5; do
    curl -s -o /dev/null -A "$UA" --data-urlencode "email=admin@supportdesk.local" --data-urlencode "password=mauvais$i" "$BASE_URL/login"
  done
}
atk_sqli_url() {
  login jdupont@supportdesk.local User_123
  curl -s -o /dev/null -b "$JAR" -A "$UA" "$BASE_URL/tickets?status=open'%20OR%201=1--"
}
atk_sqli_body() {
  login jdupont@supportdesk.local User_123
  curl -s -o /dev/null -b "$JAR" -A "$UA" --data-urlencode "search=x' OR 1=1--" "$BASE_URL/tickets/search"
}
atk_traversal() {
  login jdupont@supportdesk.local User_123
  curl -s -o /dev/null -b "$JAR" -A "$UA" "$BASE_URL/kb/view?doc=../../package.json"
}
atk_scan() {          # 10 pages inexistantes en moins de 30 s
  for i in $(seq 10); do
    curl -s -o /dev/null -A "$UA" "$BASE_URL/sx-scan-$i"
  done
}
atk_ssrf() {
  login admin@supportdesk.local Admin_123
  curl -s -o /dev/null -b "$JAR" -A "$UA" --data-urlencode "url=$BASE_URL/login" "$BASE_URL/admin/fetch"
}
atk_idor() {          # jdupont ouvre un ticket qui n'est pas à lui
  login jdupont@supportdesk.local User_123
  local mine other
  mine=$(curl -s -b "$JAR" -A "$UA" "$BASE_URL/tickets?view=mine" | grep -o 'href="/tickets/[0-9]*"' | grep -o '[0-9]*')
  for other in $(seq 1 44); do
    echo "$mine" | grep -qx "$other" || break
  done
  curl -s -o /dev/null -b "$JAR" -A "$UA" "$BASE_URL/tickets/$other"
}
atk_ip_spoof() {      # X-Forwarded-For forgé : source_ip différent de l'IP réelle de la connexion
  login jdupont@supportdesk.local User_123
  curl -s -o /dev/null -b "$JAR" -A "$UA" -H 'X-Forwarded-For: 1.2.3.4' "$BASE_URL/dashboard"
}

check 100101 10 "Brute force du login"            atk_brute_force
check 100110 10 "Injection SQL dans l'URL"        atk_sqli_url
check 100111 10 "Injection SQL dans le formulaire" atk_sqli_body
check 100120 10 "Path traversal sur /kb/view"     atk_traversal
check 100130 8  "Scan de pages inexistantes"      atk_scan
check 100140 8  "SSRF via /admin/fetch"           atk_ssrf
check 100150 8  "IDOR : ticket d'un autre"        atk_idor
check 100160 7  "Usurpation d'IP (X-Forwarded-For)" atk_ip_spoof

echo "$pass réussis, $fail échoués"
[ "$fail" -eq 0 ]
