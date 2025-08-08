---
layout: page
title: Getting Started
permalink: /getting-started.html
---

## Prerequisites

- **Node.js 18+**
- **npm** or **pnpm**

## Install & Run

```bash
# clone your repo
git clone <your-repo-url>.git
cd <repo>

# install
npm install   # or: pnpm install

# dev
npm run dev

# build
npm run build

# preview production build
npm run preview
```

> **Note**: The app expects a backend at `http://localhost:5000` for API calls.
Make sure your backend is running and CORS is configured.