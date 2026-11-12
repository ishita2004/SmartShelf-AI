FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app/services/catalog

COPY --chown=node:node services/catalog/package.json ./package.json
COPY --chown=node:node services/catalog/package-lock.json ./package-lock.json
RUN npm ci --omit=dev
WORKDIR /app/services
COPY --chown=node:node services/shared ./shared
COPY --chown=node:node services/catalog/server.js ./catalog/server.js

USER node
EXPOSE 3001
CMD ["node", "catalog/server.js"]
