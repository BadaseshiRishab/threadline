# Delivery partner API (port 4004). Build from the repository root, because the API imports ../../shared:
#   docker build -f delivery/backend/Dockerfile -t threadline-delivery-api .
# The folder layout is kept (/app/shared, /app/delivery/backend, /app/private_uploads) so relative paths work unchanged.
FROM node:24-alpine

WORKDIR /app

# Dependencies first, so code changes do not reinstall them.
COPY shared/package.json shared/package-lock.json shared/
RUN npm ci --omit=dev --prefix shared
COPY delivery/backend/package.json delivery/backend/package-lock.json delivery/backend/
RUN npm ci --omit=dev --prefix delivery/backend

COPY shared shared
COPY delivery/backend delivery/backend

# Licence and RC scans; docker-compose mounts ./private_uploads here.
RUN mkdir -p /app/private_uploads && chown -R node:node /app/private_uploads

WORKDIR /app/delivery/backend
USER node
EXPOSE 4004
CMD ["node", "roleServer.js"]
