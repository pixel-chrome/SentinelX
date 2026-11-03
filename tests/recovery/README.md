# Tests de reprise

Cas couverts (CONTRACT.md section 9) : arrêt/redémarrage d'un service, perte des sessions,
recréation de la base SQLite, cible Prometheus de nouveau `UP`, ce que Wazuh perd pendant une panne.

## Lancer les tests automatisés (cas 1 à 4)

Prérequis : la stack tourne (`docker compose up -d`), `curl`, `jq`, `docker`.

```bash
tests/recovery/recovery.sh
```

Le script arrête et redémarre `supportdesk` (`docker stop`/`start`, puis `rm -f -s -v` + `up -d`
pour forcer une vraie recréation du container) et vérifie à chaque étape le comportement attendu.
Sortie : une ligne `OK`/`FAIL` par vérification, code de retour non nul si une vérification échoue.

**Attention** : ce script arrête réellement `supportdesk` pendant quelques secondes. Ne pas le lancer
pendant une mesure de faux positifs ou une démo en cours.

## Résultats obtenus (exécution du 2026-11-02)

```
=== Cas 1 : docker compose stop/start d'un service ===
OK   supportdesk répond avant la panne (200)
OK   supportdesk inatteignable pendant la panne
=== Cas 2 : perte des sessions (en mémoire) ===
OK   session valide juste après connexion (200)
OK   session perdue après restart, redirection/refus (302)
=== Cas 3 : recréation de la base SQLite ===
OK   supportdesk remonte après recréation du container (200)
OK   compte admin du seed toujours valide après recréation (200)
=== Cas 4 : cible Prometheus de nouveau UP ===
OK   cible Prometheus 'supportdesk' de nouveau up
OK: 7  FAIL: 0
```

Détails :
- **Service arrêté/redémarré** : `docker stop`/`start` suffit, le container garde son système de
  fichiers. `supportdesk` répond de nouveau en quelques secondes, sans intervention.
- **Sessions** : stockées en mémoire (`express-session`, pas de store externe configuré). Un
  restart du conteneur les efface toutes : un utilisateur connecté doit se reconnecter.
- **Base SQLite** : `supportdesk.db` est **dans le système de fichiers du container**, pas dans un
  volume Docker. `docker stop`/`start` la conserve, mais tout ce qui recrée le container
  (`docker compose down`, `rm` du container, rebuild) la perd intégralement. Au redémarrage,
  `database/seed.js` la reconstruit automatiquement avec le jeu de données de départ (mêmes
  comptes, mêmes tickets) — mais tout ce qui avait été ajouté ou modifié depuis (nouveaux tickets,
  commentaires, mots de passe changés) est perdu sans retour en arrière possible.
- **Cible Prometheus** : repasse à `up` au scrape suivant (`scrape_interval: 5s`), donc en quelques
  secondes. Pendant une coupure plus courte que l'intervalle de scrape, Prometheus peut même ne
  jamais la voir passer à `down` (dernière valeur connue encore `up` au moment du scrape suivant) —
  une vraie coupure n'est détectée que si elle dure au moins un cycle de scrape complet.

## Cas 5 : ce que Wazuh perd pendant une panne du manager (test manuel)

Non automatisé dans `recovery.sh` (il faut que la stack Wazuh soit up, ce qui n'est pas garanti
chez tout le monde). Méthode et résultat réel, obtenus en arrêtant `sentinelx-wazuh.manager-1` :

1. Connexion normale, puis arrêt du manager : `docker stop sentinelx-wazuh.manager-1`.
2. Pendant la panne, rejouer une attaque qui doit déclencher une règle (ex. injection SQL dans
   l'URL, règle `100110`) : `supportdesk` et son logger continuent de tourner, la ligne est bien
   écrite dans `app.log` (confirmé : la ligne de la requête y est présente).
3. Redémarrage du manager : `docker start sentinelx-wazuh.manager-1`, attente ~15 s.
4. Vérification de `alerts.json` et de l'archive du jour (`/var/ossec/logs/alerts/2026/Nov/ossec-alerts-02.json`) :
   aucune alerte pour cette attaque, ni immédiatement ni après le redémarrage.

Constat : le collecteur de logs de Wazuh lit `app.log` à partir de sa position courante, pas depuis
le début. Tout ce qui est écrit dans `app.log` pendant que le manager est arrêté n'est jamais
rattrapé au redémarrage — ces événements ne généreront jamais d'alerte. Seuls `app.log` (persisté
via le volume `app_logs`) et les métriques `/metrics` gardent une trace de ce qui s'est passé
pendant la coupure ; Wazuh, lui, ne la voit jamais.

Conséquence pratique à documenter ailleurs (`docs/qualification.md` ou un runbook) : une panne du
manager Wazuh crée un angle mort de détection pour toute la durée de la panne, à combler en
consultant `app.log` ou les métriques a posteriori si une attaque est suspectée sur cette période.
