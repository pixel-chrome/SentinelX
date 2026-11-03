# Runbook 02 : Injection SQL sur `/tickets`

Rejoue le plan d'attaque `attacks/plan-02-injection-sql.md`. Résultat attendu : deux alertes Wazuh
(règles `100110` et `100111`, niveau 10).

## Prérequis

- Stack démarrée : `docker compose up -d`, tout `Up` (voir README partie 1).
- `curl`, `jq`.
- Le dashboard Wazuh doit avoir fini de démarrer (5 à 15 min après le premier lancement).

## Étape 1 : se connecter avec un compte normal

```bash
JAR=$(mktemp)
curl -s -o /dev/null -c "$JAR" -b "$JAR" \
  --data-urlencode "email=jdupont@supportdesk.local" \
  --data-urlencode "password=User_123" \
  http://localhost:3000/login
```

Vérification : la commande ne renvoie rien (c'est normal), mais le fichier `$JAR` contient
maintenant un cookie `connect.sid`.

## Étape 2 : injection dans le paramètre d'URL

```bash
curl -s -o /dev/null -b "$JAR" "http://localhost:3000/tickets?status=open%27%20OR%201%3D1--"
```

## Étape 3 : injection dans le champ de recherche (formulaire)

```bash
curl -s -o /dev/null -b "$JAR" --data-urlencode "search=x' OR 1=1--" \
  http://localhost:3000/tickets/search
rm -f "$JAR"
```

## Étape 4 : observer les alertes

Dans le dashboard (`https://localhost`, menu Threat Hunting) :

```
rule.id: 100110 or rule.id: 100111
```

En ligne de commande :

```bash
docker exec sentinelx-wazuh.manager-1 cat /var/ossec/logs/alerts/alerts.json \
  | jq -c 'select(.rule.id=="100110" or .rule.id=="100111")'
```

## Résultat obtenu (exécution réelle du 2026-11-02, via `tests/wazuh/e2e.sh`)

| Étape | Règle | Niveau | Délai | Endpoint | Description |
|---|---|---|---|---|---|
| 2 | `100110` | 10 | 2 s | `/tickets/` | SupportDesk : motif d'injection SQL dans l'URL |
| 3 | `100111` | 10 | 1 s | `/tickets/search` | SupportDesk : motif d'injection SQL dans le corps de la requête |

Les deux alertes contiennent `data.event_type: request` et la source réelle de la requête
(`data.source_ip`), conformément aux critères de succès du plan d'attaque.

## Nettoyage

Aucun état à nettoyer : les requêtes sont en lecture seule (voir règles d'engagement du plan
d'attaque), rien n'a été modifié en base.
