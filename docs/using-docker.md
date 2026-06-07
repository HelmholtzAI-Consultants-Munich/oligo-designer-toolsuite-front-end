---
title: Using Docker
layout: default
nav_order: 2
parent: Development
---

# Using Docker

ODT Cloud can be run and deployed using Docker containers. The provided configuration should only be used for development. For production deployment, please get in touch with us.

---

## Quickstart

This project provides a single `compose.yml` file to deploy containers locally. Make sure that both Docker and the Docker Compose plugin are available before executing these commands. **Note that user data is not preserved across restarts with the provided configuration.**

All commands necessary to use Docker are defined in the `package.json`. To launch the frontend, backend and database, run:

```bash
npm run docker:start
# or for development:
npm run docker:watch
```

and when you're finished:

```bash
npm run docker:stop
```

To view the logs, use:

```bash
npm run docker:logs
# or to only show the logs of a specific container:
npm run docker:logs odt-web
# you can select multiple containers at once:
npm run docker:logs odt-web odt-server
```

## Running with Profiles

ODT Cloud supports Docker Compose profiles for optional services. Currently, two profiles are available:

### Monitoring Profile

To start the application with monitoring services (Prometheus, Grafana, and exporters), use:

```bash
npm run docker:start:monitoring
# or for development with hot reloading:
npm run docker:watch:monitoring
```

This will start all standard services plus the monitoring stack. See [Monitoring]({{ site.baseurl }}{% link monitoring.md %}) for more details.

### Tests Profile

To start the application with the test container available, use:

```bash
npm run docker:start:test
# or for development with hot reloading:
npm run docker:watch:test
```

This will start all standard services plus the `odt-tests` container. See [Tests]({{ site.baseurl }}{% link tests.md %}) for more details on running tests.

---

## Docker Project Structure

The Dockerfiles used for building the frontend, backend and Playwright tests containers are located in the `docker` directory, along with their respective [`.dockerignore`](https://docs.docker.com/build/concepts/context/#dockerignore-files) files.

The `compose.yml` at the project root defines the containers used for ODT Cloud and their respective configuration.
The `compose.override.yml` contains the default overrides for development whereas `compose.prod.yml` contains configuration used for production deployment with Docker Swarm.

Currently, the project consists of the following containers:

|     Service      |    Name    | Self-Built? |    Dockerfile     |                        Base Images                        |
| :--------------: | :--------: | :---------: | :---------------: | :-------------------------------------------------------: |
|     Frontend     |  odt-web   |     yes     |  web.Dockerfile   | node:22-alpine3.22,nginxinc/nginx-unprivileged:alpine3.23 |
|     Backend      | odt-server |     yes     | server.Dockerfile |             mambaorg/micromamba:2-alpine3.22              |
|      Worker      | odt-worker |     yes     | worker.Dockerfile |             mambaorg/micromamba:2-alpine3.22              |
|     Database     |   odt-db   |     no      |         -         |                          mongo:8                          |
| Celery / Caching | odt-redis  |     no      |         -         |                      redis:8-alpine                       |
|    Playwright    | odt-tests  |     yes     | tests.Dockerfile  |        mcr.microsoft.com/playwright:v1.58.2-noble         |

## Build Configuration

For all self-built containers, the build context is the project root. The `.dockerignore` files define files and directories not to be included in the build context for each container. These are also specified relative to the project root.

## Building and Updating Containers

Starting the Docker Compose stack with the provided commands will automatically build the required containers if they haven't been already. Note that you should prefer `npm run docker:watch` for development since it _always_ attempts to rebuild to apply the latest changes.

Container builds do not pull the latest version of their base images by default. To update all containers to the latest available version, use `npm run docker:update`. This will pull the latest container images and rebuild the frontend and backend containers using these updated base images.

Naturally, regular Docker commands not specified in the `package.json` can be used for managing containers too.

## Local Development with Docker

While ODT Cloud can be run with Docker alone, you might prefer to develop locally and only use Docker for supporting services like the database and message queue. Because of this, the supporting containers (currently `odt-db` and `odt-redis`) are accessible on localhost by default.

To start just the supporting services, run:

```bash
docker compose up odt-db odt-redis -d
```

## Building and Running the Playwright Tests

The `odt-tests` container contains the Playwright testing environment, including all necessary browsers. Because of the large size and rare usage of this image, **it is not built or started** using the commands specified in the `package.json`.

To force rebuilding the container, use:

```bash
docker compose build odt-tests
# or if you want to run all tests too:
docker compose run --build odt-tests
```

See [Tests]({{ site.baseurl }}{% link tests.md %}) for details on executing Playwright tests using Docker.

## Hot Code Reloading

With hot code reloading, code changes are automatically propagated into the respective containers. The Docker setup supports this both for the frontend and the backend using Docker Compose's built-in [Watch](https://docs.docker.com/compose/how-tos/file-watch/) feature.

If a container crashes (e.g. because of autosave triggering a sync of an incomplete change), it will be restarted until it either stops crashing (e.g. because the change was completed and synced) or is stopped manually.

To start the containers using hot code reloading, run:

```bash
npm run docker:watch
```

To start the containers **without** hot code reloading, run:

```bash
npm run docker:start
```

As an example, take a look at the backend's `watch` configuration in the Docker Compose file:

```yaml
#...
odt-server:
  image: odt-server
  #...
  restart: on-failure
  develop:
    watch:
      - action: sync
        path: ./backend
        target: /app/backend
        initial_sync: true
#...
```

The code contained in the `odt-server` image might be out of date compared to the local filesystem, which is why `initial_sync: true` ensures the `backend` directory is synced into the container on startup. As long as `watch` is active, any changes made to files in the `backend` directory are synced into the `/app/backend` directory inside of the container. The Flask server also watches for file changes and will reload.

## Additional Tips for using Docker

You can check Docker's disk usage using `docker system df`. To reclaim disk space used by Docker (e.g. images, volumes, build cache), run `npm run docker:prune`. Be aware that this might cause significantly increased container building times because of deleted build cache.

## Execute commands inside docker container

To enter the shell inside the docker containers you can use the basic docker compose exec command like this

```bash
docker compose exec <container-name> <command>
# for example to enter the shell of the server container use
docker compose exec odt-server bash
```

Our python environments are managed via conda/micromamba, so if you want to use commands provided via python packages inside of our docker containers you have to prefix them with `micromamba run`. You also have to do this if you are in a `sh` shell inside a container, but if you are using the bash shell you can omit this prefix.

```bash
# register a new user using flask cli command
docker compose exec odt-server micromamba run flask user register
# run pipeline in a shell inside of odt-worker
docker compose exec odt-worker bash
(base) 1337c977958a:/app$ genomic_region_generator [ARGUMENTS]
```

## Building and pushing production container images

To execute `docker compose` commands using the production overrides, you have to manually specify the compose files to take into account.

For example, to print the production config, run:

```bash
docker compose -f compose.yml -f compose.prod.yml config
```

To build new production images using a production env file you keep at `ansible/files/.env`, run:

```bash
docker compose -f compose.yml -f compose.prod.yml --env-file ansible/files/.env build
```

To push these images to the GitHub Container Registry, run:

```bash
docker compose -f compose.yml -f compose.prod.yml push
```
