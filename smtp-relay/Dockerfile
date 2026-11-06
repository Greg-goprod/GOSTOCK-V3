FROM node:20-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install --omit=dev

# Copier le code source
COPY src/ ./src/

# Exposer le port
EXPOSE 8080

# Définir les variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=8080

# Démarrer l'application
CMD ["node", "src/index.js"]
