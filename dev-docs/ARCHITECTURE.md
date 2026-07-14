# Architecture

This document summarizes the high-level architecture of ODT-Cloud: the main components, their repository locations, and how they interact.
If you want to contribute to the project please also read the [Contributing Guide](CONTRIBUTING.md).
For more information on how to maintain the project refer to the [Admin Guide](ADMIN_GUIDE.md).

## High-level summary

- Frontend: A React + Vite single-page application (SPA) that implements the UI and communicates with the backend via HTTP APIs.
- Backend: A Python web service (Flask application) that exposes REST endpoints and coordinates background work. Uses MongoDB for metadata/persistence and Redis for Celery broker/cache.
- Workers: Celery-based background workers for long-running tasks (asset downloads, genomic region generation, pipeline execution). Workers use Redis as the broker/result backend and for transient caches.
- Data & cache: Local data directories for generated artifacts, genomic databases, and caches.
- Database & broker: MongoDB for metadata/persistence; Redis for Celery broker and transient caches.
- Deployment: Containerised with Docker; orchestrated via Docker Swarm and provisioned with Ansible; Traefik is used as the reverse proxy and nginx as the web server in production.

![architecture overview](/dev-docs/assets/images/architecture.png)

## Components and locations

- Frontend (UI): [`src/`](/src/)
  - Entrypoints: [`src/index.tsx`](/src/index.tsx), [`src/App.tsx`](/src/App.tsx)
  - Tests: [`src/tests/`](/src/tests/)
  - Web Server: nginx using [`nginx.conf`](/nginx.conf) for static file serving.
  - Purpose: User-facing SPA built with React + TypeScript and bundled with Vite. Handles client routing, forms, validation and UX for pipeline configuration. Also adds the admin interface for monitoring and user management.

- Backend (API & Core logic): [`backend/`](/backend/)
  - Entrypoints: [`backend/app.py`](/backend/app.py), [`backend/cli.py`](/backend/cli.py)
  - Key modules: [`backend/config.py`](/backend/config.py), [`backend/extensions.py`](/backend/extensions.py), [`backend/cache.py`](/backend/cache.py), [`backend/utils.py`](/backend/utils.py)
  - Data/schema helpers: [`backend/genomic_databases.py`](/backend/genomic_databases.py), [`backend/annotation_cache/`](/backend/annotation_cache/)
  - Tests: [`backend/tests/`](/backend/tests/)
  - Purpose: Hosts HTTP API, performs validation, orchestrates tasks and persistence, exposes administrative CLI helpers.

- Celery Worker: [`backend/worker/`](/backend/worker/) and [`backend/beat/`](/backend/beat/)
  - Entrypoint: [`backend/worker/celery.py`](/backend/worker/celery.py)
  - Purpose: Runs asynchronous jobs and scheduled tasks (e.g. background generation, annotation refreshes).

- Celery Beat: [`backend/beat/`](/backend/beat/)
  - Entrypoint: [`backend/beat/celery.py`](/backend/beat/celery.py)
  - Purpose: Adds scheduled tasks to the task queue.

- Playwright tests: [`tests/`](/tests/):
  - Entrypoint: [`tests/e2e/global-setup.ts`](/tests/e2e/global-setup.ts)
  - Purpose: End-to-end integration tests.

- Infrastructure services:
  - MongoDB: Primary document database used for metadata and persistence (see [`backend/config.py`](/backend/config.py)). In [`compose.yml`](/compose.yml) this is provided by the `odt-db` service.
  - Redis: Used as the Celery broker/result backend and for transient caches (see [`backend/config.py`](/backend/config.py)). In [`compose.yml`](compose.yml) this is provided by the `odt-redis` service.

- Data, caches and generated artifacts: [`backend/data-access/`](/backend/data-access/), [`backend/cache/`](/backend/cache/)
  - Contains: User directories with generated pipeline results, genomic file caches, genomic regions and other runtime artifacts.
  - Configuration: Configurable using environment variables.

- Schemas & Validation: [`schemas/`](/schemas/)
  - JSON schemas used to validate pipeline inputs and forms (e.g., [`oligoseq.schema.json`](/schemas/oligoseq.schema.json)).
  - Origin: These files are generated from ODT's Pydantic models by executing [`backend/worker/models.py`](/backend/worker/models.py).

- Deployment & DevOps:
  - Dockerfiles: [`docker/`](/docker/)
  - Compose: [`compose.yml`](/compose.yml) (base), [`compose.override.yml`](/compose.override.yml) (dev environment), [`compose.prod.yml`](/compose.prod.yml) (prod environment), see [`docker/README.md`](/docker/README.md).
  - Reverse Proxy: Traefik configured in [`compose.prod.yml`](/compose.prod.yml).
  - Provisioning & Deployment: OpenStack and Docker Swarm via Ansible, see [`ansible/README.md`](/ansible/README.md).

- Observability:
  - [`monitoring/`](/monitoring/) contains Prometheus and Grafana configs for metrics and dashboards.
  - Logging: backend logs to stdout (collected by container runtime); consult [`backend/config.py`](/backend/config.py) for log level configuration.

## Data flow on pipeline submission

1. User interacts with the frontend [RJSF](https://github.com/rjsf-team/react-jsonschema-form) form and submits a request.
2. Frontend sends an HTTP request to the backend API.
3. Backend validates input using JSON schemas in [`schemas/`](/schemas/).
4. Backend prepares user directory in [`backend/data-access/`](/backend/data-access/) for uploaded files and either:

- Responds synchronously with small results, or
- Enqueues a background job (via Celery) and returns a job id/status endpoint.

5. Workers pick up tasks, cache downloads of genomic files in [`backend/cache/`](/backend/cache/), write result artifacts to the user directory and update job status.
6. Frontend polls or receives updates to surface job progress and fetch generated artifacts.

## Where to go next

- Read the [`docs/`](/docs/) for user-facing documentation and [`dev-docs/`](/dev-docs/) for developer documentation.
