# CONTRACT.md 
## 0. Méta

| Élément | Valeur |
|---|---|
| Version du contrat | `0.3.1` (draft) |
| Date de dernière modification | `29/10/2026` |
| Statut | Validé par les 3 membres |
| Revue | Premier check-in |

### Règle de modification
- Toute modification passe par une PR validée par **les 3 membres (au moins un en vrai)**.
- Chaque changement est noté dans le [Changelog](#13-changelog) en bas du fichier.
- Un changement cassant (nom de champ, nom de métrique, port...) incrémente la version mineure et est annoncé à l'équipe.

### Rôles (temporaire)

| Rôle | Responsable | Périmètre | Référent pour les sections |
|---|---|---|---|
| A — Instrumentation | `Paul` | App, logs JSON, `/metrics`, tests fonctionnels et de sécurité | 4, 5, 6, 9 |
| B — Détection | `Wally` | Wazuh, décodeurs, règles, dashboard Wazuh, qualification des alertes | 2 (Wazuh), 7 |
| C — Attaques & monitoring | `Gabriel` | Compose final, Prometheus, Grafana, Attack Plans, runbooks, script de trafic, tests de charge et de reprise | 2 (Prometheus/Grafana), 8 |

---

## 1. Périmètre et règles du jeu

- Toutes les attaques visent uniquement l'instance Docker locale de l'application.
- Aucune cible tierce, aucun scan réseau hors périmètre.
- Les secrets ne sont jamais committés (voir section 3).

---

## 2. Architecture et infrastructure

### Schéma

```
 navigateur, curl, script de trafic, attaques
        │
        ▼  :3000
  supportdesk ── écrit les logs ──▶ volume app_logs ── lu en lecture seule ──▶ wazuh.manager
     ▲   (/var/log/supportdesk/app.log)                                          │ règles
     │ GET /metrics (toutes les 5 s)                                             ▼
  prometheus :9090                                                         wazuh.indexer
     ▲                                                                           │ alertes stockées
     │ requêtes PromQL                                                           ▼
  grafana :3001                                                            wazuh.dashboard :443
```

### Composants

| Service (nom dans le compose) | Image | Port sur la machine → port dans le conteneur | Rôle |
|---|---|---|---|
| `supportdesk` | construite depuis `supportdesk/` (Node 22) | `3000` → `3000` | L'application, ses logs et `/metrics` |
| `prometheus` | `prom/prometheus` (version à figer) | `9090` → `9090` | Récupère `/metrics` de l'app |
| `grafana` | `grafana/grafana` (version à figer) | `3001` → `3000` | Affiche les métriques |
| `wazuh.manager` | `wazuh/wazuh-manager:4.14.9` | `1514`, `1515`, `55000` (+ `514/udp`) | Lit les logs, applique les règles |
| `wazuh.indexer` | `wazuh/wazuh-indexer:4.14.9` | `9200` → `9200` | Stocke les alertes |
| `wazuh.dashboard` | `wazuh/wazuh-dashboard:4.14.9` | `443` → `5601` | Interface web de Wazuh (HTTPS) |

Grafana est sur `3001` parce que dans son conteneur il écoute déjà sur `3000`, comme l'app. Sur la machine on les sépare pour qu'ils ne se marchent pas dessus.

### Réseau
- Un seul fichier `docker-compose.yml`, à la racine, lancé avec `docker compose up -d`.
- Compose crée un réseau Docker commun. Les conteneurs se parlent avec le nom du service (`supportdesk:3000`, `prometheus:9090`), jamais avec `localhost`. Dans un conteneur, `localhost` c'est le conteneur lui-même, pas la machine.
- Seuls les ports du tableau sont ouverts sur la machine.

### Volumes

| Volume | Contenu | Monté dans |
|---|---|---|
| `app_logs` | le fichier de logs de l'app | `supportdesk` : écriture. `wazuh.manager` : lecture seule. Chemin `/var/log/supportdesk` dans les deux |
| volumes Wazuh | état du manager, de l'indexer et du dashboard | définis dans `wazuh/docker-compose.yml` d'origine |

La base SQLite de l'app est dans le conteneur (`supportdesk.db`) et se recrée au démarrage avec le script de seed.

### Prérequis machine
- 8 à 12 Go de RAM libres.
- `vm.max_map_count` au moins à `262144` (`sysctl vm.max_map_count`).

---

## 3. Variables d'environnement

Déjà utilisées par l'app (voir `docker-compose.yml`) :

| Variable | Valeur par défaut | Rôle |
|---|---|---|
| `PORT` | `3000` | Port d'écoute de l'app |
| `SESSION_SECRET` | `dev-secret-change-in-prod` | Secret qui signe le cookie de session |

Ajoutées avec ce contrat :

| Variable | Valeur par défaut | Service | Rôle |
|---|---|---|---|
| `LOG_FILE` | `/var/log/supportdesk/app.log` | `supportdesk` | Fichier où le logger écrit les lignes JSON |
| `GF_SECURITY_ADMIN_PASSWORD` | à mettre dans un fichier `.env` local | `grafana` | Mot de passe admin de Grafana |

À savoir :
- Le `.env` n'est pas committé (il est dans `.gitignore`). On committe un `.env.example` avec les noms des variables et des fausses valeurs.
- `SESSION_SECRET` reste à `dev-secret-change-in-prod` exprès : l'app est une cible de test, ce secret est public et il n'y a rien à protéger.
- Les mots de passe par défaut de Wazuh (dashboard, indexer, API) sont ceux du dépôt Docker officiel. Ils servent juste en local.
- Les certificats Wazuh sont générés en local et jamais committés (dossier `wazuh/config/wazuh_indexer_ssl_certs/`, ignoré par Git).

---

## 4. Endpoints de l'application


| Endpoint | Méthode | Accès | Faille / point d'attention |
|---|---|---|---|
| `/login` | GET, POST | public | Brute force. Un échec et un succès répondent tous les deux 302. |
| `/logout` | GET | connecté | - |
| `/dashboard` | GET | connecté | - |
| `/tickets` | GET | connecté | Injection SQL (paramètres `status`, `priority`, `sort`) |
| `/tickets/search` | POST | connecté | Injection SQL (champ `search`) |
| `/tickets/:id` | GET | connecté | IDOR : pas de contrôle du propriétaire, répond 200 |
| `/tickets/:id/export` | GET | connecté | IDOR : pareil |
| `/tickets/:id/comment` | POST | connecté | XSS stocké (le commentaire est affiché sans être nettoyé) |
| `/profile` | GET, POST | connecté | XSS stocké (`display_name` affiché sans être nettoyé chez les autres) |
| `/kb` | GET | connecté | - |
| `/kb/view?doc=` | GET | connecté | Path traversal (le nom du fichier n'est pas vérifié) |
| `/kb/*.html`, `/bootstrap/*` | GET | public | Fichiers statiques servis par `express.static`, sans connexion |
| `/metrics` | GET | public | Métriques Prometheus (voir section 6). À ajouter |
| `/admin` | GET | admin | Réponse 403 si on n'est pas admin |
| `/admin/fetch` | POST | admin | SSRF : le serveur télécharge l'URL donnée |
| toute autre adresse | GET | public | Réponse 404 (utile pour repérer les scans) |

Autres points qui touchent aux logs :
- Les mots de passe sont stockés en clair dans la base.
- `app.set('trust proxy', true)` : l'IP du client (`req.ip`) vient de l'en-tête `X-Forwarded-For`, donc le client peut la falsifier. On loggue aussi l'IP réelle de la connexion pour repérer la triche (voir section 5).
- Une page protégée demandée sans être connecté répond aussi 302 (vers `/login`), comme un login raté (vers `/login?error=1`). On les différencie avec l'en-tête `Location`.
- Les fichiers statiques sont servis avant les sessions dans `app.js`, donc un logger placé après les sessions ne les voit pas.

---

## 5. Schéma des logs

### Règles générales

- Une ligne JSON par événement.
- JSON à plat (pas de sous-objet) pour que le décodeur JSON de Wazuh lise bien les champs.
- Noms de champs en `snake_case`.
- Un champ sans valeur vaut `null`.
- Le mot de passe n'est jamais écrit, ni dans `body` ni ailleurs. On met `[REDACTED]` à la place.
- `query` et `body` sont coupés à 500 caractères.
- La ligne est faite avec `JSON.stringify`, qui transforme les retours à la ligne en texte (\n). Un attaquant ne peut donc pas fabriquer de fausses lignes de log.
- Les 11 premiers champs du tableau (de `timestamp` à `body`) sont ceux du sujet, avec ses noms. Les 4 derniers sont à nous.

### Champs

| Champ | Type | Description | Exemple |
|---|---|---|---|
| `timestamp` | string | Date et heure UTC, format ISO 8601 | `2026-10-28T14:32:11.423Z` |
| `level` | string | `INFO`, `WARN` ou `ERROR` | `WARN` |
| `event_type` | string | Ce qui s'est passé (liste plus bas) | `auth_failure` |
| `source_ip` | string | IP calculée par Express (`req.ip`). Falsifiable via `X-Forwarded-For` | `1.2.3.4` |
| `user` | string ou null | Voir « À propos du champ `user` » | `admin@supportdesk.local` |
| `endpoint` | string | Chemin demandé, sans les paramètres | `/login` |
| `method` | string | Méthode HTTP | `POST` |
| `status_code` | number | Code HTTP de la réponse | `302` |
| `message` | string | Phrase lisible qui résume l'événement | `login failed` |
| `query` | string ou null | Paramètres de l'URL, tels que reçus (texte brut, pas décodé) | `status=open'%20OR%201=1--` |
| `body` | string ou null | Champs du formulaire envoyé, mot de passe masqué | `{"email":"test@gmail.com","password":"[REDACTED]"}` |
| `remote_addr` | string | IP réelle de la connexion TCP (`req.socket.remoteAddress`). Non falsifiable. En Docker c'est souvent l'IP du pont Docker (`172.x`) | `172.18.0.1` |
| `x_forwarded_for` | string ou null | En-tête `X-Forwarded-For` tel que reçu | `1.2.3.4` |
| `resource_owner` | string ou null | Nom d'utilisateur du créateur du ticket demandé. Sert à repérer l'IDOR (`user` différent de `resource_owner`) | `jdupont` |
| `user_agent` | string ou null | Outil qui envoie la requête | `curl/8.5.0` |

### À propos du champ `user`

| Situation | Valeur |
|---|---|
| Login raté | l'email tapé dans le formulaire (pas un utilisateur vérifié) |
| Login réussi | l'email, cette fois confirmé |
| Requête d'une personne connectée | le nom d'utilisateur de la session |
| Visiteur non connecté | `null` |

### Valeurs de `event_type`

| `event_type` | `level` | Quand | Comment l'app le sait |
|---|---|---|---|
| `auth_success` | INFO | Login réussi | `POST /login`, `Location` = `/dashboard` |
| `auth_failure` | WARN | Login raté | `POST /login`, `Location` = `/login?error=1` |
| `auth_required` | WARN | Page protégée demandée sans être connecté | Réponse 302 avec `Location` = `/login` |
| `access_denied` | WARN | Accès refusé | Réponse 403 |
| `not_found` | WARN | Adresse inconnue (scan, aléatoire) | Réponse 404 |
| `error` | ERROR | Erreur interne | Réponse 500 |
| `admin_fetch` | WARN | L'admin fait télécharger une URL au serveur | `POST /admin/fetch` (l'URL est dans `body`) |
| `request` | INFO | Toute autre requête | Par défaut |

`auth_success`, `auth_failure`, `request` et `error` sont les types minimum demandés pour la soutenance. Les autres, on les ajoute pour mieux détecter.

Pour `resource_owner`, le logger ne peut pas le deviner tout seul : les routes `/tickets/:id` et `/tickets/:id/export` le mettent dans `res.locals.resource_owner`, et le logger le lit à la fin de la réponse.

### Où le logger écrit et où il se place

- Il écrit chaque ligne dans le fichier `LOG_FILE` (section 3) et aussi sur la sortie standard (`docker logs`). Wazuh lit le fichier.
- Il se place après les sessions et avant les routes, comme dans le squelette de `middleware/logger.js`. Comme ça il connaît `user`.
- Du coup, les fichiers servis par `express.static` (`/kb/*.html`, `/bootstrap/*`) ne sont pas loggués, puisque `express.static` passe avant. On ne détecte pas les accès directs à ces fichiers publics. On le note comme limite dans la qualification.

---

## 6. Métriques Prometheus

### Format
- Endpoint `GET /metrics` sur le port de l'app, sans authentification.
- Format texte Prometheus (`Content-Type: text/plain; version=0.0.4`). Si le format est invalide, Prometheus le rejette sans rien dire : la cible passe juste en `DOWN`. Donc on vérifie toujours la cible dans Prometheus (`Status → Targets`).
- Bibliothèque : `prom-client`.
- Toutes nos métriques commencent par `supportdesk_`. La bibliothèque ajoute aussi ses métriques par défaut (`process_*`, `nodejs_*`), on les garde.

### Métriques

| Nom | Type | Labels | Ce qu'elle mesure |
|---|---|---|---|
| `supportdesk_http_requests_total` | counter | `method`, `route`, `status` | Nombre de requêtes reçues |
| `supportdesk_auth_attempts_total` | counter | `result` (`success` ou `failure`) | Tentatives de connexion |
| `supportdesk_errors_total` | counter | `status` | Réponses d'erreur serveur (5xx) |
| `supportdesk_http_request_duration_seconds` | histogram | `method`, `route` | Temps de réponse |
| `supportdesk_http_requests_in_flight` | gauge | aucun | Requêtes en cours de traitement à l'instant |

### Nos choix
- **Compteur** : il ne fait que monter (nombre de requêtes). Pour avoir un débit, on utilise `rate(...)`. Il repart à 0 si l'app redémarre.
- **Jauge** : elle monte et descend (requêtes en cours).
- **Histogramme** : il range les durées dans des tranches (buckets). Ça permet de calculer un percentile avec `histogram_quantile`.
- **Buckets** : `0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5` secondes. L'app est petite et rapide, donc on veut des tranches fines sous 100 ms. Des tranches trop larges cacheraient une lenteur.
- **`route`** : le motif de la route (`/tickets/:id`), jamais l'URL réelle. Sinon chaque numéro de ticket crée une nouvelle série et Prometheus se remplit.
- **Pas de label IP, utilisateur ou `event_type`** : il y aurait trop de valeurs différentes (explosion de cardinalité). L'IP, on la voit dans les logs et dans Wazuh.
- `supportdesk_errors_total` compte seulement les 5xx. Les 4xx (401, 403, 404) se lisent dans `supportdesk_http_requests_total` avec le label `status`.

### Prometheus

| Réglage | Valeur |
|---|---|
| Fichier | `prometheus/prometheus.yml` |
| `job_name` | `supportdesk` |
| Cible | `supportdesk:3000` (nom du service, pas `localhost`) |
| Intervalle de scrape | `5s` |
| Chemin | `/metrics` |

### Grafana

| Réglage | Valeur |
|---|---|
| Source de données | `http://prometheus:9090`, créée automatiquement (provisioning) |
| Dashboard | fichier JSON dans `grafana/dashboards/`, chargé automatiquement |
| Pourquoi du provisioning | Un dashboard fait à la main dans l'interface disparaît avec `docker compose down -v`. Un fichier versionné se recharge à chaque démarrage |
| Panneaux minimum | requêtes par seconde, échecs de login par minute, latence p95, erreurs 5xx |

---

## 7. Conventions de détection (Wazuh)

### Comment les logs arrivent
Le manager Wazuh lit directement le fichier de logs, sans agent :

```xml
<localfile>
  <log_format>json</log_format>
  <location>/var/log/supportdesk/app.log</location>
</localfile>
```

Le volume `app_logs` est monté en lecture seule dans `wazuh.manager`, au même chemin. Ce bloc va dans `wazuh/config/wazuh_cluster/wazuh_manager.conf`.

### Ce que Wazuh fait des champs (testé avec l'outil de test des règles)

| Dans le log | Dans Wazuh | Remarque |
|---|---|---|
| tous les champs | `data.<nom>` | ex. `data.event_type`, `data.endpoint` |
| `source_ip` | `data.source_ip` | pas renommé en `srcip`. On filtre sur `data.source_ip` |
| `user` | `data.dstuser` | Wazuh renomme ce champ |
| `status_code` | `data.status_code` | texte (`"302"`), pas un nombre |
| `null` | `"null"` | texte. Une règle doit tester la chaîne `null` |

Le décodeur JSON natif suffit, on n'écrit pas de décodeur à nous.

### Piège
Une règle native, la `86600` (« Suricata messages », niveau 0), matche tous nos logs : elle demande juste un JSON avec `timestamp` et `event_type`. Wazuh s'arrête à elle et ne regarde que ses enfants, donc une règle à nous écrite avec `<decoded_as>json</decoded_as>` ne se déclenche jamais (testé). Toutes nos règles sont donc des enfants de la 86600 : `<if_sid>86600</if_sid>` puis un test sur la valeur de `event_type` ou d'un autre champ.

Autre piège : une règle de base à niveau 0 n'est pas gardée en mémoire, donc une règle de fréquence qui s'appuie dessus ne compte rien. Notre règle de base pour les 404 est à niveau 1 (pas d'alerte, car le seuil d'alerte est 3).

### Règles custom
- Fichier : `wazuh/config/wazuh_cluster/rules/supportdesk_rules.xml`.
- IDs réservés : `100100` à `100199`.
- Chaque règle a un `description` clair, un `level`, un `group` (`supportdesk`) et un commentaire qui explique le motif détecté.
- On regroupe les événements d'une même source avec `<same_field>source_ip</same_field>`.

| ID | Motif | Condition | Niveau visé | Plan d'attaque |
|---|---|---|---|---|
| `100100` | Échec de login (règle de base) | `event_type` = `auth_failure` | 3 | brute force |
| `100101` | Brute force | 5 × `100100` avec la même `source_ip` en 60 s | 10 | brute force |
| `100110` | Injection SQL dans l'URL | `query` contient un motif SQL (`UNION SELECT`, `OR 1=1`, `'--`, `sleep(`) | 10 | injection SQL |
| `100111` | Injection SQL dans le formulaire | pareil, dans `body` | 10 | injection SQL |
| `100120` | Path traversal | `query` contient `../` ou sa forme encodée (`%2e%2e`) | 10 | path traversal |
| `100129` | Page introuvable (règle de base) | `event_type` = `not_found` | 1 (pas d'alerte) | scan |
| `100130` | Scan d'adresses | 10 × `100129` avec la même `source_ip` en 30 s | 8 | scan |
| `100140` | SSRF | `event_type` = `admin_fetch` | 8 | SSRF |

Les seuils et les niveaux sont des points de départ. On les ajustera avec les tests et le taux de faux positifs, et chaque changement va dans le changelog.

### Limite : comparer deux champs
Wazuh ne sait pas comparer deux champs d'une même ligne (à notre connaissance). Donc `user` ≠ `resource_owner` (IDOR) et `source_ip` ≠ `remote_addr` (usurpation d'IP) ne s'écrivent pas directement en règle. Voir section 12.

### À vérifier pendant le dry-run
Pour chaque règle, l'alerte doit apparaître dans le dashboard avec le bon niveau (`rule.level`), la bonne source (`data.source_ip`) et le bon type (`data.event_type`). Un autre membre doit pouvoir refaire le test avec le mode d'emploi de la section 11.

---

## 8. Conventions d'attaque

- Chaque attaque a un Attack Plan écrit et validé par les 3 membres avant d'être lancée. Fichiers : `attacks/plan-0X-<nom>.md`, 1 page maximum.
- Le plan suit le gabarit du sujet, dans cet ordre : *Rules of engagement*, *Scope*, *Attack vectors*, *Tools used*, *Success criteria*, *Stop criteria*, *MITRE ATT&CK mapping*.
- Critères de succès chiffrés : sévérité minimale, ID de règle (section 7), délai en minutes.
- Critères d'arrêt écrits à l'avance : alerte générée, durée maximale, impact hors périmètre.
- Mapping MITRE : identifiant et nom de la technique (ex. `T1110` Brute Force).
- Chaque attaque a un runbook : `runbooks/runbook-0X-<nom>.md`. Dedans : les commandes exactes (copiables, sans `...`), ce qu'on observe, et l'alerte obtenue (ID de règle, niveau).
- Un runbook doit marcher quand quelqu'un d'autre le suit à la lettre, avec un compose fraîchement démarré.
- Les outils visent seulement `localhost:3000`. Un outil lancé en une seule commande (Hydra, sqlmap) compte pour une commande.
- Marquage du trafic : les attaques envoient un `User-Agent` qui commence par `sx-attack-`, le script de trafic par `sx-traffic`. Ça sert à trier les alertes pour le taux de faux positifs. Les règles ne doivent pas dépendre de ce marquage (un vrai attaquant ne le met pas).

---

## 9. Tests et trafic de référence

### Tests fonctionnels
- Dossier `tests/functional/`.
- Endpoints critiques : `/login`, `/logout`, `/tickets`, `/tickets/:id`, `/admin`.
- Taux de couverture = endpoints critiques testés / endpoints critiques. Objectif : 5/5, avec au moins un cas qui passe et un cas qui échoue par endpoint. Le chiffre réel et ce qui n'est pas couvert vont dans `docs/couverture.md`.

### Tests aux limites de sécurité
- Dossier `tests/security/`.
- Cas : payload SQL sur `/tickets`, `../` sur `/kb/view`, page protégée sans session, cookie de session forgé.
- Pour chaque cas, on vérifie le code HTTP **ou** la ligne de log produite.

### Tests de charge
- Dossier `tests/load/`. On y note l'outil, la charge et le résultat chiffré (latence, taux d'erreur). Un graphique Grafana commenté est accepté.

### Tests de reprise
- Dossier `tests/recovery/`.
- Cas : `docker compose stop` d'un service puis redémarrage, perte des sessions (elles sont en mémoire), recréation de la base SQLite, cible Prometheus de nouveau `UP`, ce que Wazuh a perdu pendant la panne.

### Script de trafic de référence
- Dossier `scripts/`. Il simule l'usage d'un helpdesk, pas une boucle de login.
- Proposition de départ (à valider) : 4 utilisateurs en parallèle qui se connectent, listent des tickets, en ouvrent un, cherchent, commentent, se déconnectent, avec des pauses de 1 à 5 secondes. Environ 1 échec de mot de passe isolé pour 10 connexions.
- L'outil, le volume et la durée sont écrits dans le dossier du script et partagés avec l'équipe.
- Mesure du taux de faux positifs : le script doit tourner de façon stable au moins 30 minutes avant la fenêtre de mesure. Fenêtre proposée : 2 heures.
- Taux de faux positifs = alertes sans vraie attaque / alertes totales dans la fenêtre, avec le numérateur, le dénominateur et la durée (ex. `3 / 41 sur 2 h`). Chaque faux positif a une justification écrite dans `docs/qualification.md`.

---

## 10. Dépôt Git

### Branches
- `main` : version livrée. `dev` : intégration. Une branche par membre (`Wally`, `Paul`, `Gabou`), créée à partir de `dev`.
- Chacun fait ses commits et ses pushs.

### Commits
- Format : `type(zone): description courte`. Types : `feat`, `fix`, `docs`, `test`, `chore`, `config`. Exemple : `feat(logs): ajoute le champ remote_addr`.
- Petits et fréquents, un sujet par commit. Pas de `wip`, `maj`, ou `fix` tout seul.

### Organisation

```
docker-compose.yml        # unique, à la racine
CONTRACT.md               # à la racine
README.md                 # les 3 modes d'emploi (section 11)
.env.example
supportdesk/              # l'application
wazuh/                    # configuration Wazuh et règles XML
prometheus/               # prometheus.yml
grafana/                  # provisioning + dashboards (JSON)
attacks/                  # Attack Plans
runbooks/
scripts/                  # script de trafic, helpers
tests/                    # functional/, security/, load/, recovery/
docs/                     # qualification.md, couverture.md
```

### À ne jamais committer
`node_modules`, `supportdesk.db`, `.env`, les certificats Wazuh, les fichiers lourds (images, archives), les logs. Tout ça est dans `.gitignore`.

### Gel
Après le dépôt, `docker-compose.yml` ne bouge plus. Seule la documentation peut encore changer.

---

## 11. Documentation

Le `README.md` a trois parties séparées :

1. **Lancer l'application** : prérequis (Docker, RAM, `vm.max_map_count`), génération des certificats Wazuh si besoin, `docker compose up -d`, adresses de chaque service (section 2), comment vérifier que tout est `UP`, comment tout arrêter.
2. **Lire et rejouer une détection** : où voir les alertes dans le dashboard Wazuh (filtres sévérité, chronologie, `data.event_type`, `data.source_ip`), comment rejouer une ligne de log dans l'outil de test des règles, comment relancer un runbook.
3. **Lancer les tests** : la commande pour chaque famille (fonctionnels, sécurité, charge, reprise), où lire les résultats, comment lire le taux de couverture.

---

## 12. Décisions

### Prises

| Sujet | Décision | Pourquoi |
|---|---|---|
| Emplacement des logs | Fichier `LOG_FILE` dans un volume partagé, en lecture seule pour Wazuh (+ sortie standard) | Le manager Wazuh lit un fichier, pas besoin d'agent |
| Source dans Wazuh | On garde `source_ip`. Wazuh la range dans `data.source_ip` | Testé : pas de `srcip`, mais le champ est utilisable tel quel |
| Place du logger | Après les sessions, avant les routes | Il connaît `user`. Les fichiers statiques ne sont pas loggués (limite assumée) |
| Port de Grafana | `3001` sur la machine | `3000` est pris par l'app |
| Noms des types d'événements | `request` et `error` | Ce sont les types minimum demandés à la soutenance |

### Ouvertes

| Sujet | Question | Statut |
|---|---|---|
| Certificats Wazuh | Un dépôt fraîchement cloné n'a pas les certificats (non committés). Un service du compose qui les génère au premier démarrage, ou une étape dans le README ? Le sujet veut un `docker compose up` sans erreur | À trancher (Gabriel et Wally) |
| IDOR et usurpation d'IP | Wazuh ne compare pas deux champs. Le logger calcule un champ (ex. `idor_suspect`, `ip_mismatch`) ou on laisse ces deux détections de côté ? | À trancher (Paul et Wally) |
| Versions des images | Figer les versions exactes de Prometheus et Grafana | Gabriel |
| Valeurs du script de trafic | Nombre d'utilisateurs, durée, outil | À valider en équipe |
| Accès aux fichiers statiques | Pas couverts par le logger (section 5) | Limite assumée, à confirmer |

---
## 13. Changelog

| Version | Date | Auteur | Changement |
|---|---|---|---|
| 0.1.0 | `<16/10/2026>` | `Gabriel` | Version initiale (canva vide) |
| 0.1.1 | `<19/10/2026>` | `Gabriel` | Modif version de Node pour le lancement de l'app (voir `19-10-2026.md`)|
| 0.2.0 | `<28/10/2026>` | `Wally` | Sections 3, 4, 5 (variables, endpoints, schéma des logs) et 12 (décisions ouvertes). |
| 0.3.0 | `<29/10/2026>` | `Wally` | Sections 2 (architecture, ports, volumes), 6 (métriques), 7 (conventions Wazuh et règles prévues), 8, 9, 10, 11 (documentation) et 12 (décisions prises et ouvertes). Types `http_request` et `server_error` renommés `request` et `error`. Ajout de `/metrics` dans les endpoints, de `LOG_FILE` dans les variables. Ordre des champs de la section 5 : les 11 champs du sujet d'abord. |
| 0.3.1 | `<29/10/2026>` | `Wally` | Section 7 : règles de Wazuh testées. Nos règles sont des enfants de la règle native 86600 (`if_sid`), règle de base 404 passée à niveau 1, règle `100111` (SQLi dans le body) et `100129` ajoutées. |
