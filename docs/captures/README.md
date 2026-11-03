# Captures d'écran Wazuh

Prises le 2026-11-03 dans le dashboard Wazuh (`https://localhost`), illustrent le mode d'emploi
de la partie 2 du README principal.

| Fichier | Contenu |
|---|---|
| `01-dashboard-vue-ensemble.png` | Dashboard Threat Hunting : total d'alertes, Top MITRE ATT&CK, évolution dans le temps |
| `02-liste-alertes-filtree.png` | Liste (onglet Events) filtrée sur `rule.id >= 100100 and rule.id <= 100199`, avec la chronologie en barres |
| `03-detail-alerte-sqli.png` | Détail d'une alerte `rule.id: 100110` (injection SQL dans l'URL), tous les champs `data.*` |
| `04-detail-alerte-bruteforce.png` | Détail d'une alerte `rule.id: 100101` (brute force, règle de fréquence) |
| `05-filtre-niveau-10.png` | Liste filtrée sur `rule.level >= 10` |
| `06-ruleset-test.png` | Server management → Ruleset Test : une ligne de log passée dans `wazuh-logtest`, Phase 3 (règle matchée) |
