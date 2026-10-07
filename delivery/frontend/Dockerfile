# Delivery partner website. Built with webpack, then served by nginx, which also forwards /api to the delivery API.
# Build from this folder:
#   docker build -t threadline-delivery-web delivery/frontend
# Run with API_UPSTREAM pointing at the delivery API (default: the docker-compose service delivery-api:4004).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
ENV API_UPSTREAM=delivery-api:4004
# nginx fills in ${API_UPSTREAM} when the container starts.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
