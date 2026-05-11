---
title: Authentication
layout: default
nav_order: 7
parent: Development
---

# Authentication

The authentication system manages both authenticated users and anonymous sessions. It uses **Flask-Login** for session management and supports two authentication methods:

1. **Helmholtz AAI** (primary) - OAuth2/OIDC authentication via Helmholtz Authentication and Authorization Infrastructure
2. **Legacy email/password** - Traditional authentication for backward compatibility

---

## Authentication Technologies

### Flask-Login

The application uses **Flask-Login** for managing user sessions and authentication state. Flask-Login provides:

- Session-based user tracking
- User loader for retrieving user objects from the database
- Login/logout functionality
- Session protection in "strong" mode to prevent session hijacking
- "Remember Me" functionality for persistent logins

### Helmholtz AAI

**Helmholtz Authentication and Authorization Infrastructure (AAI)** provides enterprise-grade authentication for Helmholtz research centers and external partners. For more information, see the [Helmholtz AAI documentation](https://hifis.net/aai/).

**Key Features:**

- **Single Sign-On (SSO)** across Helmholtz Cloud services
- **Cross-institutional access** for Helmholtz users and invited partners
- **No password management** - users authenticate with their home institution credentials
- **Minimal data transfer** - passwords never leave the home institution
- **Virtual Organizations (VO)** support for group management and resource sharing
- **Compliance** with GDPR and international standards (AARC blueprint, EOSC compatibility)

**How It Works:**

1. User clicks "Helmholtz ID" login button
2. User selects their home institution
3. User authenticates with home institution credentials
4. Helmholtz AAI provides only the unique subject identifier (`sub`)
5. Application creates or updates user account with the subject ID and logs them in

---

## Features

- **Helmholtz AAI OAuth2/OIDC** authentication for Helmholtz users
- **Legacy email/password** authentication (for backward compatibility)
- **Session-based user tracking** for anonymous users
- **Automatic run migration**: if a user logs in or registers after running pipelines as a guest, all previous runs are migrated to their account
- **User-specific data directories** for storing runs and configuration files
- **Token revocation** on logout for OAuth sessions

---

## Authentication Workflow

### 1. Anonymous Sessions

When a visitor accesses the app without logging in:

- The `assign_session_id` hook assigns a unique `session_id` (UUID) to the Flask session
- A directory is created under:
  ```
  user_data/anon/<session_id>
  ```
- Any runs started in this state are linked to the `session_id` in MongoDB (`runs` collection)

---

### 2. Helmholtz AAI Login (OAuth2/OIDC)

**Endpoint:** `GET /login`  
**Flow:**

1. User is redirected to Helmholtz AAI authorization endpoint
2. User selects home institution and authenticates
3. Helmholtz AAI redirects back to `/auth/callback` with authorization code
4. Application exchanges code for access token
5. Application fetches user info from Helmholtz AAI userinfo endpoint
6. Only the unique subject identifier (`sub`) is received from Helmholtz AAI
7. User document is created or updated in MongoDB with:
   - `helmholtz_sub`: Unique subject identifier from Helmholtz AAI (the only field provided)
8. User is logged in via Flask-Login
9. User data directory is created if needed
10. Any anonymous session data is migrated to the authenticated user

---

### 3. Legacy Email/Password Login

**Endpoint:** `POST /login`  
**Payload:**

```json
{
  "email": "user@example.com",
  "password": "plaintextpassword",
  "remember_me": true
}
```

**Process:**

1. Validate email/password
2. Look up user in MongoDB `users` collection
3. Verify password hash using Werkzeug security
4. Log user in via Flask-Login
5. Ensure user data directory exists
6. **Run migration**: Migrate any anonymous session runs to the authenticated user

---

### 4. Legacy Registration

**Endpoint:** `POST /register`  
**Payload:**

```json
{
  "email": "user@example.com",
  "password": "plaintextpassword"
}
```

**Process:**

1. Validate email/password
2. Check if email already exists
3. Hash password using Werkzeug security
4. Insert new user document in `users` collection
5. Create user-specific directory:
   ```
   user_data/<user_id>
   ```
6. Log user in via Flask-Login

---

### 5. Check Authentication Status

**Endpoint:** `GET /api/check_auth`  
**Returns:**

For authenticated users:

```json
{
  "authenticated": true,
  "user": {
    "id": "user_id",
    "email": "user@example.com", // null for Helmholtz AAI users
    "name": "User Name", // null for Helmholtz AAI users
    "role": "user"
  }
}
```

For unauthenticated users:

```json
{
  "authenticated": false
}
```

**Note:** For Helmholtz AAI users, `email` and `name` will be `null` since Helmholtz AAI only provides the subject identifier.

---

### 6. Logout

**Endpoint:** `POST /logout`  
**Process:**

- For OAuth sessions: Revokes access token with Helmholtz AAI
- Logs out user via Flask-Login
- Clears session data

---

## User Schema

### Helmholtz AAI Users

```javascript
{
  "_id": ObjectId,
  "helmholtz_sub": "unique-subject-id-from-helmholtz",  // Only field received from Helmholtz AAI
  "email": null,  // Not provided by Helmholtz AAI
  "name": null,   // Not provided by Helmholtz AAI
  "role": "user"  // Default role
}
```

**Note:** Helmholtz AAI only provides the unique subject identifier (`sub`). Email and name fields are not included in the userinfo response and will be `null` in the database.

### Legacy Users

```javascript
{
  "_id": ObjectId,
  "email": "user@example.com",
  "password": "hashed_password",  // Werkzeug hash
  "role": "user"
}
```

---

## Why Session-Based Management Matters

- **Pipeline continuity**: Users can start pipelines without an account
- **Seamless upgrade**: If users register or log in later, all runs are automatically linked to their account
- **Consistent history**: No runs are lost when moving from anonymous to authenticated mode
- **Better tracking**: Each anonymous user has an isolated data space, avoiding collisions between guest runs

---

## Directory Structure

```
user_data/
│
├── <user_id>/           # Authenticated user data
│   └── ...              # Runs, configs, outputs
│
└── anon/
    └── <session_id>/    # Anonymous user data
```

---

## Implementation Details

### Flask-Login Configuration

- **User Loader**: Loads users from MongoDB by ObjectId
- **Session Protection**: Enabled in "strong" mode
- **Remember Me**: Supported for persistent logins
- **Login Required Decorator**: `@login_required` for protected routes

### OAuth2/OIDC Configuration

- **Provider**: Helmholtz AAI (`login.helmholtz.de`)
- **Flow**: Authorization Code flow
- **Token Storage**: Access tokens stored in Flask session for revocation
- **User Info**: Only the unique subject identifier (`sub`) is received from Helmholtz AAI userinfo endpoint
- **User Identification**: Users are identified solely by `helmholtz_sub` (the `sub` field from OAuth response)

### Security

- **Password Hashing**: Werkzeug security for legacy authentication
- **Session Security**: Flask-Login strong session protection
- **Token Revocation**: OAuth tokens revoked on logout
- **CSRF Protection**: Flask session-based CSRF protection

---

## References

- [Helmholtz AAI Documentation](https://hifis.net/aai/)
- [Flask-Login Documentation](https://flask-login.readthedocs.io/)
- [Helmholtz AAI Setup Guide](../HELMHOLTZ_AAI_SETUP.md)
