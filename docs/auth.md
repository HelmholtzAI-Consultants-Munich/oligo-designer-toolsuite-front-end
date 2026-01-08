---
title: Authentication
layout: default
nav_order: 1
parent: User Management
---

# Authentication & User Management

The authentication system manages both registered users and anonymous sessions.  
It uses **Flask-Login**, password hashing, and MongoDB to store user credentials, and supports automatic **run migration** from anonymous sessions to authenticated accounts.

**Warning: This documentation page may contain outdated information.**

---

## Features

- **User registration** with password hashing (Werkzeug security)
- **Secure login** with credential verification
- **Session-based user tracking** for anonymous users
- **Automatic run transfer**: if a user logs in or registers after running pipelines as a guest, all previous runs are migrated to their account
- **Logout** and **auth status** check endpoints
- User-specific data directories for storing runs and configuration files

---

## Workflow

### 1. Anonymous sessions

- When a visitor accesses the app without logging in, the `assign_session_id` hook assigns a unique `session_id` (UUID) to the Flask session.
- A directory is created under:
  ```
  user_data/anon/<session_id>
  ```
- Any runs started in this state are linked to the `session_id` in MongoDB (`runs` collection).

---

### 2. Register

**Endpoint:** `POST /register`  
**Payload:**

```json
{
  "email": "user@example.com",
  "password": "plaintextpassword"
}
```

**Process:**

1. Validate email/password.
2. Check if the email already exists.
3. Hash the password.
4. Insert new user document in `users` collection.
5. Create user-specific directory:
   ```
   user_data/<user_id>
   ```
6. Log the user in (Flask-Login).

---

### 3. Login

**Endpoint:** `POST /login`  
**Payload:**

```json
{
  "email": "user@example.com",
  "password": "plaintextpassword"
}
```

**Process:**

1. Look up the email in `users` collection.
2. Verify the password hash.
3. Log the user in.
4. Ensure their `user_data/<user_id>` directory exists.
5. **Run migration**:
   - If the current session has a `session_id`, update all runs in MongoDB with that `session_id` to instead have the `user_id` and clear `session_id`.
   - This ensures that any pipelines started as a guest appear in the logged-in user's run history.

---

### 4. Check authentication

**Endpoint:** `GET /api/check_auth`  
Returns:

- `authenticated: true` with user info if logged in.
- `authenticated: false` if not.

---

### 5. Logout

**Endpoint:** `POST /logout`  
Logs out the current authenticated user.

---

## Why session-based management matters

- **Pipeline continuity**: Users can start pipelines without an account.
- **Seamless upgrade**: If they decide to register or log in later, all runs are automatically linked to their new account.
- **Consistent history**: No runs are lost when moving from anonymous to authenticated mode.
- **Better tracking**: Each anonymous user still has an isolated data space, avoiding collisions between guest runs.

---

## Directory structure

```
user_data/
│
├── <user_id>/           # Authenticated user data
│   └── ...              # Runs, configs, outputs
│
└── anon/
    └── <session_id>/    # Anonymous user data
```
