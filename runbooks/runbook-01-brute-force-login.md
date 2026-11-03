# Runbook 01 : Brute force du login

Référence : `attacks/plan-01-brute-force-login.md` (critères de succès et d'arrêt définis avant l'attaque).
Auteur : Gabriel. À tester depuis un état propre avant la démo, en suivant uniquement ce texte.

## 0. Pré-requis

- `docker compose up -d` lancé depuis la racine du dépôt, tous les services `Up`/`healthy` (`docker compose ps`).
- Trafic de fond arrêté (`scripts/traffic.js` non lancé pendant cet essai).
- Outils sur la machine attaquante : `hydra`, `curl`, `docker`, `jq`.
- Compte ciblé : `admin@supportdesk.local` (compte de démonstration du jeu de données, `supportdesk/database/seed.js`).
- Liste de mots de passe : `scripts/wordlist-login.txt` (100 entrées, aucune ne correspond au mot de passe réel : l'attaque ne vise pas la compromission du compte mais le déclenchement de la règle 100101).

## 1. Vérifier l'état propre

```
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
```
Résultat attendu : `200`.

```
docker exec sentinelx-wazuh.manager-1 sh -c 'test -f /var/ossec/logs/alerts/alerts.json && echo present'
```
Résultat attendu : `present`.

## 2. Lancer l'attaque

```
hydra -l admin@supportdesk.local -P scripts/wordlist-login.txt -s 3000 -t 4 -w 1 -V localhost http-post-form "/login:email=^USER^&password=^PASS^:F=error=1"
```

- `-l` : compte unique ciblé (conforme au plan, section Périmètre).
- `-P` : les 100 mots de passe de `scripts/wordlist-login.txt`.
- `-s 3000` : port de `supportdesk` (section 2 du contrat).
- `-t 4 -w 1` : 4 threads, 1 s d'attente entre tentatives par thread (volume maîtrisé, sous les 200 tentatives maximum du plan).
- `F=error=1` : condition d'échec hydra = la réponse contient `error=1` (`Location: /login?error=1` sur échec, `Location: /dashboard` sur succès, cf. `supportdesk/routes/auth.js`).
- `-V` : affiche chaque tentative (preuve du volume envoyé).

Garder ce terminal ouvert : il affiche la progression en direct.

## 3. Observer l'alerte pendant l'attaque (dans un second terminal)

```
watch -n 2 'docker exec sentinelx-wazuh.manager-1 sh -c "tail -n 50 /var/ossec/logs/alerts/alerts.json" | jq -c "select(.rule.id==\"100101\")"'
```

Dès qu'une ligne apparaît avec `"rule":{"id":"100101","level":10,...}`, c'est le critère de succès nominal (section Critères de succès du plan) : passer à l'étape 4.

## 4. Arrêter l'attaque

- Arrêt nominal : `Ctrl+C` dans le terminal hydra dès que l'alerte 100101 est visible (étape 3).
- Arrêt par durée : `Ctrl+C` si 3 minutes sont écoulées sans alerte (`-t 4 -w 1` sur 100 mots de passe reste largement sous ce délai).
- Arrêt par volume : hydra s'arrête seul après la 100ᵉ tentative si aucune alerte n'est encore visible.
- Abandon : `Ctrl+C` immédiat si l'application ne répond plus 10 s (`curl` de l'étape 1 qui timeout) ou si un `5xx` apparaît dans `docker logs sentinelx-supportdesk-1`.

## 5. Relever les résultats (après l'arrêt)

Alerte générée, avec ID, niveau et source :
```
docker exec sentinelx-wazuh.manager-1 cat /var/ossec/logs/alerts/alerts.json \
  | jq -c 'select(.rule.id=="100101") | {timestamp, level: .rule.level, source_ip: .data.source_ip, endpoint: .data.endpoint}'
```

Nombre d'échecs de login comptés par Prometheus pendant l'essai (avant/après, conformément au critère « augmente d'au moins 20 ») :
```
curl -s http://localhost:9090/api/v1/query --data-urlencode 'query=supportdesk_auth_attempts_total{result="failure"}' | jq -c '.data.result'
```

Nombre total de tentatives envoyées par hydra : lu dans la sortie `-V` du terminal de l'étape 2 (une ligne par tentative) ou dans le résumé final affiché par hydra (`N valid passwords found` / `N of N targets completed`).

## 6. Résultat observé (à compléter lors du test réel, avant la démo)

| Élément | Valeur |
|---|---|
| Date/heure de l'essai | |
| Tentatives envoyées (hydra) | |
| Délai entre le lancement et l'alerte 100101 | |
| Niveau de l'alerte obtenue | |
| `source_ip` de l'alerte | |
| Variation de `supportdesk_auth_attempts_total{result="failure"}` | |
| Conclusion (succès nominal / arrêt par durée / arrêt par volume / abandon) | |

## Ce que ce runbook prouve et ne prouve pas

- Prouve : qu'un volume d'échecs de login depuis une même source déclenche la règle 100101 dans le délai annoncé, avec le niveau attendu.
- Ne prouve pas : la résistance du compte à un dictionnaire plus large, le comportement si l'attaquant change d'IP entre les tentatives (voir point ouvert sur l'usurpation, règle 100160) ou s'il espace ses tentatives à moins d'une par minute (hors fenêtre `timeframe=60` de la règle 100101 : seule la règle 100100, niveau 3, s'appliquerait alors, sans agrégation).
