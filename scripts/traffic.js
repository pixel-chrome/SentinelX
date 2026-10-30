#!/usr/bin/env node
// Trafic de référence SupportDesk : simule des employés qui utilisent un helpdesk.
// Sert à mesurer le taux de faux positifs de Wazuh (aucune attaque ici).
//
// Usage : node scripts/traffic.js
// Variables : BASE_URL (http://localhost:3000), USERS (6), DURATION_MIN (30, 0 = jusqu'à Ctrl+C),
//             THINK_MIN_S (2), THINK_MAX_S (8), SEED (42)
//
// Chaque utilisateur virtuel a sa propre IP (en-tête X-Forwarded-For) : l'application la loggue
// dans source_ip, donc les règles de fréquence de Wazuh comptent par utilisateur, comme en vrai.

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const USERS = Number(process.env.USERS || 6)
const DURATION_MIN = Number(process.env.DURATION_MIN || 30)
const THINK_MIN_S = Number(process.env.THINK_MIN_S || 2)
const THINK_MAX_S = Number(process.env.THINK_MAX_S || 8)
const SEED = Number(process.env.SEED || 42)

// Comptes du seed (supportdesk/database/seed.js). Pas l'admin : on simule des employés.
const ACCOUNTS = [
  ['jdupont', 'User_123'], ['mmartin', 'User_123'], ['tchamberlain', 'User_123'],
  ['kwhite', 'User_123'], ['rlee', 'User_123'], ['aperez', 'User_123'],
  ['sbrown', 'User_123'], ['nlindqvist', 'User_123']
]
const SEARCHES = ['printer', 'vpn', 'outlook', 'wifi', 'laptop', 'access', 'network', 'screen']
const STATUSES = ['open', 'in_progress', 'resolved', 'closed']
const PRIORITIES = ['urgent', 'high', 'medium', 'low']
const KB_DOCS = ['vpn-guide.html', 'password-policy.html', 'badge-access-procedure.html']
const COMMENTS = ['Thanks, I will check this today.', 'Still happening on my side.', 'Issue solved after restart.', 'Can someone call me back?']
const THEMES = ['light', 'dark']

// Générateur pseudo-aléatoire reproductible (mulberry32) : même SEED = même trafic.
let state = SEED >>> 0
function rand () {
  state = (state + 0x6D2B79F5) >>> 0
  let t = state
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = (list) => list[Math.floor(rand() * list.length)]
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const think = () => sleep((THINK_MIN_S + rand() * (THINK_MAX_S - THINK_MIN_S)) * 1000)

const stats = { requests: 0, byStatus: {}, loginFailures: 0, errors: 0 }
let running = true

class VirtualUser {
  constructor (index) {
    const [username, password] = ACCOUNTS[index % ACCOUNTS.length]
    this.username = username
    this.password = password
    this.email = `${username}@supportdesk.local`
    this.ip = `198.51.100.${10 + index}`
    this.cookie = ''
    this.lastBody = ''
    this.myTickets = []
  }

  async request (method, path, form) {
    const headers = { 'X-Forwarded-For': this.ip, 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Firefox/126.0' }
    if (this.cookie) headers.Cookie = this.cookie
    let body
    if (form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      body = new URLSearchParams(form).toString()
    }
    try {
      const res = await fetch(BASE_URL + path, { method, headers, body, redirect: 'manual' })
      this.lastBody = Buffer.from(await res.arrayBuffer()).toString('utf8')
      const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : []
      if (setCookie.length > 0) this.cookie = setCookie.map((c) => c.split(';')[0]).join('; ')
      stats.requests++
      stats.byStatus[res.status] = (stats.byStatus[res.status] || 0) + 1
      return res
    } catch (err) {
      stats.errors++
      return null
    }
  }

  async login (password) {
    const res = await this.request('POST', '/login', { email: this.email, password })
    const ok = res && res.headers.get('location') === '/dashboard'
    if (!ok) stats.loginFailures++
    return ok
  }

  // Ouverture de session : parfois une faute de frappe, puis le bon mot de passe.
  // Un utilisateur distrait fait 1 faute (3 % des sessions), jamais plus de 2.
  async startSession () {
    await this.request('GET', '/login')
    await think()
    if (rand() < 0.03) {
      await this.login(this.password + 'x')
      await think()
    }
    return this.login(this.password)
  }

  // Un employé n'ouvre que ses propres tickets (sinon Wazuh le prend pour un IDOR).
  // Les identifiants viennent de la liste « mes tickets », comme dans un vrai navigateur.
  async loadMyTickets () {
    const res = await this.request('GET', '/tickets?view=mine')
    const ids = [...this.lastBody.matchAll(/href="\/tickets\/(\d+)"/g)].map((m) => m[1])
    this.myTickets = [...new Set(ids)]
    return res
  }

  async step () {
    const roll = rand() * 100
    if (roll < 20) return this.request('GET', '/tickets')
    if (roll < 35) return this.request('GET', `/tickets?status=${pick(STATUSES)}&priority=${pick(PRIORITIES)}`)
    if (roll < 40 || this.myTickets.length === 0) return this.loadMyTickets()
    if (roll < 65) return this.request('GET', `/tickets/${pick(this.myTickets)}`)
    if (roll < 75) return this.request('POST', '/tickets/search', { search: pick(SEARCHES) })
    if (roll < 83) return this.request('GET', '/kb')
    if (roll < 90) return this.request('GET', `/kb/view?doc=${pick(KB_DOCS)}`)
    if (roll < 94) return this.request('GET', '/dashboard')
    if (roll < 97) return this.request('GET', '/profile')
    if (roll < 99) return this.request('POST', '/profile', { display_name: this.username, theme: pick(THEMES) })
    return this.request('POST', `/tickets/${pick(this.myTickets)}/comment`, { content: pick(COMMENTS) })
  }

  async run () {
    while (running) {
      if (!(await this.startSession())) { await sleep(5000); continue }
      const actions = 8 + Math.floor(rand() * 15)
      for (let i = 0; i < actions && running; i++) {
        await think()
        await this.step()
      }
      await this.request('GET', '/logout')
      this.cookie = ''
      this.myTickets = []
      await sleep((5 + rand() * 20) * 1000)
    }
  }
}

function report (label) {
  const statuses = Object.entries(stats.byStatus).map(([s, n]) => `${s}:${n}`).join(' ')
  console.log(`[${new Date().toISOString()}] ${label} requêtes=${stats.requests} échecs_login=${stats.loginFailures} erreurs_réseau=${stats.errors} statuts=${statuses}`)
}

async function main () {
  console.log(`Trafic helpdesk : cible=${BASE_URL} utilisateurs=${USERS} durée=${DURATION_MIN || 'illimitée'} min seed=${SEED}`)
  const users = Array.from({ length: USERS }, (_, i) => new VirtualUser(i))
  const ticker = setInterval(() => report('en cours'), 60000)
  const stop = () => { running = false }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  if (DURATION_MIN > 0) setTimeout(stop, DURATION_MIN * 60000)
  // Démarrage échelonné : les utilisateurs n'arrivent pas tous à la même seconde.
  await Promise.all(users.map(async (user, i) => { await sleep(i * 3000); await user.run() }))
  clearInterval(ticker)
  report('terminé')
}

main()
