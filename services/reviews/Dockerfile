FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app/services/reviews

COPY --chown=node:node services/reviews/package.json ./package.json
COPY --chown=node:node services/reviews/package-lock.json ./package-lock.json
RUN npm ci --omit=dev
WORKDIR /app/services
COPY --chown=node:node services/shared ./shared
COPY --chown=node:node services/reviews/server.js ./reviews/server.js

USER node
EXPOSE 3004
CMD ["node", "reviews/server.js"]
