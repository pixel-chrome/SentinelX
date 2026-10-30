#!/usr/bin/env bash
# Rejoue les cas de cases.tsv dans wazuh-logtest et vérifie la règle finale de chaque cas.
# Usage : tests/wazuh/run-logtest.sh   (le conteneur wazuh-wazuh.manager-1 doit tourner)
cd "$(dirname "$0")" || exit 1
CONTAINER=${CONTAINER:-wazuh-wazuh.manager-1}
pass=0; fail=0
while IFS=$'\t' read -r expected repeat title line; do
  got=$(for _ in $(seq "$repeat"); do echo "$line"; done \
    | docker exec -i "$CONTAINER" /var/ossec/bin/wazuh-logtest 2>&1 \
    | grep -E "^\s*id:" | tail -1 | sed -E "s/.*'([0-9]+)'.*/\1/")
  if [ "$got" = "$expected" ]; then
    echo "OK   $expected  $title"; pass=$((pass+1))
  else
    echo "FAIL attendu=$expected obtenu=${got:-rien}  $title"; fail=$((fail+1))
  fi
done < cases.tsv
echo "$pass réussis, $fail échoués"
[ "$fail" -eq 0 ]
