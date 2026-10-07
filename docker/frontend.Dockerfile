# One image per website (seller, admin, user, delivery), chosen with --build-arg APP=<name>. The React app is built
# with webpack, then served by nginx, which also forwards /api to that site's API (as the webpack dev server's proxy
# does in development).
FROM node:24-alpine AS build

ARG APP
# Links between the sites, baked in at build time (see each webpack.config.cjs).
ARG SELLER_PORTAL_URL=
ARG ADMIN_PORTAL_URL=
ARG DELIVERY_APP_URL=
ENV SELLER_PORTAL_URL=${SELLER_PORTAL_URL} ADMIN_PORTAL_URL=${ADMIN_PORTAL_URL} DELIVERY_APP_URL=${DELIVERY_APP_URL}

WORKDIR /app/${APP}/frontend
COPY ${APP}/frontend/package.json ${APP}/frontend/package-lock.json ./
RUN npm ci
COPY ${APP}/frontend ./
RUN npm run build

FROM nginx:1.27-alpine
ARG APP
COPY --from=build /app/${APP}/frontend/dist /usr/share/nginx/html
# nginx fills in ${API_UPSTREAM} from the container's environment when it starts.
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
