# Plan d'attaque 03 : Path traversal, scan, SSRF, IDOR, usurpation d'IP

Version 1.0, rédigé le 2026-11-03. Couvre les 5 règles restantes du contrat (section 7) qui
n'avaient pas encore de plan dédié : `100120`, `100130`, `100140`, `100150`, `100160`. Regroupées
ici (volume réduit par attaque, vecteurs indépendants) plutôt qu'en 5 plans séparés, vu le délai.

### Règles d'engagement
- Attaque limitée à l'instance Docker locale du projet (`supportdesk`, port hôte 3000).
- Aucune cible tierce, aucun scan réseau hors périmètre.
- Comptes utilisés : uniquement ceux du jeu de données (`supportdesk/database/seed.js`).
- Lancement depuis un état propre (`docker compose up -d`, trafic de fond arrêté pendant l'essai).

### Périmètre
- `GET /kb/view` (paramètre `doc`), `GET /sx-scan-*` (pages inexistantes), `POST /admin/fetch`,
  `GET /tickets/:id`, `GET /dashboard` avec en-tête `X-Forwarded-For` forgé.
- Observation en lecture seule : `/metrics`, `app.log`, dashboard Wazuh.

### Vecteurs d'attaque
1. **Path traversal** : lecture d'un fichier hors du dossier de documentation via `../` dans `doc`.
2. **Scan** : 10 requêtes vers des pages inexistantes depuis la même source, en moins de 30 s.
3. **SSRF** : le compte admin fait récupérer une URL interne par le serveur via `/admin/fetch`.
4. **IDOR** : un utilisateur normal ouvre le ticket d'un autre utilisateur par simple changement
   d'ID dans l'URL.
5. **Usurpation d'IP** : en-tête `X-Forwarded-For` forgé pour faire croire que la requête vient
   d'une autre source (`app.js` fait confiance à cet en-tête, voir `docs/ip_spoofing.md`).

### Outils utilisés
- `curl` pour chaque vecteur (une commande par étape, voir runbook).

### Critères de succès
| Vecteur | Règle | Niveau min. | Délai max. | Champs attendus |
|---|---|---|---|---|
| Path traversal | `100120` | 10 | 1 min | `data.event_type=request`, `data.endpoint=/kb/view` |
| Scan | `100130` | 8 | 1 min | `data.event_type=not_found` |
| SSRF | `100140` | 8 | 1 min | `data.event_type=admin_fetch` |
| IDOR | `100150` | 8 | 1 min | `data.idor_suspect=true` |
| Usurpation d'IP | `100160` | 7 | 1 min | `data.ip_mismatch=true`, `data.source_ip` ≠ IP réelle |

### Critères d'arrêt
- Arrêt nominal : l'alerte attendue de chaque vecteur est générée.
- Durée maximale : 2 minutes par vecteur.
- Volume maximal : 10 requêtes par vecteur (hors étape de connexion).
- Abandon si : l'application ne répond plus pendant 10 secondes, un statut 5xx apparaît, ou un
  effet hors périmètre est observé (ex. fichier système lu en dehors du dossier `kb`).

### Mapping MITRE ATT&CK
| Vecteur | Technique |
|---|---|
| Path traversal | T1083, File and Directory Discovery (accès hors périmètre via traversée de chemin) |
| Scan | T1595, Active Scanning |
| SSRF | T1190, Exploit Public-Facing Application |
| IDOR | T1530, Data from Cloud Storage (accès à une ressource non autorisée par référence directe) |
| Usurpation d'IP | T1036, Masquerading (falsification de la source perçue) |
