## Plan d'attaque 01 : Brute force du login

Version 1.0, rédigé le 30-10-2026 avant toute exécution. Auteur : Gabriel.

### Règles d'engagement
- Attaque limitée à l'instance Docker locale du projet (`supportdesk`, port hôte 3000).
- Aucune cible tierce, aucun scan réseau hors périmètre.
- Un seul compte ciblé : un compte de démonstration créé par le jeu de données de l'application.
- Volume plafonné (voir critères d'arrêt). Aucune attaque sur les services Prometheus, Grafana ou Wazuh.
- Lancement depuis un état propre (`docker compose up -d`, trafic de fond arrêté pendant l'essai).

### Périmètre
- `POST /login` (champs `email` et `password`).
- Observation en lecture seule : `/metrics`, `app.log`, dashboard Wazuh.

### Vecteurs d'attaque
- Brute force par dictionnaire sur un seul compte (password guessing).
- Variante en démonstration live : même attaque avec `X-Forwarded-For` falsifié pour montrer la limite de la règle (traitée dans un plan ultérieur ou en bonus).

### Outils utilisés
- `hydra` (une seule commande, module `http-post-form`).
- `curl` pour la vérification manuelle d'un échec et d'un succès.
- Liste de mots de passe : 100 entrées, versionnée dans `scripts/`.

### Critères de succès
- Une alerte Wazuh de niveau >= 10, règle ID 100101 (brute force login), apparaît dans le dashboard dans les 2 minutes suivant le lancement.
- L'alerte contient `data.event_type = auth_failure`, `data.source_ip` et `data.endpoint = /login`.
- La métrique `supportdesk_auth_attempts_total{result="failure"}` augmente d'au moins 20 pendant l'attaque.

### Critères d'arrêt
- Arrêt nominal : l'alerte attendue est générée.
- Durée maximale : 3 minutes.
- Volume maximal : 200 tentatives.
- Abandon si : l'application ne répond plus pendant 10 secondes, un statut 5xx apparaît, ou un effet hors périmètre est observé.

### Mapping MITRE ATT&CK
- Technique ciblée : T1110.001, Brute Force : Password Guessing (technique parente T1110, Brute Force).