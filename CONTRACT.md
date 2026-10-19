# CONTRACT.md 
## 0. Méta

| Élément | Valeur |
|---|---|
| Version du contrat | `0.1.0` (draft) |
| Date | `16/10/2026` |
| Statut | ☐ Draft ☐ Validé par les 3 membres |
| Revue | Premier check-in |

### Règle de modification
- Toute modification passe par une PR validée par **les 3 membres (au moins un en vrai)**.
- Chaque changement est noté dans le [Changelog](#13-changelog) en bas du fichier.
- Un changement cassant (nom de champ, nom de métrique, port...) incrémente la version mineure et est annoncé à l'équipe.

### Rôles (temporaire)

| Rôle | Responsable | Périmètre | Référent pour les sections |
|---|---|---|---|
| A — Instrumentation | `Paul` | App, logs JSON, `/metrics`, tests fonctionnels, script de trafic | 4, 5, 6, 9 |
| B — Détection | `Wally` | Wazuh, décodeurs, règles, dashboard Wazuh | 2 (Wazuh), 7 |
| C — Attaques & monitoring | `Gabriel` | Attack Plans, runbooks, Prometheus, Grafana, rapport de qualification | 2 (Prometheus/Grafana), 8 |

Les rôles tournent à partir de l'étape 2 (chacun écrit au moins une règle et lance au moins une attaque).

---

## 1. Périmètre et règles du jeu

- Toutes les attaques visent **uniquement** l'instance Docker locale de l'application.
- Aucune cible tierce, aucun scan réseau hors périmètre.
- Les secrets ne sont jamais committés (voir section 3).

---

## 2. Architecture et infrastructure

---

## 3. Variables d'environnement


---

## 4. Endpoints de l'application

---

## 5. Schéma des logs

---

## 6. Métriques Prometheus

---

## 7. Conventions de détection (Wazuh)

---
## 8. Conventions d'attaque

---

## 9. Tests et trafic de référence

---

## 10. Dépôt Git

---
## 12. Décisions ouvertes

---
## 13. Changelog

| Version | Date | Auteur | Changement |
|---|---|---|---|
| 0.1.0 | `<16/10/2026>` | `Gabriel` | Version initiale (canva vide) |
| 0.1.1 | `<19/10/2026>` | `Gabriel` | Modif version de Node pour le lancement de l'app (voir `19-10-2026.md`)|