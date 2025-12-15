# Grafana Dashboards

This directory contains Grafana dashboard JSON files that are automatically provisioned when Grafana starts.

## Adding Dashboards

1. Create or edit dashboards in Grafana UI (http://localhost:3001)
2. Export each dashboard as JSON:
   - Go to Dashboard Settings → JSON Model
   - Copy the JSON content
3. Save the JSON file to this directory with a descriptive name (e.g., `mongodb-metrics.json`)
4. Restart Grafana: `docker compose restart odt-grafana`

Dashboards will be automatically loaded on startup for all users who run `docker compose up`.

