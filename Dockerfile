FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node server.js ./server.js
COPY --chown=node:node public ./public

USER node
EXPOSE 3000

CMD ["node", "server.js"]
