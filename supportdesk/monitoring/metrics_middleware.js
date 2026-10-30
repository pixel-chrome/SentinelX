const {
    httpRequestsTotal,
    authAttemptsTotal,
    errorsTotal,
    httpRequestDuration
} = require('./metrics')

// Middleware chargé de mesurer les requêtes HTTP.
function metricsMiddleware(req, res, next) {

    // Pas les celle de la route /metrics
    if (req.path === '/metrics') {
        return next()
    }

    // On mémorise le début de la requête.
    const start = process.hrtime.bigint()

    res.on('finish', () => {

        // Calcul de la durée en secondes.
        const duration =
            Number(process.hrtime.bigint() - start) / 1e9

        // On récupère le modèle de route Express.
        // Exemple : /tickets/:id plutôt que /tickets/42.
        const route = req.route
            ? `${req.baseUrl || ''}${req.route.path}`
            : 'unmatched'

        const method = req.method
        const statusCode = String(res.statusCode)

        // 1 Compteur du nombre total de requêtes.
        httpRequestsTotal.inc({
            method,
            route,
            status_code: statusCode
        })

        // 2 La durée de la requête.
        httpRequestDuration.observe(
            { method, route },
            duration
        )

        // 3 Compteur des réponses HTTP en erreur.
        if (res.statusCode >= 400) {
            errorsTotal.inc({
                status_code: statusCode
            })
        }

        // 4 Compteur des tentatives de connexion.
        if (req.method === 'POST' && req.path === '/login') {

            const location = res.getHeader('Location')

            if (location === '/dashboard') {
                authAttemptsTotal.inc({
                    result: 'success'
                })
            } else if (location === '/login?error=1') {
                authAttemptsTotal.inc({
                    result: 'failure'
                })
            }
        }
        // 5 Compteur de sessions actives. (dans routes/metrics.js)
    })

    next()
}

module.exports = metricsMiddleware