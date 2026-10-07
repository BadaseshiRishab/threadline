# Customer (storefront) API (port 4003). Build from the repository root, because the API imports ../../shared:
#   docker build -f user/backend/Dockerfile -t threadline-user-api .
# The folder layout is kept (/app/shared, /app/user/backend) so relative paths work unchanged.
FROM node:24-alpine

WORKDIR /app

# Dependencies first, so code changes do not reinstall them.
COPY shared/package.json shared/package-lock.json shared/
RUN npm ci --omit=dev --prefix shared
COPY user/backend/package.json user/backend/package-lock.json user/backend/
RUN npm ci --omit=dev --prefix user/backend

COPY shared shared
COPY user/backend user/backend

WORKDIR /app/user/backend
USER node
EXPOSE 4003
CMD ["node", "roleServer.js"]
