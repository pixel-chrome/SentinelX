# SentinelX

Application SupportDesk (volontairement vulnérable), observée avec Prometheus et Grafana, surveillée avec Wazuh.

Le README a trois parties : lancer l'application, lire et rejouer une détection, lancer les tests.

---

## 1. Lancer l'application

À compléter (Paul) : prérequis, certificats Wazuh, `docker compose up -d`, adresses, vérification, arrêt.

---

## 2. Lire et rejouer une détection

Prérequis : la stack tourne (`docker compose up -d`) et le conteneur `sentinelx-wazuh.manager-1` est `Up`.

### 2.1 Retrouver une alerte dans le dashboard Wazuh

1. Ouvrir `https://localhost` (certificat auto-signé : accepter l'avertissement du navigateur) et se connecter.
2. Menu Threat Hunting.
3. Régler la période en haut à droite (ex. « Last 15 minutes »).
4. Filtrer avec la barre de recherche :

| Je cherche | Filtre à saisir |
|---|---|
| Les alertes de l'appli | `rule.id >= 100100 and rule.id <= 100199` |
| Une règle précise | `rule.id: 100101` |
| Les alertes graves | `rule.level >= 10` |
| Un type d'événement | `data.event_type: auth_failure` |
| Une source | `data.source_ip: "203.0.113.7"` |

5. Dans chaque alerte, vérifier trois champs : `rule.level` (sévérité), `data.source_ip` (qui attaque), `data.event_type` (quoi). La chronologie en haut montre quand les alertes sont arrivées.

Ligne de commande, sans dashboard (alertes du jour, une ligne par alerte) :

```bash
docker exec sentinelx-wazuh.manager-1 cat /var/ossec/logs/alerts/alerts.json | jq -r '[.timestamp[0:19], .rule.id, .rule.level, (.data.source_ip // "-"), .rule.description] | @tsv'
```

Pour compter les alertes d'une fenêtre de temps (heures en UTC) :

```bash
scripts/count-alerts.sh 2026-11-01T10:00 2026-11-01T12:00
```

### 2.2 Rejouer une ligne de log dans l'outil de test des règles

L'outil de test (`wazuh-logtest`) applique les règles à une ligne sans créer d'alerte réelle.

Dans le dashboard : **Server management → Ruleset Test**, coller une ligne JSON, valider. La phase 3 affiche la règle qui a matché (`id`, `level`, `description`).

Les lignes prêtes à coller, une par règle, sont dans `tests/wazuh/logtest-cases.md`. Pour les règles de fréquence (`100101`, `100130`), coller la même ligne plusieurs fois **dans la même session** : Wazuh garde les événements en mémoire.

En ligne de commande, tous les cas d'un coup :

```bash
tests/wazuh/run-logtest.sh
```

La sortie est une ligne `OK` ou `FAIL` par cas, puis le total. Le code de retour est non nul si un cas échoue.

### 2.3 Rejouer une attaque réelle, de bout en bout

Chaîne testée : requête → logger → `app.log` → manager Wazuh → `alerts.json`.

```bash
tests/wazuh/e2e.sh
```

Le script joue une attaque par règle (brute force, injection SQL dans l'URL et le formulaire, parcours de répertoire, scan, SSRF, IDOR, usurpation d'IP) et attend l'alerte attendue. Il affiche le niveau et le délai d'apparition de chacune.

Attention : il génère de vraies alertes. Ne pas le lancer pendant une mesure de faux positifs (voir `doc/qualification.md`).

### 2.4 Rejouer un runbook

À compléter (Gabriel) : voir le dossier `runbooks/`.

---

## 3. Lancer les tests

À compléter (Paul et Gabriel) : tests fonctionnels, sécurité, charge, lecture de la couverture (`doc/couverture.md`).

### Tests de reprise

```bash
tests/recovery/recovery.sh
```

Arrête/redémarre `supportdesk` et vérifie quatre choses : le service revient, les sessions (en
mémoire) sont perdues, la base SQLite est reconstruite par le seed si le container est recréé, et
la cible Prometheus repasse `UP`. Détails et résultats dans `tests/recovery/README.md`, y compris
ce que Wazuh perd pendant une panne de son manager.
