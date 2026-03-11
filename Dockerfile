FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Cloud Run sets PORT env var automatically
EXPOSE 8080

# Run migrations then start server
CMD ["sh", "-c", "npx knex migrate:latest --knexfile server/config/knexfile.js && npx knex seed:run --knexfile server/config/knexfile.js && node server/index.js"]
