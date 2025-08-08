---
layout: page
title: Runs & Results
permalink: /runs.html
---

## Runs list

Path: `/runs`  
File: `src/pages/runs.tsx`

- Fetches user's runs from backend
- Shows pipeline, status, timestamp, and output path
- Links to **Run Detail**

## Run detail

Path: `/runs/:runId`  
File: `src/pages/rundetail.tsx`

Features:
- Lists run files (logs/configs/outputs)
- YAML/CSV/Excel parsing helpers
- Gene/oligo selection UI
- Download links for artifacts