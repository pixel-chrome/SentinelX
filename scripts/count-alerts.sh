#!/usr/bin/env bash
# Liste et compte les alertes Wazuh d'une fenêtre de temps (pour le taux de faux positifs, docs/qualification.md).
# Usage : scripts/count-alerts.sh DEBUT FIN     (heures en UTC, format ISO : 2026-10-31T23:28 2026-11-01T01:28)
# Variable : CONTAINER (sentinelx-wazuh.manager-1). Outils : docker, jq.
CONTAINER=${CONTAINER:-sentinelx-wazuh.manager-1}
[ $# -eq 2 ] || { echo "Usage : $0 DEBUT FIN (UTC, ex. 2026-10-31T23:28 2026-11-01T01:28)"; exit 1; }
# Les alertes des jours précédents sont archivées en .json.gz, celles du jour sont dans alerts.json.
docker exec "$CONTAINER" sh -c 'zcat /var/ossec/logs/alerts/*/*/ossec-alerts-*.json.gz 2>/dev/null; cat /var/ossec/logs/alerts/alerts.json' \
  | jq -r --arg a "$1" --arg b "$2" 'select(.timestamp >= $a and .timestamp < $b)
      | [.timestamp[0:19], .rule.id, .rule.level, (.data.event_type // "-"), (.data.source_ip // "-"), .rule.description] | @tsv' \
  | tee /dev/stderr | wc -l | xargs echo "alertes dans la fenêtre :"
