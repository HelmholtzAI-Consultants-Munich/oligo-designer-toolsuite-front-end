FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

COPY package.json package-lock.json playwright.config.ts ./
RUN npm ci
ENV CI=true
ENV TESTING=true

COPY backend/data ./backend/data/
COPY tests ./tests

ENTRYPOINT ["npx", "playwright"]
CMD ["test"]
