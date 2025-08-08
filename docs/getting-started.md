---
title: Getting Started
layout: default
nav_order: 2
---

# Getting Started

Welcome! This guide will help you set up and run the Oligo Designer Toolsuite **frontend web application** on your machine.  
This app lets multiple users run advanced oligo design pipelines (SeqFISH+, Scrinshot, Oligo-Seq, MERFISH, etc.) via a web browser.

---

## Requirements

- Node.js 18+
- npm (or pnpm)
- [Conda](https://docs.conda.io/en/latest/) (Anaconda or Miniconda, for backend dependencies)
- The [Oligo Designer Toolsuite backend](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite) running on your server (see backend instructions)

---

## Quickstart

### 1. Clone the repository

```bash
git clone https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end.git
cd oligo-designer-toolsuite-front-end
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install backend Python environment (with conda)

```bash
conda env create -f environment.yml
conda activate odt
```
To update the environment after changes:
```bash
conda env update -f environment.yml --prune
```

---


### 5. Start the application

#### **On Linux and MacOS**

```bash
./start.sh
```

#### **On Windows**

```cmd
start.bat
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
