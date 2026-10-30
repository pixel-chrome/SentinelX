// Logging middleware skeleton -- implement to make SupportDesk observable.
//
// Mount in app.js AFTER the session middleware and BEFORE the routers:
//   app.use(require('./middleware/logger'))
//
// Emit structured events following the schema agreed in your CONTRACT.md.
// Which fields to capture, from which part of each request, and how to detect
// failed authentication are yours to determine.

const fs = require('fs')
const path = require('path')

const logDirectory = process.env.LOG_DIR ||'/var/log/supportdesk'
const logFile = path.join(logDirectory, 'app.log')

fs.mkdirSync(logDirectory, { recursive: true })

const logStream = fs.createWriteStream(logFile, { flags: 'a' })

// Ecrit les logs dans un fichier
function writeLog(event) {
    const line = JSON.stringify(event)

    console.log(line)
    logStream.write(line + '\n')
}

// Coupe une string ou un objet en string à une longueur maximale 500 caractères
function truncate(value, maxLength = 500) {
    if (value === undefined || value === null) {
        return null
    }
    // Un if, si c'est une string, on la garde telle quelle, sinon on stringify l'objet
    const text = typeof value === 'string'
        ? value
        : JSON.stringify(value)
    // Un if, si la longueur du texte est supérieure à maxLength, on le tronque, sinon on le retourne tel quel
    return text.length > maxLength
        ? text.slice(0, maxLength)
        : text
}

// Supprime les champs sensibles du body de la requête
function sanitizeBody(body) {
    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
        return null
    }

    const sanitized = { ...body }

    for (const key of Object.keys(sanitized)) {
        if (/password|passwd|secret|token/i.test(key)) {
            sanitized[key] = '[REDACTED]'
        }
    }

    return truncate(sanitized)
}

// Détecte les événements spécifiques à partir de la requête et de la réponse, retourne event_type, level et message
function detectEvent(req, res) {
    const status = res.statusCode
    const location = res.getHeader('Location')

    // Échec de connexion
    if (
        req.method === 'POST' &&
        req.path === '/login' &&
        location === '/login?error=1'
    ) {
        return {
            event_type: 'auth_failure',
            level: 'WARN',
            message: 'login failed'
        }
    }

    // Connexion réussie
    if (
        req.method === 'POST' &&
        req.path === '/login' &&
        location === '/dashboard'
    ) {
        return {
            event_type: 'auth_success',
            level: 'INFO',
            message: 'login successful'
        }
    }

    // Accès à une page protégée sans connexion
    if (
        status === 302 &&
        location === '/login' &&
        !(req.method === 'POST' && req.path === '/login')
    ) {
        return {
            event_type: 'auth_required',
            level: 'WARN',
            message: 'authentication required'
        }
    }

    // Accès interdit
    if (status === 403) {
        return {
            event_type: 'access_denied',
            level: 'WARN',
            message: 'access denied'
        }
    }

    // Ressource inexistante
    if (status === 404) {
        return {
            event_type: 'not_found',
            level: 'WARN',
            message: 'resource not found'
        }
    }

    // Erreur interne
    if (status >= 500) {
        return {
            event_type: 'error',
            level: 'ERROR',
            message: 'server error'
        }
    }

    // Téléchargement d'une URL par l'administrateur
    if (
        req.method === 'POST' &&
        req.path === '/admin/fetch'
    ) {
        return {
            event_type: 'admin_fetch',
            level: 'WARN',
            message: 'admin initiated URL fetch'
        }
    }

    // Événement par défaut
    return {
        event_type: 'request',
        level: 'INFO',
        message: 'HTTP request'
    }
}

// Formate les données pour le log, retourne null si vide ou tronque à maxLength
function formatData(data, maxLength = 500) {
    if (
        data === undefined ||
        data === null ||
        (typeof data === 'object' && Object.keys(data).length === 0) ||
        data === ''
    ) {
        return null
    }

    const text = typeof data === 'string'
        ? data
        : JSON.stringify(data)

    return text.length > maxLength
        ? text.slice(0, maxLength)
        : text
}

function logger(req, res, next) {
  res.on('finish', () => {
    const detected = detectEvent(req, res)
    const event = {
      timestamp: new Date().toISOString(),
      level: detected.level,
      event_type: detected.event_type,
      source_ip: req.ip || null,
      remote_addr: req.socket.remoteAddress || null,
      x_forwarded_for: req.headers['x-forwarded-for'] || null,

      user: detected.event_type === 'auth_failure'
          ? (req.body?.email || null)
          : (req.session?.username || null),
      endpoint: req.path,
      method: req.method,
      status_code: res.statusCode,

      // On récupère les paramètres de l'URL après le "?" si il y en a, sinon on met null
      query: formatData(
          req.originalUrl.includes('?')
              ? req.originalUrl.split('?')[1]
              : null
      ),
      body: formatData(sanitizeBody(req.body)),

      message: detected.message,
      resource_owner: res.locals.resource_owner || null,
      user_agent: req.headers['user-agent'] || null
    };

    writeLog(event);
  });
  next();
}

module.exports = logger
