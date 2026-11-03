# Security Tests

## Objectif

Les tests de sécurité vérifient le comportement de l'application SupportDesk face à plusieurs entrées ou accès non autorisés.

L'objectif n'est pas de corriger les vulnérabilités, car l'application est volontairement vulnérable, mais de vérifier qu'elles peuvent être reproduites dans l'environnement de test.

## Tests réalisés

Les tests sont situés dans `supportdesk/tests/security/`.

### 1. SQL Injection

**Endpoint :** `GET /tickets`

Un payload SQL est injecté dans le paramètre `status`.

Le test vérifie que le filtre peut être contourné et que des tickets normalement exclus apparaissent dans les résultats.

### 2. Path Traversal

**Endpoint :** `GET /kb/view`

Le paramètre `doc` contient une séquence `../`.

Le test vérifie si l'application permet d'accéder à un fichier situé en dehors du dossier prévu pour les documents.

### 3. Accès sans authentification

**Endpoint :** `GET /admin`

Une requête est envoyée sans session utilisateur.

Le test vérifie que l'accès est refusé et que l'utilisateur est redirigé vers `/login` (HTTP 302).

### 4. Cookie de session falsifié

**Endpoint :** `GET /admin`

Un cookie de session contenant une signature invalide est envoyé.

Le test vérifie que l'application rejette le cookie et redirige l'utilisateur vers `/login`.

## Exécution

Pour lancer les tests de sécurité :

```bash
npm test -- tests/security/
```

Les tests utilisent Jest et Supertest. Une base SQLite en mémoire est utilisée afin d'isoler les tests de la base de données réelle.

## Interprétation des résultats

Un test réussi signifie que le comportement attendu a été reproduit.

Pour les tests SQL Injection et Path Traversal, cela signifie que la vulnérabilité est présente et exploitable dans l'environnement de test.

Pour les tests d'accès sans session et de cookie falsifié, cela signifie que les protections d'authentification rejettent les accès non autorisés.

**Important :** ces tests sont réalisés exclusivement sur l'application SupportDesk locale, volontairement vulnérable.