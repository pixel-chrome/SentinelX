const path = require('path')

process.env.DB_PATH = ':memory:'
process.env.SESSION_SECRET = 'test-secret'
process.env.LOG_DIR = path.join(__dirname, '../../logs/tests')

const request = require('supertest')
const app = require('../../app')
const db = require('../../database/db')

async function login(email, password) {
  const agent = request.agent(app)

  await agent.post('/login').type('form').send({
    email,
    password
  })

  return agent
}

describe('Tests fonctionnels - Administration', () => {

  test('GET /admin - Administrateur autorisé', async () => {
    const agent = await login(
      'admin@supportdesk.local',
      'Admin_123'
    )

    const response = await agent.get('/admin')

    expect(response.status).toBe(200)
  })

  test('GET /admin - Utilisateur classique refusé', async () => {
    const agent = await login(
      'jdupont@supportdesk.local',
      'User_123'
    )

    const response = await agent.get('/admin')

    expect(response.status).toBe(403)
  })

  test('GET /admin - Accès refusé sans authentification', async () => {
    const response = await request(app).get('/admin')

    expect(response.status).toBe(302)
    expect(response.headers.location).toBe('/login')
  })

})

afterAll(() => {
  db.close()
})