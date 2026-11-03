# Runbook 03 : Path traversal, scan, SSRF, IDOR, usurpation d'IP

Référence : `attacks/plan-03-autres-attaques.md`. À tester depuis un état propre, en suivant
uniquement ce texte.

## Prérequis

- Stack démarrée : `docker compose up -d`, tout `Up` (voir README partie 1).
- `curl`, `jq`.

## Vecteur 1 : path traversal sur `/kb/view`

```bash
JAR=$(mktemp)
curl -s -o /dev/null -c "$JAR" -b "$JAR" \
  --data-urlencode "email=jdupont@supportdesk.local" \
  --data-urlencode "password=User_123" \
  http://localhost:3000/login
curl -s -o /dev/null -b "$JAR" "http://localhost:3000/kb/view?doc=../../package.json"
rm -f "$JAR"
```

Alerte attendue : `rule.id: 100120`, niveau 10.

## Vecteur 2 : scan de pages inexistantes

```bash
for i in $(seq 10); do
  curl -s -o /dev/null "http://localhost:3000/sx-scan-$i"
done
```

Alerte attendue : `rule.id: 100130`, niveau 8. Règle de fréquence (10 requêtes en 30 s) : si
rien n'apparaît dans la minute, relancer la boucle une seconde fois sans pause.

## Vecteur 3 : SSRF via `/admin/fetch`

```bash
JAR=$(mktemp)
curl -s -o /dev/null -c "$JAR" -b "$JAR" \
  --data-urlencode "email=admin@supportdesk.local" \
  --data-urlencode "password=Admin_123" \
  http://localhost:3000/login
curl -s -o /dev/null -b "$JAR" --data-urlencode "url=http://localhost:3000/login" \
  http://localhost:3000/admin/fetch
rm -f "$JAR"
```

Alerte attendue : `rule.id: 100140`, niveau 8.

## Vecteur 4 : IDOR sur `/tickets/:id`

```bash
JAR=$(mktemp)
curl -s -o /dev/null -c "$JAR" -b "$JAR" \
  --data-urlencode "email=jdupont@supportdesk.local" \
  --data-urlencode "password=User_123" \
  http://localhost:3000/login
# Récupérer un ID de ticket qui n'appartient pas à jdupont (ex. ticket 1) et l'ouvrir :
curl -s -o /dev/null -b "$JAR" "http://localhost:3000/tickets/1"
rm -f "$JAR"
```

Alerte attendue : `rule.id: 100150`, niveau 8, `data.idor_suspect: true`.

## Vecteur 5 : usurpation d'IP via `X-Forwarded-For`

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
rule.id >= 100120 and rule.id <= 100160
```

En ligne de commande :

```bash
docker exec sentinelx-wazuh.manager-1 cat /var/ossec/logs/alerts/alerts.json \
  | jq -c 'select(.rule.id=="100120" or .rule.id=="100130" or .rule.id=="100140" or .rule.id=="100150" or .rule.id=="100160")'
```

## Résultat obtenu (exécution réelle du 2026-11-03, via `tests/wazuh/e2e.sh`)

| Vecteur | Règle | Niveau | Délai | Source |
|---|---|---|---|---|
| Path traversal | `100120` | 10 | 1 s | `::ffff:172.19.0.1` |
| Scan | `100130` | 8 | 1 s | `::ffff:172.19.0.1` |
| SSRF | `100140` | 8 | 2-3 s | `::ffff:172.19.0.1` |
| IDOR | `100150` | 8 | 1-2 s | `::ffff:172.19.0.1` |
| Usurpation d'IP | `100160` | 7 | 1 s | `1.2.3.4` (source falsifiée, cf. `data.ip_mismatch`) |

Tous les critères de succès du plan (niveau minimal, délai, champs) sont atteints. La règle
`100130` (scan) est parfois lente à se déclencher (fenêtre de fréquence `timeframe=30`) : relancer
le vecteur 2 une seconde fois si rien n'apparaît en 1 minute.

## Nettoyage

Aucun état à nettoyer : lecture seule (`/kb/view`, `/sx-scan-*`, `/tickets/:id`, `/dashboard`) ou
requête interne inoffensive (`/admin/fetch` vers `/login`), rien n'est modifié en base.

## Ce que ce runbook prouve et ne prouve pas

- Prouve : que chaque vecteur déclenche bien la règle attendue, au niveau attendu, dans le délai
  annoncé.
- Ne prouve pas : la résistance à une variante d'encodage non testée (ex. `%2e%2e%2f` pour le
  path traversal), ni le comportement si plusieurs vecteurs sont combinés dans la même requête.
