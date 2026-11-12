FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node services/reviews/package.json ./package.json
COPY --chown=node:node services/reviews/package-lock.json ./package-lock.json
RUN npm ci --omit=dev
COPY --chown=node:node services/shared ./shared
COPY --chown=node:node services/reviews/server.js ./server.js

USER node
EXPOSE 3004
CMD ["node", "server.js"]
