# -------- Base image --------
    FROM node:24.12.0-alpine AS base
    WORKDIR /app
    
    # -------- Dependencies --------
    FROM base AS deps
    COPY package*.json ./
    RUN npm ci
    
    # -------- Build --------
    FROM base AS build
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    RUN npm run build
    
    # -------- Production --------
    FROM node:24.12.0-alpine AS production
    WORKDIR /app
    
    ENV NODE_ENV=production
    
    COPY package*.json ./
    COPY --from=deps /app/node_modules ./node_modules
    COPY --from=build /app/dist ./dist
    
    EXPOSE 3000
    
    CMD ["node", "dist/main.js"]