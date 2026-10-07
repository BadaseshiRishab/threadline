# Admin API (port 4002). Build from the repository root, because the API imports ../../shared:
#   docker build -f admin/backend/Dockerfile -t threadline-admin-api .
# The folder layout is kept (/app/shared, /app/admin/backend, /app/private_uploads) so relative paths work unchanged.
FROM node:24-alpine

WORKDIR /app

# Dependencies first, so code changes do not reinstall them.
COPY shared/package.json shared/package-lock.json shared/
RUN npm ci --omit=dev --prefix shared
COPY admin/backend/package.json admin/backend/package-lock.json admin/backend/
RUN npm ci --omit=dev --prefix admin/backend

COPY shared shared
COPY admin/backend admin/backend

# Admin reads seller signatures and partner documents from here; docker-compose mounts ./private_uploads.
RUN mkdir -p /app/private_uploads && chown -R node:node /app/private_uploads

WORKDIR /app/admin/backend
USER node
EXPOSE 4002
CMD ["node", "roleServer.js"]
