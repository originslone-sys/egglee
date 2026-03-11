FROM node:20-slim

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Cloud Run sets PORT env var automatically
EXPOSE 8080

# Run migrations in production env, then start server
CMD ["sh", "-c", "npx knex migrate:latest --env production --knexfile server/config/knexfile.js && node server/index.js"]
