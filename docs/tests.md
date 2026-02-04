---
title: Tests
layout: default
nav_order: 3
parent: Development
---

# Tests

This document explains the test strategy for this software. There are **three** layers:

1. **Backend unit & API tests** using **Pytest** for the Flask backend.
2. **Frontend unit & component tests** using **Vitest** and **React Testing Library** for React components.
3. **End-to-end (E2E) tests** using **Playwright**, executed in **GitHub Actions** against the hosted app, to validate full pipelines.

---

## 1) Backend Unit & API Tests (Pytest)

**Goal:** Verify every Flask API endpoint and backend logic in isolation (fast, deterministic).

### Scope

- Status codes, JSON schema, and error handling of **all API endpoints**.
- Auth/session flows (login, logout, protected routes).
- Validation of complex pipeline payloads (e.g., Scrinshot, MERFISH, SeqFISH).
- Pipeline submission/scheduling logic (mock long-running jobs & I/O).
- DB interactions (mock MongoDB in unit tests).

### Running locally

```bash
# note: start database first
pytest flask
# with coverage:
pytest flask --cov=flask --cov-report=term-missing
```

or if using Docker:

```bash
# Start services with tests profile (optional, but recommended for consistency):
npm run docker:start:test
# or for development with hot reloading:
npm run docker:watch:test

# Then run backend tests:
docker compose run --rm --build odt-server pytest
# with coverage:
docker compose run --rm --build odt-server pytest --cov=. --cov-report=term-missing
```

Alternatively, you can start just the database and run tests:

```bash
docker compose up odt-db -d
docker compose run --rm --build odt-server pytest
```

### Fixtures & notes

- **Never** execute real long-running pipelines in unit tests; **mock** them and assert:
  - request validation
  - scheduling trigger
  - persisted records / status initialization

---

## 2) Frontend Unit & Component Tests (Vitest)

**Goal:** Verify React components render correctly and handle user interactions as expected (fast, deterministic).

### Scope

- Component rendering and rendering with props.
- User interactions (clicks, form inputs, navigation).
- Component state management.
- Integration between React components.
- UI behavior and conditional rendering.

### Running locally

```bash
# Run all frontend tests:
npm test
# Run tests in watch mode (for development):
npm run test:watch
```

### Fixtures & notes

- Tests use **Vitest** as the test runner with **React Testing Library** for component testing.
- Tests run in a `jsdom` environment to simulate browser behavior.
- Test files should be named `*.test.tsx` or `*.test.ts` and placed alongside the components they test.

---

## 3) End-to-End (E2E) Tests (Playwright)

**Goal:** Prove a real user can run a pipeline from the UI to a **successful terminal state** on the deployed app.

### Scope

- Navigate to pipelines page, fill required fields, and **submit**.
- Optionally capture/display **Run ID** if shown (useful for debugging).
- **Pass criteria:** Visible terminal success signal (e.g., banner “Pipeline finished successfully”, or status badge **COMPLETED**).
- Smoke checks for key pages (render without severe console errors).

### Running locally

```bash
# in the frontend root
npx playwright test
# test with ui:
npx playwright test --ui
```

or if using Docker:

The `odt-tests` container is only available when using the tests profile. To start the application with the test container available, use:

```bash
npm run docker:start:test
# or for development with hot reloading:
npm run docker:watch:test
```

See [Using Docker]({{ site.baseurl }}{% link using-docker.md %}) for more details on Docker profiles.

Then run Playwright tests:

```bash
# run all tests:
docker compose run --rm odt-tests
# run a specific test:
docker compose run --rm odt-tests test tests/scrinshot.spec.ts --reporter=html
# inspect the test results:
docker compose run --rm odt-tests show-report
```

---

## Continuous Integration (GitHub Actions)

**Backend tests (Pytest)**, **Frontend tests (Vitest)**, and **E2E tests (Playwright)** run on every push/PR.  
Set `E2E_BASE_URL` as a repository secret to point E2E tests to the hosted app.

You can find the configuration at:

- `.github/workflows/pr_tests.yml` - Backend and Frontend tests
- `.github/workflows/e2e.yml` - E2E tests
- `.github/workflows/backend_tests.yml` - Backend tests (legacy)
