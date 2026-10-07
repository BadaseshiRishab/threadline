# One image per API (seller, admin, user, delivery), chosen with --build-arg SERVICE=<name>.
# The build context is the repository root, because every API imports ../../shared. The folder layout is kept
# (/app/shared, /app/<service>/backend, /app/private_uploads) so the relative paths in the code work unchanged.
FROM node:24-alpine

ARG SERVICE
WORKDIR /app

# Dependencies first, so code changes do not reinstall them.
COPY shared/package.json shared/package-lock.json shared/
RUN npm ci --omit=dev --prefix shared
COPY ${SERVICE}/backend/package.json ${SERVICE}/backend/package-lock.json ${SERVICE}/backend/
RUN npm ci --omit=dev --prefix ${SERVICE}/backend

COPY shared shared
COPY ${SERVICE}/backend ${SERVICE}/backend

# Licence/RC scans and seller signatures; docker-compose mounts ./private_uploads here.
RUN mkdir -p /app/private_uploads && chown -R node:node /app/private_uploads

WORKDIR /app/${SERVICE}/backend
USER node
CMD ["node", "roleServer.js"]
