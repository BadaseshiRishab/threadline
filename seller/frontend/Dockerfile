# Seller website. Built with webpack, then served by nginx, which also forwards /api to the seller API.
# Build from this folder:
#   docker build -t threadline-seller-web --build-arg ADMIN_PORTAL_URL=http://<server>:8082 seller/frontend
# Run with API_UPSTREAM pointing at the seller API (default: the docker-compose service seller-api:4001).
FROM node:24-alpine AS build
# Link to the admin site, baked in at build time (see webpack.config.cjs).
ARG ADMIN_PORTAL_URL=http://localhost:8082
ENV ADMIN_PORTAL_URL=${ADMIN_PORTAL_URL}
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
ENV API_UPSTREAM=seller-api:4001
# nginx fills in ${API_UPSTREAM} when the container starts.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
