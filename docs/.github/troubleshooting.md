---
title: Troubleshooting
layout: default
nav_order: 7
---
### CORS / Cookies
- Backend must allow your frontend origin and credentials.

### SPA refresh 404
- Configure server to serve `/index.html` fallback for unknown routes.

### Run ID errors
- Confirm `/api/init_run_id` returns 200 and JSON with `run_id`.
