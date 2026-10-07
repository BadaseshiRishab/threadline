# Storefront website. Built with webpack, then served by nginx, which also forwards /api to the customer API.
# Build from this folder:
#   docker build -t threadline-user-web user/frontend
# Run with API_UPSTREAM pointing at the customer API (default: the docker-compose service user-api:4003).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
ENV API_UPSTREAM=user-api:4003
# nginx fills in ${API_UPSTREAM} when the container starts.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
