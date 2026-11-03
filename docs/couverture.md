# Couverture des tests

Les 4 familles de tests prévues par le contrat (section 9) : fonctionnels, sécurité, charge,
reprise. Détail de chaque famille dans `tests/<famille>/README.md` quand il existe ; cette page
donne le taux de couverture et renvoie vers les résultats.

## 1. Tests fonctionnels

### Endpoints testés

Les tests fonctionnels couvrent les 5 endpoints critiques définis dans le périmètre du projet.

| Endpoint | Tests réalisés |
|---|---|
| `POST /login` | Connexion réussie et refusée |
| `GET /logout` | Déconnexion réussie et sans session |
| `GET /tickets` | Accès autorisé et refusé |
| `GET /tickets/:id` | Ticket existant et inexistant |
| `GET /admin` | Administrateur, utilisateur classique et visiteur non connecté |

**Couverture : 5/5 endpoints critiques, soit 100 %.**

### Pourquoi ces 5 endpoints ?

Ces routes ont été retenues car elles correspondent aux fonctionnalités principales et aux contrôles d'accès les plus importants de SupportDesk :

- L'authentification et la gestion des sessions avec `/login` et `/logout`.
- La consultation des tickets avec `/tickets` et `/tickets/:id`.
- L'accès aux fonctionnalités réservées aux administrateurs avec `/admin`.

Les autres routes ne font pas partie des endpoints critiques définis dans le périmètre des tests fonctionnels. Elles ne sont donc pas comptabilisées dans ce taux de couverture. Cela permet de concentrer les tests sur les fonctionnalités essentielles plutôt que de tester indistinctement toutes les routes de l'application.

Certaines routes pourront toutefois être vérifiées dans les tests de sécurité si elles présentent un intérêt particulier. Par exemple, `/kb/view` sera concernée par le test de Path Traversal.

### Limites

Cette couverture indique que les 5 endpoints critiques disposent de tests fonctionnels. Elle ne signifie pas que toutes les fonctionnalités, tous les paramètres ou toutes les branches du code ont été testés.

## 2. Tests de sécurité

4 suites dans `supportdesk/tests/security/`, une par cas prévu par le contrat (section 9) :
injection SQL sur `/tickets`, path traversal sur `/kb/view`, accès à `/admin` sans session, cookie
de session forgé. Détail de chaque cas dans `docs/security_test.md`.

**Couverture : 4/4 cas prévus par le contrat, soit 100 %.** Lancés avec les tests fonctionnels
(`npm test`, 7 suites / 15 tests au total) ou seuls (`npm test -- tests/security/`).

Limite : vérifie que les failles volontaires sont reproductibles, pas qu'elles sont corrigées
(l'application est volontairement vulnérable, voir `docs/qualification.md`).

## 3. Tests de charge

`tests/load/load.js` : N utilisateurs du seed en boucle sur `GET /tickets`. Résultats réels de deux
exécutions (20 et 150 utilisateurs) dans `tests/load/README.md` : 0 % d'erreur dans les deux cas,
débit plafonnant à ~900-925 req/s, latence dégradée mais service disponible.

Limite : un seul endpoint testé (`GET /tickets`), pas de montée en charge sur l'écriture (`/login`,
création de ticket) ni sur Wazuh/Prometheus eux-mêmes.

## 4. Tests de reprise

`tests/recovery/recovery.sh` : 4 cas automatisés (arrêt/redémarrage du service, perte des sessions
en mémoire, reconstruction de la base SQLite par le seed, retour `UP` de la cible Prometheus) + 1
cas manuel documenté (perte d'événements Wazuh pendant une panne de son manager, le logcollector ne
rattrapant jamais les lignes écrites pendant l'arrêt). Résultats réels (7/7 cas automatisés OK)
dans `tests/recovery/README.md`.

## Vue d'ensemble

| Famille | Couverture | Résultat |
|---|---|---|
| Fonctionnelle | 5/5 endpoints critiques | 15/15 tests passent (`npm test`) |
| Sécurité | 4/4 cas du contrat | inclus dans les 15/15 ci-dessus |
| Charge | 1 endpoint, 2 profils de charge | 0 % d'erreur jusqu'à 150 utilisateurs simultanés |
| Reprise | 4 cas automatisés + 1 cas manuel | 7/7 cas automatisés OK |