const path = require('path')

process.env.DB_PATH = ':memory:'
process.env.SESSION_SECRET = 'test-secret'
process.env.LOG_DIR = path.join(__dirname, '../../logs/tests')

const request = require('supertest')
const app = require('../../app')
const db = require('../../database/db')

describe('Security - Session Cookie', () => {
  test('GET /admin - reject forged session cookie', async () => {
    const response = await request(app)
      .get('/admin')
      .set('Cookie', 'connect.sid=s%3Aforged-session-id.invalid-signature')

    expect(response.status).toBe(302)
    expect(response.headers.location).toBe('/login')
  })
})

afterAll(() => {
  db.close()
})