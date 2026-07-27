# Step 1: Builder stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_GOOGLE_CLIENT_ID is baked into the client bundle at build time by Vite,
# so it must be supplied as a build arg (Cloud Run's runtime env vars are set
# too late to affect it). Without it, Google Identity Services initializes
# with an empty client_id and sign-in fails with "Error 400: invalid_request".
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN npm run build

# Step 2: Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["node", "dist/server.cjs"]
