# ODT Cloud Docker Images

This directory contains the Dockerfiles (and their respective `.dockerignore` files) for building ODT Cloud's container images. Prebuilt images are hosted on GitHub's container registry and can be found [here](https://github.com/orgs/HelmholtzAI-Consultants-Munich/packages?repo_name=oligo-designer-toolsuite-front-end).
For the Docker Compose setup, see `compose.yml` in the root directory.

This README also contains general instructions and advice on using Docker with ODT Cloud.

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

## Building Container Images

### Build Context

For all self-built containers, the build context is the project root. The `.dockerignore` files define files and directories not to be included in the build context for each container. These are also specified relative to the project root.

### Building and Updating Images

To build the container images without starting any containers, run:

```bash
docker compose build
```

Note that since the `odt-tests` container is rarely used, it is not build by default using the above command. To force rebuilding the container, use `docker compose build odt-tests`.

Container builds do not pull the latest version of their base images by default. To update all containers to the latest available version, use `npm run docker:update`. This will pull the latest container images and rebuild the frontend and backend containers using these updated base images.

### Building and Pushing Production Images

> [!WARNING]
> You should prefer to build production images using GitHub Actions as described in the admin guide or documented [here](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end/pull/288).

To execute Docker Compose commands using the production overrides, you have to manually specify the compose files to take into account. We provide a shorthand command for this.

For example, to print the production config, run:

```bash
docker compose -f compose.yml -f compose.prod.yml config
# or using our shorthand:
npm run docker:prod -- config
```

To build new production images using a production env file you keep at `ansible/files/.env`, run:

```bash
docker compose -f compose.yml -f compose.prod.yml --env-file ansible/files/.env build
# or using our shorthand:
npm run docker:prod -- --env-file ansible/files/.env build
```

To push these images to the GitHub Container Registry, make sure you have the necessary permissions and are logged into the container registry. Then run:

```bash
docker compose -f compose.yml -f compose.prod.yml push
# or using our shorthand:
npm run docker:prod -- push
```

## Using Docker for Development

This project provides a Docker Compose setup to deploy containers locally. Make sure that both Docker and the Docker Compose plugin are available before executing these commands. **Note that user data is not preserved across restarts with the provided configuration.**

### Basic Commands

Many helpful commands to use Docker are defined in the `package.json`. Naturally, regular Docker commands not specified in the `package.json` can be used for managing containers too.

To launch all required services, run:

```bash
npm run docker:start
# or with hot code reloading:
npm run docker:watch
```

and when you're finished:

```bash
npm run docker:stop
```

Note that starting the Docker Compose stack with either `npm run docker:start` or `npm run docker:watch` will _always_ attempt to rebuild the container images (except for `odt-tests`).

To view the logs, use:

```bash
npm run docker:logs
# or to only show the logs of a specific container:
npm run docker:logs odt-web
# you can select multiple containers at once:
npm run docker:logs odt-web odt-server
```

### Execute Commands Inside Docker Containers

To enter the shell inside a Docker container, use:

```bash
docker compose exec <container-name> <command>
# e.g. to enter the shell of the server container:
docker compose exec odt-server bash
```

Our Python environments are managed via conda/micromamba, so if you want to use commands provided via Python packages inside of our Docker containers, you have to prefix them with `micromamba run`. You also have to do this if you are in a `sh` shell inside a container. If you are using the bash shell, you can omit this prefix.

```bash
# register a new user using flask cli command
docker compose exec odt-server micromamba run flask user register
# run pipeline in a shell inside of odt-worker
docker compose exec odt-worker bash
(base) 1337c977958a:/app$ genomic_region_generator <arguments>
```

### Running with Profiles

ODT Cloud uses Docker Compose profiles for some optional services. This allows us to avoid starting some services we rarely need for development.

#### Monitoring Profile

This profile is used for all monitoring services (i.e. Prometheus, Grafana and metrics exporters).

To start ODT Cloud and the monitoring services, run:

```bash
npm run docker:start:monitoring
# or with hot code reloading:
npm run docker:watch:monitoring
```

#### Tests Profile

This profile is used for the Playwright container.

To start ODT Cloud and execute the Playwright tests, run:

```bash
npm run docker:test:full
# or just the smoke tests:
npm run docker:test:smoke
```

### Hot Code Reloading

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

### Local Development with Docker

While ODT Cloud can be run with Docker alone, you might prefer to develop using a local development environment and only use Docker for supporting services like the database and message queue. Because of this, the supporting containers (currently `odt-db` and `odt-redis`) are accessible on localhost by default.

To start just the supporting services, run:

```bash
docker compose up odt-db odt-redis -d
```

## Additional Tips for Using Docker

You can check Docker's disk usage using `docker system df`. To reclaim disk space used by Docker (e.g. images, volumes, build cache), run `npm run docker:prune`. Be aware that this might cause significantly increased container building times because of deleted build cache.
