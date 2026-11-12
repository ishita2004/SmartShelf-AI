FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node services/shared ./shared
COPY --chown=node:node services/recommendations/server.js ./server.js

USER node
EXPOSE 3003
CMD ["node", "server.js"]
