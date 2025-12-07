# TODO: This should be replaced with the official Docker image
# see https://playwright.dev/docs/docker

FROM node:22-slim

USER node
WORKDIR /app

# --- Install dependencies ---
RUN npm install @playwright/test

USER root
RUN npx playwright install-deps
USER node

# --- Install Playwright browsers ---
RUN npx playwright install
ENV CI=true

# --- Copy ODT Cloud tests ---
COPY --chown=node:node tests ./tests

ENTRYPOINT ["npx", "playwright"]
CMD ["test", "tests", "--reporter=html"]
