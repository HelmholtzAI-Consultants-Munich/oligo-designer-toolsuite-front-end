# Architecture

This document summarizes the high-level architecture of ODT-Cloud: the main components, their repository locations, and how they interact.
If you want to contribute to the project please also read the [Contributing Guide](/CONTRIBUTING.md).
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

- Playwright tests: [`tests/`](/tests/)
  - Entrypoint: [`tests/e2e/global-setup.ts`](/tests/e2e/global-setup.ts)
  - Purpose: End-to-end integration tests.

- Infrastructure services:
  - MongoDB: Primary document database used for metadata and persistence (see [`backend/config.py`](/backend/config.py)). In [`compose.yml`](/compose.yml) this is provided by the `odt-db` service.
  - Redis: Used as the Celery broker/result backend and for transient caches (see [`backend/config.py`](/backend/config.py)). In [`compose.yml`](compose.yml) this is provided by the `odt-redis` service.

- Data, caches and generated artifacts: [`backend/data-access/`](/backend/data-access/), [`backend/cache/`](/backend/cache/)
  - Contains: User directories with generated pipeline results, genomic file caches, genomic regions and other runtime artifacts.
  - Configuration: Configurable using environment variables.

- Form schemas: [`backend/worker/models.py`](/backend/worker/models.py), [`backend/routes/schemas.py`](/backend/routes/schemas.py)
  - Each pipeline's JSON Schema is generated from ODT's Pydantic models when the Flask server starts, and served at `GET /api/pipelines/<pipeline_name>/schema`.
  - The frontend fetches a schema when its pipeline page opens (see [`src/pipelineConfig/schemaApi.ts`](/src/pipelineConfig/schemaApi.ts)) and derives the RJSF UI Schema from it.
  - The server builds every schema once at startup (`warm_pipeline_schemas`, called from [`backend/app.py`](/backend/app.py)) and keeps it in memory, so the first user to open a form does not wait for it. If a schema fails to build there, the error is logged and the request for it tries again.
  - Responses carry an `ETag` and `Cache-Control: no-cache`: the browser revalidates on every load and gets an empty `304 Not Modified` while the schema is unchanged. This saves resending tens of kilobytes but never serves a stale schema after an ODT upgrade.
  - An unknown pipeline name returns `404` with `{"error": "Pipeline \"<pipeline_name>\" does not exist"}`.
  - No schema files are checked in, so there is nothing to regenerate after an ODT upgrade: rebuild the `odt-server` and `odt-worker` images and the forms follow. Rebuild both, since the server builds the forms and validates submissions with ODT's models and the worker runs the pipelines with ODT, so they must use the same ODT version. To try out an unreleased ODT version, set the `ODT_REF` build arg (see [`docker/README.md`](/docker/README.md#using-an-unreleased-odt-version)).

- Deployment & DevOps:
  - Dockerfiles: [`docker/`](/docker/)
  - Compose: [`compose.yml`](/compose.yml) (base), [`compose.override.yml`](/compose.override.yml) (dev environment), [`compose.prod.yml`](/compose.prod.yml) (prod environment), see [`docker/README.md`](/docker/README.md).
  - Reverse Proxy: Traefik configured in [`compose.prod.yml`](/compose.prod.yml).
  - Provisioning & Deployment: OpenStack and Docker Swarm via Ansible, see [`ansible/README.md`](/ansible/README.md).

- Observability:
  - [`monitoring/`](/monitoring/) contains Prometheus and Grafana configs for metrics and dashboards.
  - Logging: backend logs to stdout (collected by container runtime); consult [`backend/config.py`](/backend/config.py) for log level configuration.

## Data flow on pipeline submission

1. Frontend fetches the pipeline's JSON Schema from the backend and builds the [RJSF](https://github.com/rjsf-team/react-jsonschema-form) form from it.
2. User fills in the form and submits it, and the frontend sends an HTTP request to the backend API.
3. Backend validates the submission against the pipeline's Pydantic model (`PIPELINE_VALIDATION_MODELS` in [`backend/worker/models.py`](/backend/worker/models.py)).
4. Backend prepares user directory in [`backend/data-access/`](/backend/data-access/) for uploaded files and either:

- Responds synchronously with small results, or
- Enqueues a background job (via Celery) and returns a job id/status endpoint.

5. Workers pick up tasks, cache fetched genomic files in [`backend/cache/`](/backend/cache/), write result artifacts to the user directory and update job status.
6. Frontend polls or receives updates to surface job progress and fetch generated artifacts.

## Pipeline Forms

Each pipeline page (e.g. [`src/pages/Hcr.tsx`](/src/pages/Hcr.tsx)) only renders `PipelineForm` ([`src/components/forms/PipelineForm.tsx`](/src/components/forms/PipelineForm.tsx)) with the pipeline's name and title. `PipelineForm` fetches the schema through [`src/pipelineConfig/schemaApi.ts`](/src/pipelineConfig/schemaApi.ts), shows a spinner while it loads and a **Form unavailable** alert if the request fails, and then renders `PipelineTemplate` ([`src/components/forms/PipelineTemplate.tsx`](/src/components/forms/PipelineTemplate.tsx)) with the schema and the derived UI Schema. `schemaApi.ts` keeps each schema for the rest of the page load, so revisiting a form renders it at once, and gives up after 15 seconds.

### How the UI Schema Is Built

`uiSchemaFromJsonSchema` in [`src/pipelineConfig/uiSchemas.ts`](/src/pipelineConfig/uiSchemas.ts) walks the JSON Schema recursively, resolves every `$ref`, and picks the layout of an object by its depth:

| Depth | Template                    | Renders as                                                                                      |
| ----- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| `0`   | `TabsLayout`                | one tab per top-level field; `schema_version` and `required_parameters` get no tab of their own |
| `1`   | `TabLayout`                 | the content of one tab: an accordion of its sections                                            |
| `2`   | `SectionLayout`             | one item of the tab's accordion                                                                 |
| `3+`  | `CompactFieldGroupTemplate` | an object with only scalar fields (e.g. per-base thresholds), packed into a compact row         |

On top of the depth, these rules apply:

- Toggles: a union discriminated by `enabled` (e.g. an optional filter), or an object whose only field is `enabled`, uses `EnabledToggleObjectTemplate`. A checkbox heads a card, and the filter's parameters only show while it is enabled.
- Other discriminated unions: for a discriminator such as `source: "generate" | "load"`, RJSF's dropdown picks the option, labelled with the discriminator value (**Generate**, **Load**). The discriminator field itself is hidden, and each option renders with `BareGroupTemplate`, which shows the fields without a heading because the dropdown already names the choice.
- `x-collapsed`: a field with this flag in the ODT model uses `CollapsibleSectionLayout` and starts collapsed.
- `x-quick-setting`: a field with this flag in the ODT model moves to the **Quick Settings** panel at the top of its tab. The fields of `required_parameters` move to the **Required Parameters** panel on the first tab. Both panels come from `QuickSettingsPanel` ([`src/components/forms/QuickSettingsPanel.tsx`](/src/components/forms/QuickSettingsPanel.tsx)); the fields stay in place in the form and render into the panel through a React portal (see `FieldTemplate`), so their data binding is unchanged.
- `const` fields other than `enabled` are hidden, since they only state which option is selected.

The schema cannot tell file inputs apart from other strings or string arrays, so some fields get their widget by name:

| Field name                                           | Widget            | Purpose                                                                     |
| ---------------------------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| `targets`, `file_region_ids`                         | `txtUploadInput`  | comma-separated list, or upload of a `.txt` file                            |
| `target_genome`, `reference_genome`, `files_fasta_*` | `genomicInput`    | FASTA from the Genomic Region Generator, or upload                          |
| `files_vcf_*`                                        | `fileUpload`      | upload of `.vcf` files only                                                 |
| `file`                                               | `singleFileInput` | the one file a **Load** option reads (codebook, readout or initiator table) |

> [!WARNING]
> Renaming one of these fields in ODT silently drops its widget. Check the forms after an ODT upgrade.

`falsyDeclaredDefaults` in [`src/pipelineConfig/defaults.ts`](/src/pipelineConfig/defaults.ts) seeds the form data with falsy defaults that a model declares next to a `$ref` (e.g. `dnac2=0`). Without it, RJSF ignores a falsy override and shows the referenced model's own default instead.

On the backend, `build_pipeline_schema` in [`backend/worker/models.py`](/backend/worker/models.py) removes the docstrings of the models declared in that file, since the frontend would show them as help text, and widens the `file` and `files_vcf_reference_database` fields to accept the `File` objects the form holds until submission.

## Adding a Pipeline

1. Make sure the installed ODT version provides the pipeline's config model (`...ProbeDesignerConfig`), its `...ConfigBase` without `general`, and its pipeline function. Bump the version in [`backend/pyproject.toml`](/backend/pyproject.toml), or set `ODT_REF` for an unreleased version.
2. In [`backend/constants.py`](/backend/constants.py), add the pipeline to `PIPELINE_MODELS` (config model and function), `PIPELINE_NON_EXPOSED_FIELDS` (output directory name) and `PIPELINE_GENOMIC_INPUT`. If the form uploads files, list their paths in `PIPELINE_FILE_INPUT`.
3. In [`backend/worker/models.py`](/backend/worker/models.py), add the `...ConfigBase` to `FRONT_END_SCHEMAS`. This also creates its entry in `PIPELINE_VALIDATION_MODELS` and serves its schema at `GET /api/pipelines/<pipeline_name>/schema`.
4. If the model has upload fields not named `file` or `files_vcf_*`, widen them in `build_pipeline_schema` and map a widget in [`src/pipelineConfig/uiSchemas.ts`](/src/pipelineConfig/uiSchemas.ts).
5. In [`src/pipelineConfig/config.ts`](/src/pipelineConfig/config.ts), add the pipeline to the `Pipeline` union type and to `PIPELINE_CONFIG`: display name, description, ODT docs link, route, card image, `fileDownloads` matching ODT's output file names, and `fileUploadFields` matching `PIPELINE_FILE_INPUT`.
6. Add a page `src/pages/<Name>.tsx` that renders `<PipelineForm pipeline="<pipeline_name>" title="..." />`.
7. Add the route `/pipelines/<pipeline_name>` to `defaultLayoutRoutes` in [`src/App.tsx`](/src/App.tsx).
8. Optionally add the pipeline to `displayOrder` in [`src/pipelineConfig/overview.ts`](/src/pipelineConfig/overview.ts). Unlisted pipelines still appear in the sidebar and on the pipelines overview, after the listed ones.
9. Add the pipeline to `ALL_PIPELINES` in [`tests/e2e/helpers.ts`](/tests/e2e/helpers.ts) so the smoke test renders its page. [`backend/tests/test_schema_routes.py`](/backend/tests/test_schema_routes.py) covers every entry of `FRONT_END_SCHEMAS` on its own.
10. Document the pipeline in a page under [`docs/`](/docs/) with `parent: Pipelines` and list it in [`docs/pipelines.md`](/docs/pipelines.md).

## Where to go next

- Read the [`docs/`](/docs/) for user-facing documentation and [`dev-docs/`](/dev-docs/) for developer documentation.
