# Seller API (port 4001). Build from the repository root, because the API imports ../../shared:
#   docker build -f seller/backend/Dockerfile -t threadline-seller-api .
# The folder layout is kept (/app/shared, /app/seller/backend, /app/private_uploads) so relative paths work unchanged.
FROM node:24-alpine

WORKDIR /app

# Dependencies first, so code changes do not reinstall them.
COPY shared/package.json shared/package-lock.json shared/
RUN npm ci --omit=dev --prefix shared
COPY seller/backend/package.json seller/backend/package-lock.json seller/backend/
RUN npm ci --omit=dev --prefix seller/backend

COPY shared shared
COPY seller/backend seller/backend

# Seller signatures; docker-compose mounts ./private_uploads here.
RUN mkdir -p /app/private_uploads && chown -R node:node /app/private_uploads

WORKDIR /app/seller/backend
USER node
EXPOSE 4001
CMD ["node", "roleServer.js"]
