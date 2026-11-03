const path = require('path')

process.env.DB_PATH = ':memory:'
process.env.SESSION_SECRET = 'test-secret'
process.env.LOG_DIR = path.join(__dirname, '../../logs/tests')

const request = require('supertest')
const app = require('../../app')
const db = require('../../database/db')

describe('Tests de sécurité - Path Traversal', () => {

    test('GET /kb/view - Vérification de la traversée de répertoires', async () => {
        const agent = request.agent(app)

        // Connexion
        await agent.post('/login').type('form').send({
            email: 'jdupont@supportdesk.local',
            password: 'User_123'
        })

        // Vérification de l'accès au path-traversal-reussi.txt via path traversal
        const response = await agent
            .get('/kb/view')
            .query({ doc: '../../tests/fixtures/path-traversal-reussi.txt' })

        expect(response.status).toBe(200)
        expect(response.text).toContain('PATH_TRAVERSAL_TEST_SUCCESS')
    })

})

afterAll(() => {
    db.close()
})