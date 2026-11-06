## Plan d'attaque 03 : Usurpation d'IP (IP spoofing)

Version 2.0, réécrit le 2026-11-05 avant toute exécution. Auteur : Gabriel.
Couvre la règle `100160` du contrat (section 7). Les autres vecteurs regroupés dans la version 1.0
de ce plan ne sont pas retenus ici.

### Règles d'engagement
- Attaque limitée à l'instance Docker locale du projet (`supportdesk`, port hôte 3000).
- Aucune cible tierce, aucun scan réseau hors périmètre.
- Un seul compte utilisé : `jdupont@supportdesk.local` (compte utilisateur du jeu de données).
- Requêtes en lecture seule : aucune charge destinée à modifier ou supprimer des données.
- Aucune attaque sur Prometheus, Grafana ni Wazuh.
- Lancement depuis un état propre (`docker compose up -d`, trafic de fond arrêté pendant l'essai).

### Périmètre
- `GET /dashboard` avec un en-tête `X-Forwarded-For` forgé.
- Observation en lecture seule : `app.log`, `/metrics`, dashboard Wazuh.

### Vecteurs d'attaque
- En-tête `X-Forwarded-For` falsifié par le client pour faire croire que la requête vient d'une
  autre source. `app.js` est configuré avec `app.set('trust proxy', true)` : Express fait confiance
  à n'importe quel proxy amont et calcule donc `req.ip` à partir de l'en-tête fourni par le client
  lui-même, qui devient entièrement contrôlable. Le détail de la faille (CVE `proxy-addr`
  GHSA-jqcg-44mw-7w3h, reproduction, impact et remédiation) est documenté dans `docs/ip_spoofing.md`.
- Le logger de l'application compare l'IP calculée (`source_ip`) à l'IP réelle de la connexion
  (`remote_addr`, préfixe `::ffff:` retiré) et écrit `ip_mismatch = true` quand elles diffèrent
  (CONTRACT.md section 5). C'est ce champ qui déclenche la détection.

La charge exacte est celle déjà utilisée par `tests/wazuh/e2e.sh` (fonction `atk_ip_spoof`) :
connexion via `POST /login`, puis `GET /dashboard` avec l'en-tête `X-Forwarded-For: 1.2.3.4`.

### Outils utilisés
- `curl`, avec un cookie de session obtenu par `POST /login`.

### Critères de succès
- Une alerte Wazuh de niveau >= 7, règle ID 100160 (usurpation d'IP), apparaît dans le dashboard
  dans la minute suivant la requête.
- L'alerte contient `data.event_type = request`, `data.ip_mismatch = true` et un `data.source_ip`
  (`1.2.3.4`) différent de l'IP réelle de la connexion (`data.remote_addr`).
- Preuve de l'impact : l'IP source retenue et loggée par l'application est intégralement celle de
  l'attaquant, sans authentification ni accès réseau particulier.

### Critères d'arrêt
- Arrêt nominal : l'alerte attendue est générée.
- Durée maximale : 2 minutes.
- Volume maximal : 10 requêtes (hors étape de connexion).
- Abandon si : l'application ne répond plus pendant 10 secondes, un statut 5xx apparaît, ou un effet
  hors périmètre est observé.

### Mapping MITRE ATT&CK
- Technique ciblée : T1036, Masquerading (falsification de la source perçue de la requête).
