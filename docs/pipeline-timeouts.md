---
title: Pipeline Timeouts
layout: default
nav_order: 5
parent: Development
---

# Pipeline Timeouts

Runs that exceed their time limit are stopped and the user sees a clear error message explaining what happened. Authenticated users get a longer limit than anonymous ones.

---

## How it works

When a run is submitted, the server computes a soft time limit and passes it to the Celery worker alongside the task. If the pipeline is still running when the limit is hit, Celery raises an interrupt inside the worker — the subprocess is killed, an error message is written to the database, and the task is marked as failed. The user sees the message the next time they poll for status.

There is also a hard limit (`soft limit + PIPELINE_TIMEOUT_HARD_MARGIN`). This sends an unblockable SIGKILL as a backstop in case something prevents the soft limit from being handled. The hard limit is not expected to fire under normal circumstances.

---

## Modes

Set `PIPELINE_TIMEOUT_MODE` in your `.env`:

### `config` (default)

Fixed limits read from environment variables. Simple and predictable.

```
PIPELINE_TIMEOUT_MODE=config
PIPELINE_TIMEOUT_ANON=3600
PIPELINE_TIMEOUT_AUTHENTICATED_MULTIPLIER=2.0
```

The authenticated-user timeout is calculated as:

```
PIPELINE_TIMEOUT_ANON × PIPELINE_TIMEOUT_AUTHENTICATED_MULTIPLIER
```

### `heuristic`

Limits are computed automatically from past run durations. Every night, a background job calculates the configured percentile seconds-per-gene rate for each pipeline over the last 30 days and stores it in the cache. At submission time the limit is:

```
percentile_rate × gene_count × PIPELINE_TIMEOUT_HEURISTIC_FACTOR
```

Authenticated users get the same `PIPELINE_TIMEOUT_AUTHENTICATED_MULTIPLIER` applied here as well. Falls back to the `config` values if there is no cache data yet or the gene count cannot be determined.

```
PIPELINE_TIMEOUT_MODE=heuristic
PIPELINE_TIMEOUT_HEURISTIC_FACTOR=3.0       # safety multiplier on top of the percentile baseline
PIPELINE_TIMEOUT_HEURISTIC_PERCENTILE=95    # which percentile to use
PIPELINE_TIMEOUT_HEURISTIC_WINDOW_DAYS=30   # days of history to include
PIPELINE_TIMEOUT_HEURISTIC_MIN_RUNS=5       # minimum successful runs required before heuristics apply
```

A pipeline needs at least `PIPELINE_TIMEOUT_HEURISTIC_MIN_RUNS` successful runs in the window before heuristic data is used; below that threshold it falls back to the fixed config values.

---

## All variables

| Variable                                    | Default  | Description                                                    |
| ------------------------------------------- | -------- | -------------------------------------------------------------- |
| `PIPELINE_TIMEOUT_MODE`                     | `config` | `config` or `heuristic`                                        |
| `PIPELINE_TIMEOUT_ANON`                     | `3600`   | Base soft limit (seconds) for anonymous users                  |
| `PIPELINE_TIMEOUT_AUTHENTICATED_MULTIPLIER` | `2.0`    | Multiplier applied to the base timeout for authenticated users |
| `PIPELINE_TIMEOUT_HARD_MARGIN`              | `300`    | Seconds added on top of soft limit before SIGKILL              |
| `PIPELINE_TIMEOUT_HEURISTIC_FACTOR`         | `3.0`    | Safety multiplier applied to percentile rate                   |
| `PIPELINE_TIMEOUT_HEURISTIC_PERCENTILE`     | `95`     | Percentile of past durations used as baseline                  |
| `PIPELINE_TIMEOUT_HEURISTIC_WINDOW_DAYS`    | `30`     | Rolling window of past runs considered                         |
| `PIPELINE_TIMEOUT_HEURISTIC_MIN_RUNS`       | `5`      | Minimum successful runs required before heuristic data is used |

---

## Choosing a mode

Use **`config`** when you have a rough sense of how long pipelines take and want predictable behaviour. Use **`heuristic`** once you have a few weeks of production data and want limits that adapt automatically as input sizes change over time.

If you are just starting out, leave it on `config` with generous limits and switch to `heuristic` after you have collected enough run history.
