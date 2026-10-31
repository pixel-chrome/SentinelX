# Dashboard Grafana : SupportDesk - Supervision

## À quoi il sert

Il montre en temps réel l'état et le comportement de l'application supportdesk, à partir des métriques exposées sur `/metrics` (définies dans `supportdesk/monitoring/metrics.js`). Il sert à repérer un comportement anormal, par exemple un brute force sur le login.

## Y accéder

1. Démarrer la stack : `docker compose up -d supportdesk prometheus grafana`
2. Ouvrir http://localhost:3001 (utilisateur `admin`, mot de passe `GF_SECURITY_ADMIN_PASSWORD` du `.env`)
3. Menu **Dashboards** > **SupportDesk - Supervision**

Le dashboard est chargé automatiquement depuis `grafana/dashboards/supportdesk.json` : rien à importer, et il est conservé après un `docker compose down`.

## Les panneaux

| Panneau | Ce qu'il montre | Métrique |
|---|---|---|
| Cible supportdesk | UP (1) si Prometheus arrive à lire `/metrics` | `up` |
| Sessions actives | Nombre de sessions ouvertes (reste à 0 tant que l'application ne l'alimente pas) | `supportdesk_active_sessions` |
| Requêtes par seconde | Débit global de l'application | `supportdesk_http_requests_total` |
| Taux d'erreur | Part des requêtes en erreur (orange > 5 %, rouge > 20 %) | `supportdesk_errors_total` |
| Échecs de login par seconde | Tentatives de connexion échouées (orange > 0,5, rouge > 2) | `supportdesk_auth_attempts_total` |
| Succès de login par seconde | Connexions réussies | `supportdesk_auth_attempts_total` |
| Requêtes par route | Quelles pages reçoivent du trafic | `supportdesk_http_requests_total` |
| Requêtes par code HTTP | Répartition 2xx, 3xx, 4xx, 5xx | `supportdesk_http_requests_total` |
| Latence p50 / p95 / p99 | Temps de réponse : 50 %, 95 % et 99 % des requêtes vont plus vite que la valeur affichée | `supportdesk_http_request_duration_seconds` |
| Latence moyenne par route | Temps total divisé par le nombre de requêtes | `supportdesk_http_request_duration_seconds` |
| Tentatives de login par résultat | Succès et échecs, côte à côte | `supportdesk_auth_attempts_total` |
| Erreurs par code HTTP | 404, 401, 500, etc. | `supportdesk_errors_total` |

## Lire le dashboard pendant une attaque

- **Brute force sur `/login`** : « Échecs de login par seconde » passe au orange puis au rouge, et la courbe `failure` de « Tentatives de login par résultat » monte nettement.
- **Scan de routes ou path traversal** : « Erreurs par code HTTP » (404) et « Requêtes par route » se remplissent de routes inhabituelles.
- **Application sous tension** : la latence p95 et p99 augmente, et le taux d'erreur monte.

## Bon à savoir

- Les compteurs avec labels n'apparaissent qu'après le premier événement : un panneau vide signifie souvent « pas encore d'événement », pas une panne.
- Les courbes sont des débits calculés sur 1 minute : elles réagissent avec 5 à 15 secondes de décalage (le scrape a lieu toutes les 5 s).
- Les requêtes dépendent des noms de métriques et de labels (`status_code`, `result`, `route`). Si `metrics.js` les change, les panneaux concernés se vident et doivent être mis à jour.
- Les liens de la page Targets de Prometheus (`supportdesk:3000`) ne s'ouvrent pas depuis le navigateur : ce nom n'existe que dans le réseau Docker. Utiliser `http://localhost:3000/metrics`.