FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run prepare 2>/dev/null || true

EXPOSE 5173

# Run migrations then start dev server
CMD ["sh", "-c", "npx drizzle-kit migrate && npm run dev -- --host 0.0.0.0"]
