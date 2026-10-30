const path = require('path')

process.env.DB_PATH = ':memory:'
process.env.SESSION_SECRET = 'test-secret'
process.env.LOG_DIR = path.join(__dirname, '../../logs/tests')

const request = require('supertest')
const app = require('../../app')
const db = require('../../database/db')

// Connexion d'un utilisateur et récupération de sa session
async function authenticatedAgent() {
    const agent = request.agent(app)

    await agent
        .post('/login')
        .type('form')
        .send({
            email: 'jdupont@supportdesk.local',
            password: 'User_123'
        })

    return agent
}

describe('Tests fonctionnels - Tickets', () => {

    // TEST 1 : consulter la liste des tickets avec une session
    test('GET /tickets - Accès autorisé', async () => {
        const agent = await authenticatedAgent()

        const response = await agent.get('/tickets')

        expect(response.status).toBe(200)
    })

    // TEST 2 : consulter la liste des tickets sans session
    test('GET /tickets - Accès refusé sans authentification', async () => {
        const response = await request(app).get('/tickets')

        expect(response.status).toBe(302)
        expect(response.headers.location).toBe('/login')
    })

    // TEST 3 : consulter un ticket existant
    test('GET /tickets/:id - Ticket existant', async () => {
        const agent = await authenticatedAgent()

        // Récupération d'un ticket existant dans la base
        const ticket = db.prepare('SELECT id FROM tickets LIMIT 1').get()

        expect(ticket).toBeDefined()

        const response = await agent.get(`/tickets/${ticket.id}`)

        expect(response.status).toBe(200)
    })

    // TEST 4 : consulter un ticket inexistant
    test('GET /tickets/:id - Ticket inexistant', async () => {
        const agent = await authenticatedAgent()

        const response = await agent.get('/tickets/99999')

        expect(response.status).toBe(404)
    })
})

afterAll(() => {
    db.close()
})