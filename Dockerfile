FROM node:26-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run build

FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8787 SASSUOLO_DB_PATH=/data/sassuolo.db SASSUOLO_BACKUPS_DIR=/data/backups
WORKDIR /app
COPY package*.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/data ./data
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/tsconfig.json ./tsconfig.json
EXPOSE 8787
VOLUME ["/data"]
CMD ["sh","-c","npm run db:migrate && npm run import:all && node --import tsx server/index.ts"]
