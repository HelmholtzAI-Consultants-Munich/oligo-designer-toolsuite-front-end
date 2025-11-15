---
title: Tests
layout: default
nav_order: 6
---

# Tests

This document explains the test strategy for this software. There are **two** layers:

1. **Backend unit & API tests** using **Pytest** for the Flask backend.  
2. **End-to-end (E2E) tests** using **Playwright**, executed in **GitHub Actions** against the hosted app, to validate full pipelines.

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
pytest -q
# with coverage:
pytest --maxfail=1 --disable-warnings --cov=flask --cov-report=term-missing
```

or if using Docker:
```bash
docker compose up mongodb -d
docker compose run --rm odt-server pytest -q
# with coverage:
docker compose run --rm odt-server pytest --cov=. --cov-report=term-missing
```

### Fixtures & notes
- **Never** execute real long-running pipelines in unit tests; **mock** them and assert:
  - request validation
  - scheduling trigger
  - persisted records / status initialization
---

## 2) End-to-End (E2E) Tests (Playwright)

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

**Backends tests (Pytest)** and **E2E (Playwright)** run on every push/PR.  
Set `E2E_BASE_URL` as a repository secret to point E2E tests to the hosted app.

You can find the configuration at `.github/backend_tests.yml` and `.github/e2e.yml`.
