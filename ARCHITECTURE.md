# Architecture

This document summarizes the high-level architecture of the ODT-Cloud project, its main components, where they live in the repository, and how they interact. It is intended as a quick orientation for contributors and maintainers.
If you want to contribute to the project please also read the [Contributing Guide](CONTRIBUTING.md).
For more information on how to maintain the project refer to the [Admin Guide](ADMIN_GUIDE.md).

> Separation of concerns: the system splits responsibilities into a fast HTTP API (backend) and asynchronous workers (Celery) for long-running computation. This keeps the API responsive and allows workers to scale independently.

## High-level summary

- Frontend: A React + Vite single-page application that implements the UI and communicates with the backend via HTTP APIs.
- Backend: A Python web service (Flask-like layout) that exposes REST endpoints and coordinates background work.
- Workers: Celery-based background workers for long-running tasks (generation, annotation, pipeline steps).
- Data & cache: Local data directories for generated artifacts, genomic databases, and caches.
- Deployment: Containerised with Docker; orchestrated via `docker-compose` and optionally provisioned with Ansible; `nginx` is used as a reverse proxy in production.
  ![architecture overview](docs/assets/images/architecture.png)

## Components and locations

- **Frontend (UI)**: `src/`
  - Entrypoints: `src/index.tsx`, `src/App.tsx`
  - Tests & e2e: `tests/`, `playwright/`
  - Purpose: User-facing SPA built with React + TypeScript and bundled with Vite. Handles client routing, forms, validation and UX for pipeline configuration.

- **Backend (API & Core logic)**: `backend/`
  - Entrypoints: `backend/app.py`, `backend/cli.py`
  - Key modules: `backend/config.py`, `backend/extensions.py`, `backend/cache.py`, `backend/utils.py`
  - Data/schema helpers: `backend/genomic_databases.py`, `backend/annotation_cache/`
  - Purpose: Hosts HTTP API, performs validation, orchestrates tasks and persistence, exposes administrative CLI helpers.

- **Workers & Scheduling**: `backend/beat/`, `worker/`
  - Celery: `backend/beat/celery.py` and worker Dockerfile `worker.Dockerfile`
  - Purpose: Run asynchronous jobs and scheduled tasks (e.g., background generation, annotation refreshes).

- **Data, caches and generated artifacts**: `backend/data/`, `backend/cache/`
  - Contains: generated oligoseq results, annotation caches, genomic regions and other runtime artifacts.

- **Schemas & Validation**: `schemas/`
  - JSON schemas used to validate pipeline inputs and forms (e.g., `oligoseq.schema.json`, `fastaForm.schema.json`).

- **Documentation**: `docs/`
  - Contains user and developer docs, design notes and operational runbooks.

- **Deployment & DevOps**: top-level files and folders
  - Dockerfiles: `docker/`, `web.Dockerfile`, `server.Dockerfile`, `worker.Dockerfile` (also found at project root under `docker/`)
  - Compose: `compose.yml` and environment-specific overrides like `compose.prod.yml` and `compose.override.yml`.
  - Reverse proxy: `nginx.conf` for production proxying and static-serving.
  - Provisioning: `ansible/` contains playbooks and inventory for cloud provisioning and deployment automation.

- **Observability**:
  - `monitoring/` contains Prometheus and Grafana configs for metrics and dashboards.
  - Logging: backend logs to stdout (collected by container runtime); consult `backend/config.py` for log level configuration.

- **Testing and Verification**:
  - Unit & integration tests: `backend/tests/`, `src/tests/`
  - End-to-end: `playwright/`, `tests/e2e/` folder for browser scenarios.

## Data flow (high level)

1. User interacts with the frontend SPA and submits a request.
2. Frontend sends an HTTP request to the backend API.
3. Backend validates input (schemas in `schemas/`) and either:
   - Responds synchronously with small results, or
   - Enqueues a background job (via Celery) and returns a job id/status endpoint.
4. Workers pick up tasks, write artifacts to `backend/data/` or caches in `backend/cache/`, and update job status.
5. Frontend polls or receives updates to surface job progress and fetch generated artifacts.

## Where to go next

- Read the ([`docs/`](docs/)) for deeper guides and runbooks.
