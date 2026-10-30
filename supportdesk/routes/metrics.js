const express = require('express')
const router = express.Router()

const {
    register,
    activeSessions
} = require('../monitoring/metrics')

// Route pour récupérer les metrics.
router.get('/', async (req, res, next) => {
    try {
        // Récupération des sessions Express.
        const sessions = await new Promise((resolve, reject) => {
            req.sessionStore.all((err, sessions) => {
                if (err) {
                    return reject(err)
                }

                resolve(sessions || {})
            })
        })

        // Comptage des sessions authentifiées.
        const count = Object.values(sessions).filter(session => {
            return session.userId != null
        }).length

        // Mise à jour du Gauge.
        activeSessions.set(count)

        // Envoi des métriques à Prometheus.
        res.set('Content-Type', register.contentType)
        res.end(await register.metrics())

    } catch (error) {
        next(error)
    }
})

module.exports = router