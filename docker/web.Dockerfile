FROM node:22-slim

USER node
WORKDIR /app

# --- Install dependencies ---
RUN --mount=source=package.json,target=package.json \
    --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
    npm install --no-audit --no-fund

# --- Copy ODT Cloud ---
COPY --chown=node:node . .

CMD ["npm", "run", "dev", "--", "--host"]
