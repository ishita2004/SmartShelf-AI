FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app/services

COPY --chown=node:node services/shared ./shared
COPY --chown=node:node services/storefront/server.js ./storefront/server.js
COPY --chown=node:node services/storefront/public ./storefront/public

USER node
EXPOSE 3000
CMD ["node", "storefront/server.js"]
