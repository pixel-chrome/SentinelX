#!/usr/bin/env node
// Test de charge sur SupportDesk : N utilisateurs en parallèle qui bouclent sur GET /tickets
// pendant DURATION_S secondes, sans pause. Mesure la latence (p50/p95/max) et le taux d'erreur.
// Pas de dépendance externe (fetch natif, comme scripts/traffic.js) -- aucun npm install requis.
//
// Usage : node tests/load/load.js
// Variables : BASE_URL (http://localhost:3000), USERS (20), DURATION_S (30)

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const USERS = Number(process.env.USERS || 20)
const DURATION_S = Number(process.env.DURATION_S || 30)

// Comptes du seed (supportdesk/database/seed.js), hors admin.
const ACCOUNTS = [
  ['jdupont', 'User_123'], ['mmartin', 'User_123'], ['tchamberlain', 'User_123'],
  ['kwhite', 'User_123'], ['rlee', 'User_123'], ['aperez', 'User_123'],
  ['sbrown', 'User_123'], ['nlindqvist', 'User_123']
]

async function login (username) {
  const [, password] = ACCOUNTS.find(([u]) => u === username)
  const res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: `${username}@supportdesk.local`, password }),
    redirect: 'manual'
  })
  const cookie = res.headers.get('set-cookie')
  if (!cookie) throw new Error(`login échoué pour ${username}`)
  return cookie.split(';')[0]
}

async function worker (id, untilTs, latencies, errors) {
  const username = ACCOUNTS[id % ACCOUNTS.length][0]
  const cookie = await login(username)
  while (Date.now() < untilTs) {
    const start = Date.now()
    try {
      const res = await fetch(`${BASE_URL}/tickets`, { headers: { Cookie: cookie } })
      latencies.push(Date.now() - start)
      if (!res.ok) errors.count++
    } catch {
      latencies.push(Date.now() - start)
      errors.count++
    }
  }
}

function percentile (sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

async function main () {
  console.log(`Charge : ${USERS} utilisateurs en parallèle, ${DURATION_S} s, cible ${BASE_URL}/tickets`)
  const latencies = []
  const errors = { count: 0 }
  const untilTs = Date.now() + DURATION_S * 1000
  const start = Date.now()

  await Promise.all(
    Array.from({ length: USERS }, (_, i) => worker(i, untilTs, latencies, errors))
  )

  const elapsed = (Date.now() - start) / 1000
  const sorted = [...latencies].sort((a, b) => a - b)
  const total = latencies.length
  const avg = total ? latencies.reduce((a, b) => a + b, 0) / total : 0
  const errorRate = total ? (errors.count / total) * 100 : 0

  console.log('')
  console.log(`Requêtes envoyées : ${total} en ${elapsed.toFixed(1)} s (${(total / elapsed).toFixed(1)} req/s)`)
  console.log(`Latence moyenne   : ${avg.toFixed(0)} ms`)
  console.log(`Latence p50       : ${percentile(sorted, 50)} ms`)
  console.log(`Latence p95       : ${percentile(sorted, 95)} ms`)
  console.log(`Latence max       : ${sorted[sorted.length - 1] ?? 0} ms`)
  console.log(`Erreurs           : ${errors.count} / ${total} (${errorRate.toFixed(2)} %)`)
}

main()
