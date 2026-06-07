FROM node:22-alpine3.22 AS dev

LABEL org.opencontainers.image.url https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end
LABEL org.opencontainers.image.source https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end
LABEL org.opencontainers.image.title "odt-web"
LABEL org.opencontainers.image.description "React frontend for ODT Cloud"
LABEL org.opencontainers.image.licenses MIT

USER node
WORKDIR /app

# --- Install dependencies ---
RUN --mount=source=package.json,target=package.json \
    --mount=source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
    npm ci

# --- Copy ODT Cloud ---
COPY --chown=node:node . /app

ENV CI=true

CMD ["npm", "run", "dev", "--", "--host"]

FROM dev AS build

ARG VITE_BACKEND_URL
ARG VITE_FEEDBACK_MAX_LENGTH
ARG VITE_TURNSTILE_SITE_KEY

RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine3.23

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build \
    /app/dist /usr/share/nginx/html

EXPOSE 8080
