---
title: Using Docker
layout: default
nav_order: 9
---

# Using Docker

ODT Cloud can be run and deployed using Docker containers. The provided configuration should only be used for development. For production deployment, please get in touch with us.

**Warning: Due to a known bug in ODT Cloud, you always have to start a new browser session (e.g. via new private window) to access the application when using Docker.**

---

## Quickstart

This project provides a single `docker-compose.yml` file to deploy containers locally. Make sure that both Docker and the Docker Compose plugin are available before executing these commands. **Note that user data is not preserved across restarts with the provided configuration.**  

To launch the frontend, backend and database, run:
```bash
npm i
docker compose watch
```

and when you're finished:
```bash
docker compose down
```

To view the logs, use:
```bash
docker logs -f odt-web # or odt-server
```

---

## Building and Running the Flask Backend

The Dockerfile located at `flask/Dockerfile` is used to build the backend using a minimal conda environment. In the Docker Compose file, the resulting container is tagged `odt-server`.

To force rebuilding the container, use:
```bash
docker compose build odt-server
# or if you want to start it too:
docker compose run -d --build odt-server
```

## Running the Node Frontend

The Docker Compose file configures a prebuilt Node container and gives it access to the entire working directory with a bind mount. By default, starting the container executes `npm run dev -- --host`. The container is tagged `odt-web`. 

To run an arbitrary command in the container, use:
```bash
docker compose run --rm odt-web <command>
```

## Running the Database

The Docker Compose file configures a prebuild MongoDB container tagged `odt-db`. By default, the container is accessible on localhost.

To start just the database, run:
```bash
docker compose up odt-db -d
```

To limit access to the Docker containers, comment out the lines configuring port forwarding in `docker-compose.yml`:
```yaml
#...
  odt-db:
    image: mongo:8
    container_name: odt-db
    # Comment out these lines to restrict database access from localhost
    ports:
      - 27017:27017
#...
```



## Building and Running the Playwright Tests

The Dockerfile located at `tests/Dockerfile` is used to build the Playwright testing environment, including all necessary browsers. In the Docker Compose file, the resulting container is tagged `odt-tests`. **It is not executed by default.**

To force rebuilding the container, use:
```bash
docker compose build odt-tests
# or if you want to run all tests too:
docker compose run --build odt-tests
```

See [Tests]({% link tests.md %}) for details on executing Playwright tests using Docker.

## Hot Code Reloading

The Docker setup supports hot code reloading both for the frontend and the backend. However, the mechanism to achieve this differs between them.

For the frontend, the entire working directory is bind mounted to the container. Any file changes are reflected inside the container too - the development server picks these up and updates the website if hot code reloading is enabled. This is possible because the container is executed with UID 1000 which is usually equivalent to the permissions set on the files of the local directory.

All relevant code is added to the backend container when it is built. This means that by default, launching the container works with the state of the codebase when it was last built. Due to conflicting file permissions, it's impractical to use a bind mount here. Using Docker Compose's `watch` functionality, the contents of the local `flask` directory are synced into the container upon change.
Note that you might need to force a sync by slightly changing a file to avoid working with outdated code.

With this setup, hot code reloading can't be disabled for the frontend, but it can for the backend.

To launch the frontend, backend and database, run:
```bash
docker compose watch
# or without hot code reloading for the backend:
docker compose up -d
```
