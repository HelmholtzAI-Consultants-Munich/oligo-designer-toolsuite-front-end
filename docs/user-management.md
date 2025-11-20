---
title: User Management
layout: default
nav_order: 7
has_children: true
---

# User Management

The Oligo Designer Toolsuite provides a comprehensive user management system that supports both authenticated users and anonymous sessions.

## Features

- **Session-based tracking** for anonymous users
- **User registration and authentication** with secure password handling
- **Automatic run migration** from anonymous sessions to user accounts
- **Persistent user workspaces** for organizing runs and outputs

## Key Benefits

1. **Flexibility**: Start using the app without creating an account
2. **Continuity**: All anonymous runs are preserved and migrated when you register or log in
3. **Security**: Password hashing and session management using Flask-Login
4. **Isolation**: Each user (or session) has a dedicated workspace

---

For detailed information about authentication workflows, see [Authentication](auth.md).
