---
title: Pipeline Timeouts
layout: default
nav_order: 5
parent: Development
---

# Pipeline Timeouts

Pipeline runs that exceed their configured execution limit are stopped so the worker pool is not held by unexpectedly long computations. Authenticated users receive a longer limit than anonymous users.

---

## How it works

When a pipeline run is submitted, the server computes a static Celery soft time limit and attaches it to the pipeline task. If execution is still running when the soft limit is reached, Celery raises a timeout exception in the worker and the run is marked as timed out.

The pipeline task also receives a hard time limit. This is calculated as:

```text
soft limit + PIPELINE_TIMEOUT_HARD_MARGIN
```

The hard limit is a backstop that kills the worker process if the soft timeout cannot stop execution cleanly.

---

## Configuration

Timeouts are configured through environment variables read by the Celery worker.

```text
PIPELINE_TIMEOUT_ANON=3600
PIPELINE_TIMEOUT_AUTHENTICATED_MULTIPLIER=2.0
PIPELINE_TIMEOUT_HARD_MARGIN=300
```

Anonymous users receive `PIPELINE_TIMEOUT_ANON` seconds. Authenticated users receive:

```text
PIPELINE_TIMEOUT_ANON * PIPELINE_TIMEOUT_AUTHENTICATED_MULTIPLIER
```

All values must be positive. The timeout is intentionally static and does not depend on input size or past run duration.

| Variable                                    | Default | Description                                                       |
| ------------------------------------------- | ------- | ----------------------------------------------------------------- |
| `PIPELINE_TIMEOUT_ANON`                     | `3600`  | Soft limit in seconds for anonymous users                         |
| `PIPELINE_TIMEOUT_AUTHENTICATED_MULTIPLIER` | `2.0`   | Multiplier applied to the anonymous limit for authenticated users |
| `PIPELINE_TIMEOUT_HARD_MARGIN`              | `300`   | Extra seconds added to the soft limit before the hard kill limit  |

---

## User feedback

Timed-out runs are stored with status `timeout` and the message `The pipeline exceeded the time limit.` The existing run detail page shows this status and message when the user checks the run.
