---
title: Authentication
layout: default
nav_order: 5
---
`src/modules/auth.tsx` provides the **AuthProvider**.

- Checks session at `GET http://localhost:5000/api/check_auth` (with cookies)
- Exposes `user`, `loading`, `checkAuth()`, `logout()`

`src/modules/nav.tsx` updates navbar actions based on auth state.
