# Tests fonctionnels - SupportDesk

## 1. Objectif

Les tests fonctionnels vérifient que les principales fonctionnalités de SupportDesk se comportent comme prévu à travers des requêtes HTTP.

Ils utilisent :
- **Jest** : exécution des tests.
- **Supertest** : simulation des requêtes HTTP.
- **SQLite en mémoire** : base de données isolée pour ne pas modifier les données réelles.

## 2. Organisation

Les tests sont répartis dans trois fichiers :

```text
tests/
└── functional/
    ├── auth.test.js
    ├── tickets.test.js
    └── admin.test.js
```

Les logs sont conservés dans `logs/tests/app.log`. Le dossier `logs/` est exclu du dépôt Git.

## 3. Périmètre

Les tests couvrent les cinq endpoints critiques définis dans le contrat :

| Endpoint | Fonctionnalité |
|---|---|
| `POST /login` | Connexion |
| `GET /logout` | Déconnexion |
| `GET /tickets` | Liste des tickets |
| `GET /tickets/:id` | Détails d'un ticket |
| `GET /admin` | Administration |

Chaque endpoint dispose de scénarios permettant de vérifier son fonctionnement ainsi que les cas de refus d'accès ou d'erreur.

Les tests vérifient notamment :
- La connexion et la déconnexion des utilisateurs.
- Le maintien et la destruction des sessions.
- L'accès à la liste et aux détails des tickets.
- Les droits d'accès à l'administration selon le rôle de l'utilisateur.

## 4. Limites et tests complémentaires

Les tests fonctionnels se concentrent sur les fonctionnalités critiques. Ils ne couvrent pas toutes les routes ni tous les cas possibles de l'application.

Ils ne mesurent pas non plus les performances, la résistance à une forte charge ou la récupération après une panne.

Les tentatives d'exploitation et les contrôles de sécurité sont traités séparément dans `tests/security/`, notamment :
- Les injections SQL.
- Le Path Traversal.
- L'accès sans authentification.
- La falsification de cookies de session.

## 5. Exécution

Pour lancer l'ensemble des tests :

```bash
npm test
```

Jest affiche les résultats des tests et signale les éventuelles erreurs.

## 6. Conclusion

Ces tests permettent de vérifier le bon fonctionnement des fonctionnalités essentielles de SupportDesk. Ils complètent les tests de sécurité, qui ont pour objectif de vérifier la résistance de l'application face à des comportements malveillants.