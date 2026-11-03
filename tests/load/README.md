# Tests de charge

Outil : `tests/load/load.js`, écrit avec `fetch` natif (comme `scripts/traffic.js`), aucune
dépendance à installer. N utilisateurs (comptes du seed) se connectent puis bouclent sur
`GET /tickets` sans pause pendant la durée donnée.

## Lancer

```bash
node tests/load/load.js
```

Variables (toutes optionnelles) :

| Variable | Défaut | Rôle |
|---|---|---|
| `BASE_URL` | `http://localhost:3000` | Cible |
| `USERS` | `20` | Nombre d'utilisateurs en parallèle |
| `DURATION_S` | `30` | Durée de la charge, en secondes |

Exemple pour une charge plus forte :

```bash
USERS=150 DURATION_S=30 node tests/load/load.js
```

## Résultats obtenus (exécution du 2026-11-02)

| Charge | Requêtes | Débit | Latence moy. | p50 | p95 | Max | Erreurs |
|---|---|---|---|---|---|---|---|
| 20 users / 15 s | 13 499 | 898,7 req/s | 22 ms | 21 ms | 28 ms | 145 ms | 0 / 13 499 (0 %) |
| 150 users / 30 s | 27 939 | 925,7 req/s | 160 ms | 51 ms | 90 ms | 3 397 ms | 0 / 27 939 (0 %) |

Constat : aucune erreur HTTP dans les deux cas, même à 150 utilisateurs simultanés. Le débit
plafonne autour de 900-925 req/s quelle que soit la charge envoyée (le serveur sature avant de
renvoyer des erreurs) ; la latence se dégrade fortement (p50 x2,4, max x23) mais reste disponible.
`supportdesk` tient donc la charge sans tomber, au prix d'un temps de réponse qui augmente.
