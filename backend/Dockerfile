FROM node:20-alpine

RUN apk add --no-cache openssl 

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

# Copy source
COPY src ./src
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

RUN mkdir -p /app/data

# ENV DATABASE_URL="file:/app/data/factory.db"
# ENV PORT=3001

EXPOSE 3001

ENTRYPOINT ["./entrypoint.sh"]
