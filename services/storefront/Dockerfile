FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node services/shared ./shared
COPY --chown=node:node services/storefront/server.js ./server.js
COPY --chown=node:node services/storefront/public ./public

USER node
EXPOSE 3000
CMD ["node", "server.js"]
