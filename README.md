# SentinelX

Application SupportDesk (volontairement vulnérable), observée avec Prometheus et Grafana, surveillée avec Wazuh.

Le README a trois parties : lancer l'application, lire et rejouer une détection, lancer les tests.

---

## 1. Lancer l'application

### Prérequis

- Docker et Docker Compose v2 (`docker compose version`).
- **8 à 12 Go de RAM libres** pour la machine : Wazuh (manager + indexer + dashboard) en consomme
  la majorité. En dessous, le manager ou l'indexer peuvent ne jamais passer `healthy` (voir
  « Si ça ne démarre pas » plus bas).
- `vm.max_map_count` à au moins `262144` (requis par `wazuh.indexer`, basé sur OpenSearch) :

```bash
sysctl vm.max_map_count
# si < 262144 :
sudo sysctl -w vm.max_map_count=262144
```

### Certificats Wazuh (une seule fois)

Les certificats ne sont pas committés (`wazuh/config/wazuh_indexer_ssl_certs/`, ignoré par Git). À
générer avant le tout premier démarrage :

```bash
cd wazuh
docker compose -f generate-indexer-certs.yml run --rm generator
cd ..
```

### Variables d'environnement

```bash
cp .env.example .env
```

Mettre une valeur dans `GF_SECURITY_ADMIN_PASSWORD` (mot de passe admin de Grafana). Les autres
variables ont des valeurs par défaut utilisables telles quelles (voir `CONTRACT.md` section 3).

### Démarrer

```bash
docker compose up -d
```

`docker-compose.yml` (racine) inclut `wazuh/docker-compose.yml` et `wazuh/app-logs.override.yml` :
une seule commande démarre tout (`supportdesk`, `prometheus`, `grafana`, `wazuh.manager`,
`wazuh.indexer`, `wazuh.dashboard`).

### Adresses

| Service | Adresse | Identifiants |
|---|---|---|
| SupportDesk | http://localhost:3000 | comptes du seed, voir `supportdesk/database/seed.js` |
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3001 | `admin` / `GF_SECURITY_ADMIN_PASSWORD` du `.env` |
| Dashboard Wazuh | https://localhost | identifiants par défaut du dépôt Docker officiel Wazuh (certificat auto-signé : accepter l'avertissement du navigateur) |

### Vérifier que tout est `UP`

```bash
docker compose ps
```

Tous les services doivent être `Up` (le dashboard et l'indexer Wazuh passent par `starting` puis
`healthy`, ça peut prendre 5 à 15 minutes au premier démarrage). Pour l'app :

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login   # attendu : 200
```

### Si ça ne démarre pas (manque de RAM)

Avec moins de 8 Go de RAM libres, `wazuh.indexer` ou `wazuh.manager` peuvent rester `starting` ou
redémarrer en boucle (`docker compose logs wazuh.indexer`). Dans ce cas, lancer la stack sans
Wazuh pour travailler sur l'app, les métriques ou les tests fonctionnels/charge/reprise (les tests
`tests/wazuh/` et les runbooks, eux, ont besoin de Wazuh) :

```bash
docker compose up -d supportdesk prometheus grafana
```

### Arrêter

```bash
docker compose down        # garde les volumes (données Wazuh, base SQLite reconstruite au besoin)
docker compose down -v     # tout supprime, y compris les volumes
```

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

Captures d'écran de référence (dashboard, liste filtrée, détail d'alerte, Ruleset Test) : `docs/captures/`.

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

Attention : il génère de vraies alertes. Ne pas le lancer pendant une mesure de faux positifs (voir `docs/qualification.md`).

### 2.4 Rejouer un runbook

Chaque attaque a un plan (`attacks/plan-0X-<nom>.md`) et un runbook (`runbooks/runbook-0X-<nom>.md`)
avec les commandes exactes, copiables :

| Runbook | Règles couvertes |
|---|---|
| `runbook-01-brute-force-login.md` | `100100`, `100101` |
| `runbook-02-injection-sql.md` | `100110`, `100111` |
| `runbook-03-autres-attaques.md` | `100120`, `100130`, `100140`, `100150`, `100160` |

---

## 3. Lancer les tests

### Tests fonctionnels

```bash
cd supportdesk
npm test
```

Jest + Supertest, 3 suites (`admin`, `auth`, `tickets`), sans serveur ni base à lancer à la main
(chaque test instancie sa propre app). Couverture : 5/5 endpoints critiques (`/login`, `/logout`,
`/tickets`, `/tickets/:id`, `/admin`), détail dans `docs/couverture.md`.

### Tests de sécurité

```bash
cd supportdesk
npm test -- tests/security/
```

4 suites dans `supportdesk/tests/security/` (lancées aussi par un `npm test` complet) : payload SQL
sur `/tickets`, `../` sur `/kb/view`, page protégée sans session, cookie de session forgé. Elles
vérifient que les failles volontaires sont bien reproductibles. Détail dans `docs/security_test.md`.

### Tests de charge

```bash
node tests/load/load.js
```

N utilisateurs du seed en boucle sur `GET /tickets` pendant une durée donnée (`USERS`,
`DURATION_S`, voir `tests/load/README.md`). Affiche le débit, la latence (moyenne/p50/p95/max) et
le taux d'erreur. Résultats déjà obtenus dans `tests/load/README.md`.

### Tests de reprise

```bash
tests/recovery/recovery.sh
```

Arrête/redémarre `supportdesk` et vérifie quatre choses : le service revient, les sessions (en
mémoire) sont perdues, la base SQLite est reconstruite par le seed si le container est recréé, et
la cible Prometheus repasse `UP`. Détails et résultats dans `tests/recovery/README.md`, y compris
ce que Wazuh perd pendant une panne de son manager.
