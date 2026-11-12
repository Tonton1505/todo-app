# ==========================================
# Production Dockerfile for Backend Service
# ==========================================
FROM node:18-alpine

# Set working directory inside container
WORKDIR /app

# Copy package descriptors first to leverage Docker layer caching
COPY package*.json ./

# Install only production dependencies cleanly and fast
RUN npm ci --only=production || npm install --production

# Copy remaining source code
COPY . .

# Set container environment variables
ENV NODE_ENV=production
ENV APP_VERSION=v1.0

# Expose backend port
EXPOSE 5000

# Start backend application
CMD ["node", "server.js"]
