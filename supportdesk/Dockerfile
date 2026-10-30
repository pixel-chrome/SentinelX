FROM node:22-alpine

# Dépendances nécessaires à la compilation de certains modules natifs.
RUN apk add --no-cache python3 make g++

# Répertoire de travail.
WORKDIR /app

# Installation des dépendances.
COPY package*.json ./
RUN npm ci --omit=dev

# Copie du code source.
COPY . .

# Création du dossier des logs.
RUN mkdir -p /var/log/supportdesk

# Téléchargement de Bootstrap.
RUN mkdir -p public/bootstrap/css public/bootstrap/js && \
    wget -qO public/bootstrap/css/bootstrap.min.css \
      "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" && \
    wget -qO public/bootstrap/js/bootstrap.bundle.min.js \
      "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
# Port de l'application.
EXPOSE 3000

# Vérification du fonctionnement de l'application.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/login', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Démarrage.
CMD ["node", "app.js"]