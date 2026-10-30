# SupportDesk — Prometheus Metrics

## 1. Présentation

SupportDesk expose plusieurs métriques au format Prometheus afin de suivre l'activité HTTP, les authentifications, les erreurs et les sessions utilisateur.

Les métriques sont accessibles via l'endpoint :

```http
GET /metrics
```

Elles sont ensuite récupérées par Prometheus pour permettre leur exploitation et leur visualisation dans Grafana.

## 2. Liste des métriques

| Métrique | Type | Description |
|---|---|---|
| `supportdesk_http_requests_total` | Counter | Nombre total de requêtes HTTP reçues. |
| `supportdesk_auth_attempts_total` | Counter | Nombre de tentatives d'authentification réussies ou échouées. |
| `supportdesk_errors_total` | Counter | Nombre de réponses HTTP en erreur (codes 4xx et 5xx). |
| `supportdesk_http_request_duration_seconds` | Histogram | Durée de traitement des requêtes HTTP, en secondes. |
| `supportdesk_active_sessions` | Gauge | Nombre de sessions utilisateur authentifiées enregistrées. |

## 3. Détail des métriques

### 3.1 HTTP Requests Total

**Type : Counter**

Cette métrique comptabilise le nombre total de requêtes HTTP traitées par SupportDesk.

Elle utilise trois labels :
- `method` : méthode HTTP (GET, POST, DELETE...).
- `route` : route Express concernée.
- `status_code` : code de réponse HTTP.

Exemple :

```text
supportdesk_http_requests_total{method="GET",route="/login",status_code="200"} 15
```

Les requêtes vers `/metrics` ne sont pas comptabilisées.

### 3.2 Authentication Attempts Total

**Type : Counter**

Cette métrique comptabilise les tentatives de connexion à l'application.

Elle utilise un label :
- `result` : résultat de la tentative (`success` ou `failure`).

Exemples :

```text
supportdesk_auth_attempts_total{result="success"} 8
supportdesk_auth_attempts_total{result="failure"} 3
```

Elle permet de suivre les connexions réussies et les échecs d'authentification.

### 3.3 Errors Total

**Type : Counter**

Cette métrique comptabilise les réponses HTTP dont le code est supérieur ou égal à 400.

Elle utilise un label :
- `status_code` : code HTTP retourné (404, 403, 500...).

Exemple :

```text
supportdesk_errors_total{status_code="404"} 4
```

Elle permet de surveiller les erreurs rencontrées par les utilisateurs.

### 3.4 HTTP Request Duration

**Type : Histogram**

Cette métrique mesure le temps nécessaire au traitement des requêtes HTTP.

Elle utilise deux labels :
- `method` : méthode HTTP.
- `route` : route Express concernée.

Exemple :

```text
supportdesk_http_request_duration_seconds_count{method="GET",route="/login"} 15
supportdesk_http_request_duration_seconds_sum{method="GET",route="/login"} 0.42
```

L'histogramme permet notamment d'analyser :
- Le nombre de requêtes mesurées.
- Le temps total de traitement.
- La distribution des durées grâce aux buckets.

Les durées sont exprimées en secondes.

### 3.5 Active Sessions

**Type : Gauge**

Cette métrique mesure le nombre de sessions utilisateur authentifiées présentes dans le stockage Express.

À chaque appel de `/metrics` :

1. L'application récupère les sessions enregistrées avec `req.sessionStore.all()`.
2. Elle conserve uniquement celles qui possèdent un `userId`.
3. Elle compte ces sessions.
4. Elle actualise la valeur du Gauge.

Exemple :

```text
supportdesk_active_sessions 2
```

Contrairement à un Counter, un Gauge peut augmenter et diminuer.

**Limite :** cette métrique compte les sessions authentifiées encore enregistrées, et non uniquement les utilisateurs actifs à cet instant. Une session peut rester présente après la fermeture du navigateur jusqu'à son expiration ou sa suppression.

## 4. Types de métriques Prometheus

Deux types principaux sont utilisés dans SupportDesk :

| Type | Fonctionnement | Utilisation |
|---|---|---|
| Counter | Valeur qui augmente uniquement (sauf réinitialisation). | Requêtes, authentifications, erreurs. |
| Gauge | Valeur pouvant augmenter ou diminuer. | Sessions actives. |
| Histogram | Mesure et répartit des valeurs dans des intervalles. | Durée des requêtes HTTP. |

## 5. Accès aux métriques

Pour consulter les métriques manuellement :

```bash
curl http://localhost:3000/metrics
```

Pour filtrer une métrique précise :

```bash
curl -s http://localhost:3000/metrics | grep supportdesk_active_sessions
```

Prometheus utilise également cet endpoint pour récupérer périodiquement les données de SupportDesk.