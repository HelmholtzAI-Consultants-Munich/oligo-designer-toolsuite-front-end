FROM node:22

USER node
WORKDIR /home/node/

# --- Install dependencies ---
RUN npm install @playwright/test

USER root
RUN npx playwright install-deps
USER node

# --- Install Playwright browsers ---
# Playwright needs access to package.json for this
RUN npx playwright install
ENV CI=true

# --- Copy ODT Cloud tests ---
COPY --chown=node:node . ./tests

ENTRYPOINT ["npx", "playwright"]
CMD ["test", "tests", "--reporter=html"]
