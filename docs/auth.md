---
layout: page
title: Auth
permalink: /auth.html
---

## Overview

`src/modules/auth.tsx` provides an `AuthProvider` and `useAuth` hook.

- Checks session with `GET http://localhost:5000/api/check_auth` (cookies included)
- Exposes `user`, `loading`, `checkAuth()`, `logout()`

### Navbar

`src/modules/nav.tsx`:
- Shows login/register or user actions depending on `useAuth()`
- Uses React Router links for navigation