# CONTRACT.md 
## 0. Méta

| Élément | Valeur |
|---|---|
| Version du contrat | `0.1.0` (draft) |
| Date | `16/10/2026` |
| Statut | ☐ Draft ☐ Validé par les 3 membres |
| Revue | Premier check-in |

### Règle de modification
- Toute modification passe par une PR validée par **les 3 membres (au moins un en vrai)**.
- Chaque changement est noté dans le [Changelog](#13-changelog) en bas du fichier.
- Un changement cassant (nom de champ, nom de métrique, port...) incrémente la version mineure et est annoncé à l'équipe.

### Rôles (temporaire)

| Rôle | Responsable | Périmètre | Référent pour les sections |
|---|---|---|---|
| A — Instrumentation | `Paul` | App, logs JSON, `/metrics`, tests fonctionnels, script de trafic | 4, 5, 6, 9 |
| B — Détection | `Wally` | Wazuh, décodeurs, règles, dashboard Wazuh | 2 (Wazuh), 7 |
| C — Attaques & monitoring | `Gabriel` | Attack Plans, runbooks, Prometheus, Grafana, rapport de qualification | 2 (Prometheus/Grafana), 8 |

Les rôles tournent à partir de l'étape 2 (chacun écrit au moins une règle et lance au moins une attaque).

---

## 1. Périmètre et règles du jeu

- Toutes les attaques visent **uniquement** l'instance Docker locale de l'application.
- Aucune cible tierce, aucun scan réseau hors périmètre.
- Les secrets ne sont jamais committés (voir section 3).

---

## 2. Architecture et infrastructure

---

## 3. Variables d'environnement

Déjà utilisées par l'app (voir `docker-compose.yml`) :

| Variable | Valeur par défaut | Rôle |
|---|---|---|
| `PORT` | `3000` | Port d'écoute de l'app |
| `SESSION_SECRET` | `dev-secret-change-in-prod` | Secret qui signe le cookie de session |

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
| `/kb/*.html`, `/bootstrap/*` | GET | public | Fichiers statiques utilisés par `express.static`, sans connexion |
| `/admin` | GET | admin | Réponse 403 si on n'est pas admin |
| `/admin/fetch` | POST | admin | SSRF : le serveur télécharge l'URL donnée |
| toute autre adresse | GET | public | Réponse 404 (utile pour repérer les scans) |

Autres points qui touchent aux logs :
- Les mots de passe sont stockés en clair dans la base.
- `app.set('trust proxy', true)` : l'IP du client (`req.ip`) vient de l'en-tête `X-Forwarded-For`, donc le client peut la falsifier. On loggue l'IP réelle de la connexion pour pouvoir détecter la triche (voir section 5).
- Un accès à une page protégée sans être connecté répond aussi 302 (vers `/login`), comme un login raté (vers `/login?error=1`). On les distingue avec l'en-tête `Location`.
- Les fichiers statiques sont servis avant les sessions dans `app.js`. Un logger placé après les sessions ne les verra pas.

---

## 5. Schéma des logs

### Règles générales

- Une ligne JSON par événement.
- JSON à plat donc pas de sous-objet, pour que le décodeur JSON de Wazuh lise les champs correctement.
- Noms de champs en `snake_case`.
- Un champ sans valeur est égal à `null`.
- Le mot de passe n'est jamais écrit, ni dans `body` ni ailleurs. On le remplace par `[REDACTED]`.
- `query` et `body` sont coupés à 500 caractères.
- La ligne est produite avec `JSON.stringify`, qui transforme les retours à la ligne en texte (\n) comme ça un attaquant ne peut pas fabriquer de fausses lignes de log.

### Champs

| Champ | Type | Description | Exemple |
|---|---|---|---|
| `timestamp` | string | Date et heure UTC, format ISO 8601 | `2026-10-28T14:32:11.423Z` |
| `level` | string | `INFO`, `WARN` ou `ERROR` | `WARN` |
| `event_type` | string | Ce qui s'est passé (liste plus bas) | `auth_failure` |
| `source_ip` | string | IP calculée par Express (`req.ip`). Falsifiable via `X-Forwarded-For` | `1.2.3.4` |
| `remote_addr` | string | IP réelle de la connexion TCP (`req.socket.remoteAddress`). Non falsifiable. En Docker, c'est souvent l'IP du pont Docker (`172.x`) | `172.18.0.1` |
| `x_forwarded_for` | string ou null | En-tête `X-Forwarded-For` tel que reçu | `1.2.3.4` |
| `user` | string ou null | Voir « À propos du champ `user` » | `admin@supportdesk.local` |
| `endpoint` | string | Chemin demandé, sans les paramètres | `/login` |
| `method` | string | Méthode HTTP | `POST` |
| `status_code` | number | Code HTTP de la réponse | `302` |
| `query` | string ou null | Paramètres de l'URL | `status=open' OR 1=1--` |
| `body` | string ou null | Champs du formulaire envoyé, mot de passe masqué | `email=admin%40supportdesk.local&password=[REDACTED]` |
| `message` | string | Phrase lisible qui résume l'événement | `login failed` |
| `resource_owner` | string ou null | Nom d'utilisateur du créateur du ticket demandé. Sert à détecter l'IDOR (`user` différent de `resource_owner`) | `jdupont` |
| `user_agent` | string ou null | Outil qui envoie la requête | `curl/8.5.0` |

### À propos du champ `user`

| Situation | Valeur |
|---|---|
| Login raté | l'email tapé dans le formulaire. Ce n'est pas un utilisateur vérifié |
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
| `server_error` | ERROR | Erreur interne | Réponse 500 |
| `admin_fetch` | WARN | L'admin fait télécharger une URL au serveur | `POST /admin/fetch` (l'URL est dans `body`) |
| `http_request` | INFO | Toute autre requête | Par défaut |

Pour `resource_owner`, le logger ne peut pas le deviner : la route `/tickets/:id` et la route `/tickets/:id/export` le mettent dans `res.locals.resource_owner`, et le logger le lit à la fin de la réponse.

---

## 6. Métriques Prometheus

---

## 7. Conventions de détection (Wazuh)

---
## 8. Conventions d'attaque

---

## 9. Tests et trafic de référence

---

## 10. Dépôt Git

---
## 12. Décisions ouvertes

| Sujet | Question | Statut |
|---|---|---|
| Emplacement des logs | Sur la sortie standard (`docker logs`) ou dans un fichier partagé avec l'agent Wazuh via un volume ? | À tester |
| Source dans Wazuh | Le dashboard Wazuh affiche la source avec un champ nommé `srcip`. À vérifier lors du dry-run : faut-il renommer `source_ip` ou mapper le champ dans un décodeur ? | À tester |
| Place du logger | Avant `express.static` (voit les fichiers statiques mais pas encore la session) ou après les sessions (voit `user` mais pas les statiques) ? | À tester |

---
## 13. Changelog

| Version | Date | Auteur | Changement |
|---|---|---|---|
| 0.1.0 | `<16/10/2026>` | `Gabriel` | Version initiale (canva vide) |
| 0.1.1 | `<19/10/2026>` | `Gabriel` | Modif version de Node pour le lancement de l'app (voir `19-10-2026.md`)|
| 0.2.0 | `<28/10/2026>` | `Wally` | Sections 3, 4, 5 (variables, endpoints, schéma des logs) et 12 (décisions ouvertes). |