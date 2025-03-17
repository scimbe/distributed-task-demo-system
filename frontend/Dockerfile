FROM node:16-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Set permissions for node_modules
RUN mkdir -p /app/node_modules/.cache && chmod -R 777 /app/node_modules

# For development environment
EXPOSE 3000
CMD ["npm", "start"]
