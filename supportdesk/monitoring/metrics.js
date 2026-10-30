const client = require('prom-client')

// Registre contenant les métriques de SupportDesk.
const register = new client.Registry()

register.setDefaultLabels({
    app: 'supportdesk'
})

// 1. Nombre total de requêtes HTTP.
const httpRequestsTotal = new client.Counter({
    name: 'supportdesk_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register]
})

// 2. Tentatives de connexion réussies ou échouées.
const authAttemptsTotal = new client.Counter({
    name: 'supportdesk_auth_attempts_total',
    help: 'Total number of authentication attempts',
    labelNames: ['result'],
    registers: [register]
})

// 3. Réponses HTTP en erreur.
const errorsTotal = new client.Counter({
    name: 'supportdesk_errors_total',
    help: 'Total number of HTTP error responses',
    labelNames: ['status_code'],
    registers: [register]
})

// 4. Durée des requêtes HTTP, en secondes.
const httpRequestDuration = new client.Histogram({
    name: 'supportdesk_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route'],
    registers: [register]
})

// 5. Nombre de sessions actives.
// Nous l'alimenterons uniquement si nous pouvons mesurer
// correctement les sessions dans l'application.
const activeSessions = new client.Gauge({
    name: 'supportdesk_active_sessions',
    help: 'Number of active user sessions',
    registers: [register]
})

module.exports = {
    register,
    httpRequestsTotal,
    authAttemptsTotal,
    errorsTotal,
    httpRequestDuration,
    activeSessions
}