---
title: Monitoring
layout: default
nav_order: 4
parent: Development
---

# Monitoring

ODT Cloud includes a comprehensive monitoring stack using Prometheus and Grafana to track system performance, application metrics, and resource usage.

---

## Accessing Monitoring Tools

Monitoring services are only started when using the monitoring profile. To start the application with monitoring enabled, use:

```bash
npm run docker:start:monitoring
# or for development with hot reloading:
npm run docker:watch:monitoring
```

See [Using Docker]({{ site.baseurl }}{% link using-docker.md %}) for more details on Docker profiles.

After starting with the monitoring profile, the following monitoring services are available:

| Service              | URL                           | Description                                             |
| -------------------- | ----------------------------- | ------------------------------------------------------- |
| **Grafana**          | http://localhost:3001         | Visualization and dashboards (default: `admin`/`admin`) |
| **Prometheus**       | http://localhost:9090         | Metrics collection and querying                         |
| **MongoDB Exporter** | http://localhost:9216/metrics | MongoDB database metrics                                |
| **Node Exporter**    | http://localhost:9100/metrics | Host operating system metrics                           |
| **cAdvisor**         | http://localhost:8080         | Container resource usage metrics                        |
| **Flask Metrics**    | http://localhost:8000/metrics | Application metrics (when configured)                   |

---

## Grafana

Grafana provides visualization dashboards for all collected metrics. It is automatically configured with Prometheus as a data source.

### Accessing Grafana

1. Navigate to http://localhost:3001
2. Login with default credentials:
   - **Username:** `admin`
   - **Password:** `admin`
3. You'll be prompted to change the password on first login (optional)

### Prometheus Data Source

Prometheus is automatically configured as a data source in Grafana via provisioning. The data source:

- **Name:** Prometheus
- **URL:** `http://odt-prometheus:9090`
- **Access:** Proxy (server-side)
- **Status:** Automatically set as default data source

If you need to manually verify or reconfigure:

1. Go to **Configuration → Data Sources**
2. Click on **Prometheus**
3. Verify the URL is set to `http://odt-prometheus:9090`
4. Click **Save & Test**

---

## Prometheus

Prometheus collects and stores time-series metrics from various exporters.

### Accessing Prometheus

Navigate to http://localhost:9090 to access the Prometheus web UI.

### Key Features

- **Query Interface:** Execute PromQL queries to explore metrics
- **Targets:** View status of all configured exporters at http://localhost:9090/targets
- **Graphs:** Visualize metrics over time
- **Alerts:** Configure alerting rules (advanced)

### Configuration

Prometheus configuration is stored in `prometheus.yml` at the project root. The configuration includes:

- **Scrape interval:** 15 seconds (how often metrics are collected)
- **Retention:** Data is stored in the `prometheus-data` Docker volume

---

## Exporters

Exporters expose metrics in Prometheus format. The following exporters are configured:

### 1. MongoDB Exporter

**Service:** `odt-mongodb-exporter`  
**Port:** `9216`  
**Metrics Endpoint:** http://localhost:9216/metrics

Exports MongoDB database metrics including:

- Connection counts
- Operation counters
- Replication status
- Database sizes
- Query performance

**Configuration:**

- Connects to MongoDB at `mongodb://odt-db:27017`
- Collects all available metrics (`--collect-all`)

### 2. Node Exporter (Host OS Metrics)

**Service:** `odt-node-exporter`  
**Port:** `9100`  
**Metrics Endpoint:** http://localhost:9100/metrics

Exports host operating system metrics including:

- CPU usage and time (`node_cpu_*`)
- Memory usage (`node_memory_*`)
- Disk I/O and space (`node_disk_*`, `node_filesystem_*`)
- Network statistics (`node_network_*`)
- System load (`node_load*`)

**Configuration:**

- Mounts host `/proc`, `/sys`, and `/` filesystems
- Excludes virtual filesystems from disk metrics
- Provides actual host-level metrics, not container metrics

### 3. Flask Application Metrics

**Service:** `odt-server`  
**Port:** `8000`  
**Metrics Endpoint:** http://localhost:8000/metrics

Exports Flask application metrics including:

- HTTP request counts (`flask_http_request_total`)
- Request latency (`flask_http_request_duration_seconds`)
- Error rates (`flask_http_request_exceptions_total`)

**Note:** Flask metrics are configured using `prometheus-flask-exporter`. The `/metrics` endpoint is automatically registered when the Flask app starts.

### 4. cAdvisor (Container Metrics)

**Service:** `odt-cadvisor`  
**Port:** `8080`  
**Web UI:** http://localhost:8080  
**Metrics Endpoint:** http://localhost:8080/metrics

Exports container-level resource usage metrics including:

- CPU usage per container (`container_cpu_usage_seconds_total`)
- Memory usage per container (`container_memory_usage_bytes`)
- Network I/O (`container_network_receive_bytes_total`, `container_network_transmit_bytes_total`)
- Filesystem usage (`container_fs_usage_bytes`)
- Container limits (`container_spec_memory_limit_bytes`, `container_spec_cpu_quota`)

**Configuration:**

- Runs in privileged mode to access container metrics
- Mounts host filesystems (`/`, `/sys`, `/var/run`, `/var/lib/docker`)
- Provides per-container metrics identified by container ID path (`id` label)
- Metrics are prefixed with `container_*`

## Adding a New Exporter

To add a new metrics exporter to the monitoring stack:

### Step 1: Add Exporter Service to compose.yml

Add a new service definition:

```yaml
odt-new-exporter:
  image: exporter-image:version
  container_name: odt-new-exporter
  ports:
    - 9091:9091 # Adjust port as needed
  command:
    - "--exporter-specific-options"
  depends_on:
    - odt-db # Add dependencies as needed
```

### Step 2: Add Scrape Configuration to prometheus.yml

Add a new scrape job:

```yaml
scrape_configs:
  # ... existing jobs ...

  # New exporter
  - job_name: "new-exporter"
    static_configs:
      - targets: ["odt-new-exporter:9091"]
    metrics_path: "/metrics"
```

### Step 3: Update Prometheus Dependencies

Add the new exporter to Prometheus `depends_on`:

```yaml
odt-prometheus:
  # ... existing config ...
  depends_on:
    - odt-mongodb-exporter
    - odt-node-exporter
    - odt-cadvisor
    - odt-new-exporter # Add here
```

### Step 4: Restart Services

```bash
docker compose up -d odt-new-exporter
docker compose restart odt-prometheus
```

### Step 5: Verify

1. Check exporter is running: `docker compose ps odt-new-exporter`
2. Test metrics endpoint: `curl http://localhost:9091/metrics`
3. Check Prometheus targets: http://localhost:9090/targets
4. Verify status shows as "UP"
