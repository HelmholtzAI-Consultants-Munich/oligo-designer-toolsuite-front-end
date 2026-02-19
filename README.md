<div align="center">

# Oligo Designer Toolsuite Cloud

_A lightweight, user-friendly interface for custom oligo design pipelines_

[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Backend Tests](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end/actions/workflows/backend_tests.yml/badge.svg)
![E2E Tests](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end/actions/workflows/e2e.yml/badge.svg)</div>

---

This repository contains the **frontend web application** for the [Oligo Designer Toolsuite](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite):  
A modular, open-source platform for running custom oligo design pipelines (such as SeqFISH+, Scrinshot, Oligo-Seq, and MERFISH) on your own server or in the cloud.

Deploying this frontend allows **multiple users to access, configure, and run oligo design pipelines via a browser**. The frontend talks to the backend REST API (Python Flask) where all core logic and computation happens.

**Features:**

- Modern React + TypeScript web app
- Multi-user support with authentication
- Uploads your sequence data and parameters
- Visualizes pipeline progress and results
- Integrates seamlessly with the backend to provide a full-featured design platform for:
  - SeqFISH+
  - Scrinshot
  - Oligo-Seq
  - MERFISH
  - Genomic Region Generator

---

## How does it work?

This web app connects to the [Oligo Designer Toolsuite backend](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite) (Flask Python API).

- The **backend** runs the actual pipelines and manages all scientific computation and files.
- The **frontend** provides a clean, multi-user web interface for running and managing jobs, tracking progress, and visualizing results.

### **You must deploy both the frontend and backend to make the system available to users.**

---

### Supported platforms

The project supports Linux and MacOS, both on amd64 and arm64 architectures. Development on Windows is possible using Docker.

## Quickstart (using Docker)

This project provides a single `docker-compose.yml` file to deploy containers locally. Make sure that both Docker and the Docker Compose plugin are available before executing these commands. **Note that user data is not preserved across restarts with the provided configuration.**

All commands necessary to use Docker are defined in the `package.json`. To launch the frontend, backend and database, run:

```bash
npm run docker:watch
```

See [Using Docker](docs/using-docker.md) for details on using Docker for this project.

## Manual Installation

### 1. Install the Oligo Designer Command line interface first

Before running the frontend, follow the [CLI installation instructions](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite). This step is crucial for running the pipelines through the frontend.

### 2. Install frontend dependencies

Clone this repo and install dependencies:
"odt" is the name of conda environment that is created in the first step of the installation.
Please do not install with the requirements.txt; It is for testing purposes.

```bash
git clone https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end.git
cd oligo-designer-frontend
npm install
conda activate odt
conda env update -f backend/environment.yml
pip install --group backend/pyproject.toml:dev
```

You can also set up additional environment variables as needed for authentication, proxy, etc.

### 3. Run the frontend

```bash
./start.sh
```

The app will open at [http://localhost:3000](http://localhost:3000).

## Supported Pipelines

The following pipelines are available through the web interface:

- **SeqFISH+ Probe Designer**
- **Scrinshot Probe Designer**
- **Oligo-Seq Probe Designer**
- **MERFISH Probe Designer**
- **Genomic Region Generator** (as a submodule)

See the [Oligo Designer Toolsuite](https://oligo-designer-toolsuite.readthedocs.io/en/latest/) for details.

---

## For Developers

- Written in TypeScript + React for frontend.
  - npm for environment setup
  - Vite as build tool
  - Vitest as testing framework
  - Playwright for integration tests
- Written in Python + Flask for backend.
  - Conda for environment setup
  - MongoDB as database

---

## License

Released under the [MIT License](https://opensource.org/licenses/MIT).

---

**Questions? Bugs?**  
Please open an [issue](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end/issues)

---

## Citation

If you use this platform, please cite the main [Oligo Designer Toolsuite](https://doi.org/10.5281/zenodo.7823048) as described in the backend [README](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite#how-to-cite).

---
