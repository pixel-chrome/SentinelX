const path = require('path')

process.env.DB_PATH = ':memory:'
process.env.SESSION_SECRET = 'test-secret'
process.env.LOG_DIR = path.join(__dirname, '../../logs/tests')

const request = require('supertest')
const app = require('../../app')
const db = require('../../database/db')

describe('Tests fonctionnels - Authentification', () => {

    // TEST 1 : Connexion avec des identifiants corrects
    test('POST /login - Connexion réussie', async () => {
        const agent = request.agent(app)

        const response = await agent
            .post('/login')
            .type('form')
            .send({
                email: 'jdupont@supportdesk.local',
                password: 'User_123'
            })

        expect(response.status).toBe(302)
        expect(response.headers.location).toBe('/dashboard')

        // On vérifie que la session fonctionne réellement.
        const dashboard = await agent.get('/dashboard')
        expect(dashboard.status).toBe(200)
    })


    // TEST 2 : Connexion avec un mauvais mot de passe
    test('POST /login - Connexion refusée', async () => {
        const agent = request.agent(app)

        const response = await agent
            .post('/login')
            .type('form')
            .send({
                email: 'jdupont@supportdesk.local',
                password: 'mauvais_mot_de_passe'
            })

        expect(response.status).toBe(302)
        expect(response.headers.location).toBe('/login?error=1')

        // Un utilisateur non connecté ne doit pas accéder au dashboard.
        const dashboard = await agent.get('/dashboard')
        expect(dashboard.status).toBe(302)
        expect(dashboard.headers.location).toBe('/login')
    })


    // TEST 3 : Déconnexion après une connexion réussie
    test('GET /logout - Déconnexion réussie', async () => {
        const agent = request.agent(app)

        // On commence par se connecter.
        await agent
            .post('/login')
            .type('form')
            .send({
                email: 'jdupont@supportdesk.local',
                password: 'User_123'
            })

        // On se déconnecte.
        const response = await agent.get('/logout')

        expect(response.status).toBe(302)
        expect(response.headers.location).toBe('/login')

        // On vérifie que la session a bien été détruite.
        const dashboard = await agent.get('/dashboard')
        expect(dashboard.status).toBe(302)
        expect(dashboard.headers.location).toBe('/login')
    })


    // TEST 4 : Déconnexion sans être connecté
    test('GET /logout - Déconnexion sans session', async () => {
        const agent = request.agent(app)

        const response = await agent.get('/logout')

        expect(response.status).toBe(302)
        expect(response.headers.location).toBe('/login')
    })

})

afterAll(() => {
    db.close()
})