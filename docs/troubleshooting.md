---
layout: page
title: Troubleshooting
permalink: /troubleshooting.html
---

### Common issues

**CORS / Cookies**
- Backend must send `Access-Control-Allow-Origin: http://localhost:5173` (or your frontend origin)
- Use `credentials: 'include'` on fetch/axios when sessions are cookie-based

**Blank page on refresh**
- Ensure your production web server routes all unknown paths to `/index.html` (SPA fallback)

**Run ID not created**
- Confirm backend endpoint `/api/init_run_id` is reachable (200) and returns JSON `{ "run_id": "..." }`

**Auth seems stuck on loading**
- Verify `GET /api/check_auth` responds 200 with valid session