## Plan d'attaque 02 : Injection SQL sur la liste des tickets

Version 1.0, rédigé le 30-10-2026 avant toute exécution. Auteur : Wally.

### Règles d'engagement
- Attaque limitée à l'instance Docker locale du projet (`supportdesk`, port hôte 3000).
- Aucune cible tierce, aucun scan réseau hors périmètre.
- Un seul compte utilisé : `jdupont@supportdesk.local` (compte utilisateur du jeu de données).
- Requêtes en lecture seule : aucune charge destinée à modifier ou supprimer des données.
- Aucune attaque sur Prometheus, Grafana ni Wazuh.
- Lancement depuis un état propre (`docker compose up -d`, trafic de fond arrêté pendant l'essai).

### Périmètre
- `GET /tickets` (paramètres `status`, `priority`, `sort`).
- `POST /tickets/search` (champ `search`).
- Observation en lecture seule : `app.log`, `/metrics`, dashboard Wazuh.

### Vecteurs d'attaque
- Condition toujours vraie injectée dans le paramètre `status` de l'URL, pour faire ressortir tous les tickets.
- Requête combinée (jointure de type `UNION SELECT`) injectée dans l'URL, pour faire ressortir des colonnes d'une autre table.
- Même type d'injection dans le champ `search` du formulaire de recherche.

Les charges exactes sont celles déjà utilisées par `tests/wazuh/e2e.sh` (fonctions `atk_sqli_url` et `atk_sqli_body`) et par les cas `100110`/`100111` de `tests/wazuh/logtest-cases.md`.

### Outils utilisés
- `curl`, avec un cookie de session obtenu par `POST /login`.
- `sqlmap` en variante (une seule commande, `--batch`, niveau 1), si le temps le permet.

### Critères de succès
- Une alerte Wazuh de niveau >= 10, règle ID 100110 (injection dans l'URL), apparaît dans le dashboard dans la minute suivant la requête.
- Pour la requête sur le formulaire : règle ID 100111, niveau >= 10, dans le même délai.
- L'alerte contient `data.event_type = request`, `data.source_ip` et `data.endpoint = /tickets` (ou `/tickets/search`).
- Preuve de l'impact : la requête avec condition toujours vraie renvoie plus de tickets que la liste normale de `jdupont`.

### Critères d'arrêt
- Arrêt nominal : les deux alertes attendues sont générées.
- Durée maximale : 3 minutes.
- Volume maximal : 20 requêtes avec `curl`, 200 avec `sqlmap`.
- Abandon si : l'application ne répond plus pendant 10 secondes, un statut 5xx apparaît, ou un effet hors périmètre est observé.

### Mapping MITRE ATT&CK
- Technique ciblée : T1190, Exploit Public-Facing Application.
