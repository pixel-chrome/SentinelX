# Couverture des tests fonctionnels

## Endpoints testés

Les tests fonctionnels couvrent les 5 endpoints critiques définis dans le périmètre du projet.

| Endpoint | Tests réalisés |
|---|---|
| `POST /login` | Connexion réussie et refusée |
| `GET /logout` | Déconnexion réussie et sans session |
| `GET /tickets` | Accès autorisé et refusé |
| `GET /tickets/:id` | Ticket existant et inexistant |
| `GET /admin` | Administrateur, utilisateur classique et visiteur non connecté |

**Couverture : 5/5 endpoints critiques, soit 100 %.**

## Pourquoi ces 5 endpoints ?

Ces routes ont été retenues car elles correspondent aux fonctionnalités principales et aux contrôles d'accès les plus importants de SupportDesk :

- L'authentification et la gestion des sessions avec `/login` et `/logout`.
- La consultation des tickets avec `/tickets` et `/tickets/:id`.
- L'accès aux fonctionnalités réservées aux administrateurs avec `/admin`.

Les autres routes ne font pas partie des endpoints critiques définis dans le périmètre des tests fonctionnels. Elles ne sont donc pas comptabilisées dans ce taux de couverture. Cela permet de concentrer les tests sur les fonctionnalités essentielles plutôt que de tester indistinctement toutes les routes de l'application.

Certaines routes pourront toutefois être vérifiées dans les tests de sécurité si elles présentent un intérêt particulier. Par exemple, `/kb/view` sera concernée par le test de Path Traversal.

## Limites

Cette couverture indique que les 5 endpoints critiques disposent de tests fonctionnels. Elle ne signifie pas que toutes les fonctionnalités, tous les paramètres ou toutes les branches du code ont été testés.