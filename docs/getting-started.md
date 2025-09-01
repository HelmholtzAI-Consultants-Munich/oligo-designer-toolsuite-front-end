---
title: Getting Started
layout: default
nav_order: 2
---

# Getting Started

Welcome! This guide will help you set up and run the Oligo Designer Toolsuite **frontend web application** on your machine.  
This app lets multiple users run advanced oligo design pipelines (SeqFISH+, Scrinshot, Oligo-Seq, MERFISH, etc.) via a web browser.

---

### 1. Install the Oligo Designer Command line interface first

Before running the frontend, follow the [backend installation instructions](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite) and ensure the oligo designer is available on your server.

### 2. Install frontend dependencies

Clone this repo and install dependencies: "odt" is the name of conda environment that is created in the first step of the installation. Please do not install with the requirements.txt; It is for testing purposes.
```bash
git clone https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end.git
cd oligo-designer-frontend
npm install
conda odt update -f environment.yml 
```

You can also set up additional environment variables as needed for authentication, proxy, etc.

### 3. Run the frontend (For MacOS and Linux)

```bash
./start.sh
```

### 3. Run the frontend (For Windows)

```bash
.\start.bat
```

The app will open at [http://localhost:3000](http://localhost:3000).

---

## Supported Pipelines

You can use the following pipelines through the web interface:

- **SeqFISH+ Probe Designer**
- **Scrinshot Probe Designer**
- **Oligo-Seq Probe Designer**
- **MERFISH Probe Designer**
- **Genomic Region Generator** (as a submodule)

See the [backend documentation](https://oligo-designer-toolsuite.readthedocs.io/en/latest/) for pipeline details and scientific background.

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
