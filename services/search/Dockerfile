FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app/services

COPY --chown=node:node services/shared ./shared
COPY --chown=node:node services/search/server.js ./search/server.js

USER node
EXPOSE 3002
CMD ["node", "search/server.js"]
