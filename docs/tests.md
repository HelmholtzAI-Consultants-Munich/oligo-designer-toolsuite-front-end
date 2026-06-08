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

**Goal:** Verify Flask routes, backend logic, worker tasks, and route-to-task integration in an isolated,
repeatable environment.

### Scope

- Status codes, response payloads, validation, and error handling of API endpoints.
- Auth/session flows (login, logout, protected routes).
- Pipeline submission and scheduling for Scrinshot, MERFISH, SeqFISH, and OligoSeq.
- Celery tasks tested individually and through pipeline routes using `celery.contrib.pytest`.
- Genomic database, pipeline runner, cleanup, reporting, and administrative behavior.
- Real MongoDB operations against a uniquely named test database.
- Real filesystem operations under pytest-managed temporary directories.

### Running backend tests

Backend tests run in the `odt-server` container. Docker Compose starts the required MongoDB and Redis
services, and `--build` ensures the container contains the current backend code and test dependencies.

```bash
# Run the complete backend test suite.
docker compose run --rm --build odt-server pytest

# Run the complete suite with coverage.
docker compose run --rm --build odt-server \
  pytest --cov=backend --cov-report=term-missing

# Run one test module.
docker compose run --rm --build odt-server \
  pytest backend/tests/test_pipeline_routes.py

# Run one test by name.
docker compose run --rm --build odt-server \
  pytest backend/tests/test_pipeline_routes.py -k authenticated_success
```

Run these commands from the repository root. The backend test job in GitHub Actions uses the same pytest
suite with MongoDB and Redis service containers.

### Fixtures & notes

- Tests may read static input data from `backend/tests/data`; they must not depend on any other
  pre-existing files, directories, or database records.
- Use pytest temporary-path fixtures for test files and directories. Pytest cleans those paths after the
  test. If application code creates a resource outside a pytest-managed path, its fixture must own that
  resource and remove it after `yield`.
- Use only the standard library's `unittest.mock` at external boundaries such as network requests,
  OAuth providers, and long-running pipeline executables. Do not mock ordinary filesystem access.
- Celery tests use `celery.contrib.pytest`. Task tests exercise the task body through a test worker, and
  integration tests verify that Flask pipeline routes dispatch work to that worker.
- MongoDB collections are cleared around every test, and the uniquely named test database is dropped at
  the end of the session.

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

**Goal:** Prove a real user can run a pipeline from the UI to a **successful terminal state** with the Dockerized full stack (frontend, Flask API, Celery worker, MongoDB, and Redis).

### Scope

- Navigate to a pipeline page, fill required fields, and **submit**.
- Capture the **Run ID** from the submission modal and open the corresponding run detail page.
- **Pass criteria:** the run detail page reaches backend state `success`, exposes expected artifacts such as `genomic_regions.yaml`, and renders result content.
- The PR `@smoke` suite keeps a smaller stable subset, while the monthly `@full` suite covers each supported pipeline with real execution.

### Suites

- `@smoke`: fast confidence checks used on pull requests. This suite verifies the app stack starts, key pipeline pages render, and at least one real pipeline run can be submitted and completed successfully.
- `@full`: broader regression coverage used for the monthly scheduled run and manual deep checks. This suite runs the same real end-to-end flow for every supported pipeline covered by Playwright.
- Use `@smoke` for quick feedback and merge protection.
- Use `@full` when you want stronger cross-pipeline confidence and are willing to pay the longer runtime.

### Running locally

```bash
# run the complete monthly-style suite
npm run test:e2e:full

# run the PR smoke suite
npm run test:e2e:smoke

# or use Playwright directly
npx playwright test --grep @full
npx playwright test --grep @smoke
```

or if using Docker:

```bash
npm run docker:test          # builds the stack, runs full suite, then exits
npm run docker:test:smoke    # smoke suite only (requires a running stack)
npm run docker:test:full     # full suite only (requires a running stack)

# for development with hot reloading (syncs code changes into running containers):
npm run docker:watch:test
```

`docker:test` starts the full application stack and runs Playwright inside the `odt-tests` container (built from the official Playwright Docker image). `docker:watch:test` does the same but keeps containers running and syncs file changes, so you can iterate on tests without rebuilding. To re-run a specific suite against an already-running stack, use `docker:test:smoke` or `docker:test:full`.

See [Using Docker]({{ site.baseurl }}{% link using-docker.md %}) for more details on Docker profiles.

---

## Continuous Integration (GitHub Actions)

**Backend tests (Pytest)** and **Frontend tests (Vitest)** run on pull requests.  
**Playwright E2E tests** run as a `@smoke` suite on pull requests and as a `@full` suite on a monthly schedule or manual dispatch, using Docker Compose plus the official Playwright Docker image.

You can find the configuration at:

- `.github/workflows/pr_tests.yml` - Backend and Frontend tests
- `.github/workflows/e2e.yml` - E2E tests
