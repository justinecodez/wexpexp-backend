# Stage 1: Build
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./  
COPY package-lock.json ./ 
COPY . .
RUN npm install
RUN npm run build

# Stage 2: Run
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js

EXPOSE 3001
CMD ["node", "server.js"]