# Multi-stage build for NestJS
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/seed-admin.js ./seed-admin.js
COPY --from=builder /app/seed-products.js ./seed-products.js

EXPOSE 3000

CMD ["node", "dist/main.js"]
