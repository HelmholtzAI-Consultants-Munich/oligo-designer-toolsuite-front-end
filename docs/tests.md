---
title: Tests
layout: default
nav_order: 6
---

# Tests

This document explains the test strategy for this software. There are **two** layers:

1. **Backend unit & API tests** using **Pytest** for the Flask backend.  
2. **End-to-end (E2E) tests** using **Playwright**, executed in **GitHub Actions** against the hosted app, to validate full pipelines.

---

## 1) Backend Unit & API Tests (Pytest)

**Goal:** Verify every Flask API endpoint and backend logic in isolation (fast, deterministic).

### Scope
- Status codes, JSON schema, and error handling of **all API endpoints**.
- Auth/session flows (login, logout, protected routes).
- Validation of complex pipeline payloads (e.g., Scrinshot, MERFISH, SeqFISH).
- Pipeline submission/scheduling logic (mock long-running jobs & I/O).
- DB interactions (mock MongoDB in unit tests).

### Running locally
```bash
pytest -q
# with coverage:
pytest --maxfail=1 --disable-warnings --cov=backend --cov-report=term-missing
```

### Fixtures & notes
- **Never** execute real long-running pipelines in unit tests; **mock** them and assert:
  - request validation
  - scheduling trigger
  - persisted records / status initialization
---

## 2) End-to-End (E2E) Tests (Playwright)

**Goal:** Prove a real user can run a pipeline from the UI to a **successful terminal state** on the deployed app.

### Scope
- Navigate to pipelines page, fill required fields, and **submit**.
- Optionally capture/display **Run ID** if shown (useful for debugging).
- **Pass criteria:** Visible terminal success signal (e.g., banner “Pipeline finished successfully”, or status badge **COMPLETED**).
- Smoke checks for key pages (render without severe console errors).

### Running locally
```bash
# in the frontend root
npx playwright test
# test with ui:
npx playwright test --ui  
```


---

## Continuous Integration (GitHub Actions)

**Backends tests (Pytest)** and **E2E (Playwright)** run on every push/PR.  
Set `E2E_BASE_URL` as a repository secret to point E2E tests to the hosted app.

```yaml
name: E2E Test for all Pipelines

on:
  schedule:
    - cron: '0 2 1 * *'  # Run at 2:00 AM on the 1st of every month (UTC)
  workflow_dispatch:

jobs:
  e2e:
    name: 🧪 Playwright E2E Test
    runs-on: ubuntu-latest

    services:
      mongo:
        image: mongo:6
        ports:
          - 27017:27017
        options: >-
          --health-cmd="mongosh --eval 'db.adminCommand(\"ping\")'"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5

    steps:
      - name: 🧾 Checkout Repo
        uses: actions/checkout@v4

      - name: 📥 Clone Oligo Designer Toolsuite
        run: |
          git clone https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite odt_repo
          cd odt_repo

      - name: 🧬 Set Up Conda Environment, Bio Tools, and Backend
        uses: conda-incubator/setup-miniconda@v3
        with:
          miniconda-version: "latest"
          auto-update-conda: true
          activate-environment: odt
          python-version: 3.11

      - name: 🔬 Install Bio Tools and ODT Repo
        run: |
          source $(conda info --base)/etc/profile.d/conda.sh
          conda activate odt
          conda config --add channels bioconda
          conda config --add channels conda-forge
          conda update --all
          conda install -n odt -y "blast>=2.15.0"
          conda install -n odt -y "bedtools>=2.30"
          conda install -n odt -y "bowtie>=1.3.1"
          conda install -n odt -y "bowtie2>=2.5"
          cd odt_repo
          pip install -e .
          cd ..

      - name: 🧪 Set Up ODT Environment from Repo
        run: |
          source $(conda info --base)/etc/profile.d/conda.sh
          conda activate odt
          pip install -r requirements.txt

      - name: 📦 Install Frontend Dependencies
        run: |
          npm ci

      - name: 🚀 Start Full App (Frontend + Backend)
        run: |
          source $(conda info --base)/etc/profile.d/conda.sh
          conda activate odt
          chmod +x start.sh
          ./start.sh &
          sleep 30

      - name: 🎭 Install Playwright
        run: |
          npx playwright install --with-deps

      - name: 🧪 Run E2E Tests
        run: |
          npx playwright test tests/scrinshotE2E.spec.ts
          npx playwright test tests/oligoseqE2E.spec.ts
          npx playwright test tests/merfishE2E.spec.ts
          npx playwright test tests/seqfishE2E.spec.ts
          npx playwright test tests/genomic_ensemblE2E.spec.ts
          npx playwright test tests/genomic_ncbiE2E.spec.ts

      - name: 📤 Upload logs on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: logs
          path: |
            frontend/frontend.log
            backend/backend.log
```