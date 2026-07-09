# ODT-Cloud — Architecture Overview

This document summarizes the high-level architecture of the ODT-Cloud project, its main components, where they live in the repository, and how they interact. It is intended as a quick orientation for contributors and maintainers.

## Goals

- Provide a single-page overview describing major subsystems.
- Point to important directories and entry points for each subsystem.
- Capture deployment and runtime notes to make onboarding easier.

## High-level summary

- Frontend: A React + Vite single-page application that implements the UI and communicates with the backend via HTTP APIs.
- Backend: A Python web service (Flask-like layout) that exposes REST endpoints and coordinates background work.
- Workers: Celery-based background workers for long-running tasks (generation, annotation, pipeline steps).
- Data & cache: Local data directories for generated artifacts, genomic databases, and caches.
- Deployment: Containerised with Docker; orchestrated via `docker-compose` and optionally provisioned with Ansible; `nginx` is used as a reverse proxy in production.

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

- **Public & static assets**: `public/` (manifests, robots.txt) and `src/images/`.

- **Monitoring**: `monitoring/` contains Prometheus and Grafana configs for metrics and dashboards.

## Data flow (high level)

1. User interacts with the frontend SPA and submits a request (e.g. configure a pipeline or request oligo generation).
2. Frontend sends an HTTP request to the backend API.
3. Backend validates input (schemas in `schemas/`) and either:
   - Responds synchronously with small results, or
   - Enqueues a background job (via Celery) and returns a job id/status endpoint.
4. Workers pick up tasks, write artifacts to `backend/data/` or caches in `backend/cache/`, and update job status.
5. Frontend polls or receives updates to surface job progress and fetch generated artifacts.

## Runtime & local development

- Quick local development run (recommended):

```bash
# start backend + frontend using the provided script (uses docker-compose / local dev setup)
./start.sh
```

- Container based (Docker Compose):
  - `docker-compose -f compose.yml up --build` or use the provided `compose.*.yml` stacks.
  - `nginx` is included in production compose to serve the frontend and reverse-proxy the API.

- Ansible: Use `ansible/playbook.yml` and inventory in `ansible/inventory.ini` for provisioning cloud hosts and deploying images to hosts.

## Important files to inspect when changing behavior

- Frontend: `src/index.tsx`, `src/App.tsx`, `src/*` (components, hooks, pages)
- Backend: `backend/app.py` (api entry), `backend/cli.py` (management CLI), `backend/config.py` (config values), `backend/extensions.py` (app extensions), `backend/genomic_databases.py` (data access)
- Workers/scheduling: `backend/beat/celery.py`, `worker/Dockerfile`
- Deployment: top-level `compose.yml`, `compose.prod.yml`, `docker/` Dockerfiles, `nginx.conf`, `ansible/`

## Testing and verification

- Unit & integration tests: `backend/tests/`, `src/tests/`
- End-to-end: `playwright/`, `tests/e2e/` folder for browser scenarios.

## Observability

- Metrics and dashboards: `monitoring/` (Prometheus config and Grafana dashboards).
- Logging: backend logs to stdout (collected by container runtime); consult `backend/config.py` for log level configuration.

## Common developer tasks

- Run frontend tests: `pnpm test` or `npm run test` (see `package.json`).
- Run backend locally: create a Python virtualenv, install requirements from `backend/pyproject.toml`, then run `python backend/app.py` or use the provided Docker setup.
- Start worker locally: use the Celery command configured in `backend/beat/celery.py` or run the `worker` service in docker-compose.

## Notes & rationale

- The project intentionally separates fast HTTP request handling (API) from long-running computation (Celery workers) to keep the API responsive and horizontally scalable.
- Static assets and the SPA are bundled separately to allow independent deployment and CDN caching when necessary.

## Where to go next

- Read the developer `README.md` and `docs/` for deeper guides and runbooks.
- If you want, I can add a simple ASCII or Mermaid diagram showing component interactions, or expand any section into more detail.
