FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node services/shared ./shared
COPY --chown=node:node services/search/server.js ./server.js

USER node
EXPOSE 3002
CMD ["node", "server.js"]
