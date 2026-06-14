# Speack3 server — Node.js + Socket.io + NeDB
FROM node:18-alpine

WORKDIR /app

# Install production dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy application source
COPY . .

# NeDB stores its files here; ensure the directory exists
RUN mkdir -p /app/data

ENV NODE_ENV=production
# Hosts (Render/Railway/Fly) inject PORT; server.js reads process.env.PORT
EXPOSE 3000

CMD ["node", "server.js"]
