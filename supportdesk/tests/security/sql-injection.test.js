const path = require('path')

process.env.DB_PATH = ':memory:'
process.env.SESSION_SECRET = 'test-secret'
process.env.LOG_DIR = path.join(__dirname, '../../logs/tests')

const request = require('supertest')
const app = require('../../app')
const db = require('../../database/db')

test('Test Sécurité - injection SQL /tickets', async () => {
  const agent = request.agent(app)

  // Connexion avec User
  await agent.post('/login').type('form').send({
    email: 'jdupont@supportdesk.local',
    password: 'User_123'
  })

  // Requête normale : uniquement les tickets "open"
  const normalResponse = await agent
    .get('/tickets')
    .query({ status: 'open' })

  // Requête avec injection SQL
  const injectionResponse = await agent
    .get('/tickets')
    .query({ status: "' OR '1'='1" })

  // Le ticket "resolved" ne doit pas apparaître dans les résultats normaux
  expect(normalResponse.text).not.toContain(
    'Cisco VPN fails to connect after update'
  )

  // Mais il apparaît lorsque le filtre est contourné
  expect(injectionResponse.text).toContain(
    'Cisco VPN fails to connect after update'
  )

  expect(injectionResponse.status).toBe(200)
  expect(normalResponse.status).toBe(200)
})

afterAll(() => {
    db.close()
})
