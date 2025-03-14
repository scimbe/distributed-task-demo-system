FROM node:16-alpine

WORKDIR /app

# Abhängigkeiten installieren
COPY package*.json ./
RUN npm install

# Quellcode kopieren
COPY . .

# Anwendung bauen
RUN npm run build

# Anwendung starten
EXPOSE 3000
CMD ["npm", "start"]
