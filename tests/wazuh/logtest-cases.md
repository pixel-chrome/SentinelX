# Cas de test Wazuh logtest

Coller chaque ligne dans **Server management → Ruleset Test** (`wazuh-logtest`) du dashboard. Format : celui du logger (`CONTRACT.md` section 5).
Pour les cas « coller N fois », rester dans la même session logtest : Wazuh garde les événements en mémoire pour les règles de fréquence.

## 100100 - Échec de login isolé
Attendu : 3 (alerte simple)

```json
{"timestamp":"2026-10-29T14:32:11.423Z","level":"WARN","event_type":"auth_failure","source_ip":"203.0.113.7","remote_addr":"172.18.0.1","x_forwarded_for":null,"user":"x@supportdesk.local","endpoint":"/login","method":"POST","status_code":302,"query":null,"body":"{\"email\":\"x@supportdesk.local\",\"password\":\"[REDACTED]\"}","message":"login failed","resource_owner":null,"user_agent":"curl/8.5.0"}
```

## 100101 - Brute force : coller la MÊME ligne 5 fois d'affilée (même session logtest, < 60 s)
Attendu : 10 à la 5e ligne

```json
{"timestamp":"2026-10-29T14:32:11.423Z","level":"WARN","event_type":"auth_failure","source_ip":"203.0.113.7","remote_addr":"172.18.0.1","x_forwarded_for":null,"user":"admin@supportdesk.local","endpoint":"/login","method":"POST","status_code":302,"query":null,"body":"{\"email\":\"admin@supportdesk.local\",\"password\":\"[REDACTED]\"}","message":"login failed","resource_owner":null,"user_agent":"curl/8.5.0"}
```

## 100110 - SQLi dans l'URL
Attendu : 10

```json
{"timestamp":"2026-10-29T14:32:11.423Z","level":"INFO","event_type":"request","source_ip":"203.0.113.7","remote_addr":"172.18.0.1","x_forwarded_for":null,"user":"jdupont","endpoint":"/tickets","method":"GET","status_code":200,"query":"status=open'%20OR%201=1--","body":null,"message":"HTTP request","resource_owner":null,"user_agent":"curl/8.5.0"}
```

## 100110 - SQLi UNION dans l'URL
Attendu : 10

```json
{"timestamp":"2026-10-29T14:32:11.423Z","level":"INFO","event_type":"request","source_ip":"203.0.113.7","remote_addr":"172.18.0.1","x_forwarded_for":null,"user":"jdupont","endpoint":"/tickets","method":"GET","status_code":200,"query":"sort=id%20UNION%20SELECT%201,2,3--","body":null,"message":"HTTP request","resource_owner":null,"user_agent":"curl/8.5.0"}
```

## 100111 - SQLi dans le body
Attendu : 10

```json
{"timestamp":"2026-10-29T14:32:11.423Z","level":"INFO","event_type":"request","source_ip":"203.0.113.7","remote_addr":"172.18.0.1","x_forwarded_for":null,"user":"jdupont","endpoint":"/tickets/search","method":"POST","status_code":200,"query":null,"body":"{\"search\":\"x' OR 1=1--\"}","message":"HTTP request","resource_owner":null,"user_agent":"curl/8.5.0"}
```

## 100120 - Path traversal en clair
Attendu : 10

```json
{"timestamp":"2026-10-29T14:32:11.423Z","level":"INFO","event_type":"request","source_ip":"203.0.113.7","remote_addr":"172.18.0.1","x_forwarded_for":null,"user":"jdupont","endpoint":"/kb/view","method":"GET","status_code":200,"query":"doc=../../etc/passwd","body":null,"message":"HTTP request","resource_owner":null,"user_agent":"curl/8.5.0"}
```

## 100120 - Path traversal encodé
Attendu : 10

```json
{"timestamp":"2026-10-29T14:32:11.423Z","level":"INFO","event_type":"request","source_ip":"203.0.113.7","remote_addr":"172.18.0.1","x_forwarded_for":null,"user":"jdupont","endpoint":"/kb/view","method":"GET","status_code":200,"query":"doc=%2e%2e%2f%2e%2e%2fetc/passwd","body":null,"message":"HTTP request","resource_owner":null,"user_agent":"curl/8.5.0"}
```

## 100130 - Scan : coller la MÊME ligne 10 fois d'affilée (< 30 s). Les 9 premières : 100129 niveau 1, pas d'alerte
Attendu : 8 à la 10e ligne

```json
{"timestamp":"2026-10-29T14:32:11.423Z","level":"WARN","event_type":"not_found","source_ip":"203.0.113.7","remote_addr":"172.18.0.1","x_forwarded_for":null,"user":null,"endpoint":"/backup.zip","method":"GET","status_code":404,"query":null,"body":null,"message":"resource not found","resource_owner":null,"user_agent":"curl/8.5.0"}
```

## 100140 - SSRF
Attendu : 8

```json
{"timestamp":"2026-10-29T14:32:11.423Z","level":"WARN","event_type":"admin_fetch","source_ip":"203.0.113.7","remote_addr":"172.18.0.1","x_forwarded_for":null,"user":"admin","endpoint":"/admin/fetch","method":"POST","status_code":302,"query":null,"body":"{\"url\":\"http://127.0.0.1:9200\"}","message":"admin initiated URL fetch","resource_owner":null,"user_agent":"curl/8.5.0"}
```

## AUCUNE - Négatif : requête normale (ne doit déclencher aucune de nos règles)
Attendu : aucune règle 1001xx

```json
{"timestamp":"2026-10-29T14:32:11.423Z","level":"INFO","event_type":"request","source_ip":"203.0.113.7","remote_addr":"172.18.0.1","x_forwarded_for":null,"user":"jdupont","endpoint":"/tickets","method":"GET","status_code":200,"query":"status=open","body":null,"message":"HTTP request","resource_owner":null,"user_agent":"curl/8.5.0"}
```

## AUCUNE - Négatif : champ absent (query = null) - la règle SQLi ne peut pas matcher
Attendu : aucune règle 1001xx

```json
{"timestamp":"2026-10-29T14:32:11.423Z","level":"INFO","event_type":"request","source_ip":"203.0.113.7","remote_addr":"172.18.0.1","x_forwarded_for":null,"user":"jdupont","endpoint":"/dashboard","method":"GET","status_code":200,"query":null,"body":null,"message":"HTTP request","resource_owner":null,"user_agent":"curl/8.5.0"}
```

## AUCUNE - Négatif : 'doc' légitime dans /kb/view
Attendu : aucune règle 1001xx

```json
{"timestamp":"2026-10-29T14:32:11.423Z","level":"INFO","event_type":"request","source_ip":"203.0.113.7","remote_addr":"172.18.0.1","x_forwarded_for":null,"user":"jdupont","endpoint":"/kb/view","method":"GET","status_code":200,"query":"doc=guide.html","body":null,"message":"HTTP request","resource_owner":null,"user_agent":"curl/8.5.0"}
```
