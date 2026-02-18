---
title: Getting Started
layout: default
nav_order: 2
---

# Getting Started

Welcome! This guide will help you set up and run Oligo Designer Toolsuite **Cloud** on your machine.  
This app lets multiple users run advanced oligo design pipelines (SeqFISH+, Scrinshot, Oligo-Seq, MERFISH, etc.) via a web browser.

---

### Supported platforms

The project supports Linux and MacOS, both on amd64 and arm64 architectures. Development on Windows is possible using Docker.

## Quickstart (using Docker)

This project provides a single `docker-compose.yml` file to deploy containers locally. Make sure that both Docker and the Docker Compose plugin are available before executing these commands. **Note that user data is not preserved across restarts with the provided configuration.**

All commands necessary to use Docker are defined in the `package.json`. To launch the frontend, backend and database, run:

```bash
npm run docker:watch
```

See [Using Docker]({{ site.baseurl }}{% link using-docker.md %}) for details on using Docker for this project.

## Manual Installation

### 1. Install the Oligo Designer Command line interface first

Before running the web application, follow the [CLI installation instructions](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite). This step is crucial to execute the pipelines with ODT Cloud

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

## Troubleshooting

- If you have issues connecting to the backend, double-check the API URL in `.env`.
- Make sure your backend is running before starting the frontend.
- If you run into permission errors on Mac/Linux, you might need to make `start.sh` executable:
  ```bash
  chmod +x start.sh
  ```

---

## Citation

If you use this platform, please cite the main [Oligo Designer Toolsuite](https://doi.org/10.5281/zenodo.7823048).

---

For further help or to report issues, please see our [GitHub issues page](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end/issues).
