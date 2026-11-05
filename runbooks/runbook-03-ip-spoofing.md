# Runbook 03 : Usurpation d'IP (IP spoofing)

Référence : `attacks/plan-03-ip-spoofing.md`. À tester depuis un état propre, en suivant
uniquement ce texte.

## Prérequis

- Stack démarrée : `docker compose up -d`, tout `Up` (voir README partie 1).
- `curl`, `jq`.

## Vecteur : usurpation d'IP via `X-Forwarded-For`

```bash
JAR=$(mktemp)
curl -s -o /dev/null -c "$JAR" -b "$JAR" \
  --data-urlencode "email=jdupont@supportdesk.local" \
  --data-urlencode "password=User_123" \
  http://localhost:3000/login
curl -s -o /dev/null -b "$JAR" -H "X-Forwarded-For: 1.2.3.4" http://localhost:3000/dashboard
rm -f "$JAR"
```

Alerte attendue : `rule.id: 100160`, niveau 7, `data.ip_mismatch: true`, `data.source_ip: 1.2.3.4`.

## Observer les alertes

Dans le dashboard (`https://localhost`, menu Threat Hunting) :

```
rule.id: 100160
```

En ligne de commande :

```bash
docker exec sentinelx-wazuh.manager-1 cat /var/ossec/logs/alerts/alerts.json \
  | jq -c 'select(.rule.id=="100160")'
```

## Résultat obtenu (exécution réelle du 2026-11-03, via `tests/wazuh/e2e.sh`)

| Vecteur | Règle | Niveau | Délai | Source |
|---|---|---|---|---|
| Usurpation d'IP | `100160` | 7 | 1 s | `1.2.3.4` (source falsifiée, cf. `data.ip_mismatch`) |

Le critère de succès du plan (niveau minimal, délai, champs) est atteint.

## Nettoyage

Aucun état à nettoyer : lecture seule (`/dashboard`), rien n'est modifié en base.

## Ce que ce runbook prouve et ne prouve pas

- Prouve : que le vecteur déclenche bien la règle `100160` attendue, au niveau attendu, dans le
  délai annoncé.
- Ne prouve pas : le comportement avec d'autres formes d'en-tête de proxy (ex. `X-Real-IP`), ni le
  cas où l'IP falsifiée tombe dans la plage du simulateur de trafic.
