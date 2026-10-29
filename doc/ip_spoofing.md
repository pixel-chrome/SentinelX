## Faille — Spoofing de `source_ip` via `X-Forwarded-For`

### Découverte

En lançant `npm audit`, l'application signale une vulnérabilité critique dans `proxy-addr` (dépendance d'Express) : [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), liée à une mauvaise gestion des adresses IPv4 mappées en IPv6 lors de l'évaluation des sous-réseaux de confiance.

Inspection du code (`app.js:19`) :

```js
app.set('trust proxy', true)
```

Cette configuration fait confiance à **n'importe quel proxy amont**, donc à l'en-tête `X-Forwarded-For` fourni par le client lui-même. Combinée à la CVE, elle rend le calcul de `req.ip` totalement falsifiable.

### Reproduction

1. Ajouter un log temporaire dans `app.js` :
```js
app.use((req, res, next) => {
  console.log('DEBUG req.ip =', req.ip, '| XFF header =', req.headers['x-forwarded-for']);
  next();
});
```
2. Envoyer une requête avec un en-tête forgé :
```bash
curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:3000/login
```
3. Résultat observé dans les logs serveur :
DEBUG req.ip = 1.2.3.4 | XFF header = 1.2.3.4


→ L'IP source est intégralement contrôlée par l'attaquant, sans authentification ni accès réseau particulier.

### Impact

- **Falsification du champ `source_ip`** dans les futurs logs applicatifs (champ prévu dans le contrat technique).
- **Contournement des règles de détection basées sur l'IP source** : un brute-force d'authentification peut faire varier `X-Forwarded-For` à chaque tentative pour empêcher une règle Wazuh de seuil (« N échecs depuis la même IP ») de se déclencher.
- **Fiabilité compromise** pour tout enrichissement futur basé sur l'IP (GeoIP, réputation, blocage).
- Le problème vient de deux facteurs cumulés : la mauvaise configuration applicative (`trust proxy: true`) et la CVE de `proxy-addr` qui aggrave le traitement des IPs de confiance.

### Remédiation possible

```js
app.set('trust proxy', 1); // ou une IP/sous-réseau précis du reverse proxy réel
```
```bash
npm install proxy-addr@latest
```