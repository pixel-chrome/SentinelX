# Qualification des alertes et taux de faux positifs

Règles concernées : `100100` à `100160` (voir `CONTRACT.md` section 7).

## Protocole

- Trafic : `scripts/traffic.js` (6 utilisateurs simulés, seed 42), aucune attaque pendant la mesure.
- Chauffe : 30 minutes, non comptées.
- Fenêtre de mesure : 2 heures.
- Taux de faux positifs = alertes sans vraie attaque / alertes totales dans la fenêtre.

## Mesure

| Élément | Valeur |
|---|---|
| Début de la chauffe | `31/10/2026 23:58` (heure locale) |
| Début de la fenêtre | `01/11/2026 00:28` |
| Fin de la fenêtre | `01/11/2026 02:28` |
| Commande | `DURATION_MIN=150 node scripts/traffic.js` |
| Requêtes envoyées (chauffe comprise) | 10 179, dont 19 échecs de login volontaires (fautes de frappe), 0 erreur réseau |
| Alertes dans la fenêtre (dénominateur) | 14, toutes `100100` niveau 3 |
| Faux positifs (numérateur) | 14 (aucune vraie attaque dans la fenêtre) |
| **Taux, toutes alertes** | `14 / 14 sur 2 h` |
| **Alertes de niveau 7 ou plus** | `0 / 0 sur 2 h` (aucune) |

## Détail des alertes

| Heure | Règle | Niveau | `source_ip` | Vraie attaque ? | Justification |
|---|---|---|---|---|---|
| 23:29 (UTC) | `100100` | 3 | `198.51.100.10` | Non | Faute de frappe simulée (3 % des sessions) |
| 23:39 | `100100` | 3 | `198.51.100.10` | Non | Faute de frappe simulée |
| 00:00 | `100100` | 3 | `198.51.100.13` | Non | Faute de frappe simulée |
| 00:05 | `100100` | 3 | `198.51.100.13` | Non | Faute de frappe simulée |
| 00:13 | `100100` | 3 | `198.51.100.15` | Non | Faute de frappe simulée |
| 00:25 | `100100` | 3 | `198.51.100.15` | Non | Faute de frappe simulée |
| 00:39 | `100100` | 3 | `198.51.100.13` | Non | Faute de frappe simulée |
| 00:40 | `100100` | 3 | `198.51.100.10` | Non | Faute de frappe simulée |
| 00:43 | `100100` | 3 | `198.51.100.10` | Non | Faute de frappe simulée |
| 00:50 | `100100` | 3 | `198.51.100.14` | Non | Faute de frappe simulée |
| 00:51 | `100100` | 3 | `198.51.100.11` | Non | Faute de frappe simulée |
| 01:03 | `100100` | 3 | `198.51.100.13` | Non | Faute de frappe simulée |
| 01:15 | `100100` | 3 | `198.51.100.15` | Non | Faute de frappe simulée |
| 01:27 | `100100` | 3 | `198.51.100.15` | Non | Faute de frappe simulée |

Les heures du tableau sont en UTC (heure locale moins 1 h). La fenêtre va de 23:28 à 01:28 UTC.

## Lecture des résultats

- La règle `100100` (niveau 3) enregistre chaque échec de login. C'est une règle de base qui sert de compteur pour `100101` (brute force) : elle n'est pas une alerte d'attaque. Elle compte pourtant dans le total, d'où `14 / 14` avec la définition du contrat.
- Aucune alerte de niveau 7 ou plus n'est apparue : ni brute force (`100101`), ni injection, ni IDOR, ni usurpation d'IP, ni scan.
- Les fautes de frappe sont isolées (jamais plus de 2 échecs d'affilée pour une même IP), donc le seuil de `100101` (5 échecs en 60 s) n'est jamais approché.
- Les quatre autres alertes du jour (`19010`, `19003`, `502`) viennent du système Wazuh lui-même et sont hors fenêtre.

## Ajustements faits après les premières mesures

| Règle | Problème | Correction |
|---|---|---|
| `100150` | Le script ouvrait des tickets au hasard, donc ceux d'autres utilisateurs (17 fausses alertes) | `traffic.js` n'ouvre que les tickets de la liste « mes tickets » |

## Limites

- Le trafic est simulé : il ne couvre pas tous les comportements réels (fautes de frappe répétées, recherches inhabituelles, navigation rapide).