FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app/services

COPY --chown=node:node services/shared ./shared
COPY --chown=node:node services/chatbot ./chatbot

USER node
EXPOSE 3005
CMD ["node", "chatbot/server.js"]
