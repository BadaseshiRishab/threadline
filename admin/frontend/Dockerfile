# Admin website. Built with webpack, then served by nginx, which also forwards /api to the admin API.
# Build from this folder:
#   docker build -t threadline-admin-web --build-arg SELLER_PORTAL_URL=http://<server>:8081 --build-arg DELIVERY_APP_URL=http://<server>:8083 admin/frontend
# Run with API_UPSTREAM pointing at the admin API (default: the docker-compose service admin-api:4002).
FROM node:24-alpine AS build
# Links to the seller and delivery sites, baked in at build time (see webpack.config.cjs).
ARG SELLER_PORTAL_URL=http://localhost:8081
ARG DELIVERY_APP_URL=http://localhost:8083
ENV SELLER_PORTAL_URL=${SELLER_PORTAL_URL} DELIVERY_APP_URL=${DELIVERY_APP_URL}
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
ENV API_UPSTREAM=admin-api:4002
# nginx fills in ${API_UPSTREAM} when the container starts.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
