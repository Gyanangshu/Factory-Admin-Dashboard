# FROM node:20-alpine

# RUN apk add --no-cache openssl 

# WORKDIR /app

# COPY package*.json ./
# RUN npm ci --omit=dev

# COPY prisma ./prisma
# RUN npx prisma generate

# # Copy source
# COPY src ./src
# COPY entrypoint.sh ./
# RUN chmod +x entrypoint.sh

# RUN mkdir -p /app/data

# # ENV DATABASE_URL="file:/app/data/factory.db"
# # ENV PORT=3001

# # EXPOSE 3001

# ENTRYPOINT ["./entrypoint.sh"]

FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci --omit=dev

# Prisma
COPY prisma ./prisma
RUN npx prisma generate

# Copy app
COPY . .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Railway uses dynamic PORT (usually 8080)
ENV PORT=8080
EXPOSE 8080 

# Important: use CMD, not ENTRYPOINT
CMD ["sh", "./entrypoint.sh"]