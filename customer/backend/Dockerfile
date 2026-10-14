# Customer (storefront) API (port 4003). Build from the repository root, because the API imports ../../../shared:
#   docker build -f customer/backend/Dockerfile -t threadline-customer-api .
# The folder layout is kept (/app/shared, /app/customer/backend) so relative paths work unchanged.
FROM node:24-alpine

WORKDIR /app

# Dependencies first, so code changes do not reinstall them.
COPY shared/package.json shared/package-lock.json shared/
RUN npm ci --omit=dev --prefix shared
COPY customer/backend/package.json customer/backend/package-lock.json customer/backend/
RUN npm ci --omit=dev --prefix customer/backend

COPY shared shared
COPY customer/backend customer/backend

WORKDIR /app/customer/backend
USER node
EXPOSE 4003
CMD ["node", "src/server.js"]
