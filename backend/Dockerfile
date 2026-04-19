FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN chmod +x entrypoint.sh

ENV PORT=8080
EXPOSE 8080 

CMD ["sh", "./entrypoint.sh"]