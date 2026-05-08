# 🚀 TeamSync - End-to-End DevOps Pipeline

> **End-to-End DevOps Pipeline for a SaaS Application using Docker, CI/CD, AWS, Nginx, and Monitoring Tools**

A production-ready SaaS dashboard application demonstrating a complete DevOps pipeline — from code commit to production deployment with automated CI/CD, containerization, reverse proxy, and real-time monitoring.

---


## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USERS (Browser)                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP :80
┌──────────────────────────▼──────────────────────────────────────┐
│                    NGINX REVERSE PROXY                          │
│              (Load Balancing, SSL, Rate Limiting)               │
├─────────────┬─────────────┬──────────────┬─────────────────────┤
│   /         │  /api/*     │  /grafana/*  │  /prometheus/*      │
│   ▼         │  ▼          │  ▼           │  ▼                  │
│ Frontend    │ Backend     │ Grafana      │ Prometheus           │
│ (React)     │ (Node.js)   │ (:3001)     │ (:9090)             │
│ :80         │ :5000       │              │                      │
└─────────────┴──────┬──────┴──────────────┴─────────────────────┘
                     │
         ┌───────────▼───────────┐
         │   MongoDB Atlas       │
         │   (Cloud Database)    │
         └───────────────────────┘
```

### Data Flow
1. **User Request** → Nginx reverse proxy receives all HTTP traffic on port 80
2. **Route Matching** → Nginx routes to frontend (`/`), backend API (`/api/*`), or monitoring tools
3. **API Processing** → Backend authenticates via JWT, processes request, queries MongoDB Atlas
4. **Metrics Collection** → Prometheus scrapes `/metrics` endpoint every 15 seconds
5. **Visualization** → Grafana displays real-time dashboards from Prometheus data

---

## 🛠️ Tech Stack

| Layer          | Technology         | Purpose                           |
|----------------|-------------------|-----------------------------------|
| **Frontend**   | React 18 + Vite 5 | SaaS Dashboard UI                 |
| **Backend**    | Node.js + Express  | REST API Server                   |
| **Database**   | MongoDB Atlas      | Cloud NoSQL Database              |
| **Container**  | Docker + Compose   | Application Containerization      |
| **CI/CD**      | GitHub Actions     | Automated Build & Deploy          |
| **Cloud**      | AWS EC2 (Ubuntu)   | Production Hosting                |
| **Proxy**      | Nginx              | Reverse Proxy + Load Balancing    |
| **Monitoring** | Prometheus         | Metrics Collection                |
| **Dashboard**  | Grafana            | Metrics Visualization             |

---

## 📁 Project Structure

```
teamsync-devops/
├── frontend/                    # React + Vite Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx     # Navigation sidebar
│   │   │   └── Sidebar.css
│   │   ├── pages/
│   │   │   ├── Login.jsx       # Login/Register page
│   │   │   ├── Login.css
│   │   │   ├── Dashboard.jsx   # Main dashboard
│   │   │   └── Dashboard.css
│   │   ├── App.jsx             # Root component with routing
│   │   ├── App.css
│   │   ├── main.jsx            # Entry point
│   │   └── index.css           # Global design system
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── Dockerfile              # Multi-stage build
│   └── nginx.conf              # SPA routing config
│
├── backend/                     # Node.js + Express Backend
│   ├── src/
│   │   ├── models/
│   │   │   └── User.js         # Mongoose User model
│   │   ├── routes/
│   │   │   ├── auth.js         # Auth endpoints
│   │   │   ├── dashboard.js    # Dashboard API
│   │   │   └── health.js       # Health check
│   │   ├── middleware/
│   │   │   ├── auth.js         # JWT middleware
│   │   │   └── metrics.js      # Prometheus metrics
│   │   └── index.js            # Server entry point
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
│
├── nginx/
│   └── nginx.conf              # Reverse proxy config
│
├── monitoring/
│   ├── prometheus/
│   │   └── prometheus.yml      # Scrape configuration
│   └── grafana/
│       ├── dashboards/
│       │   └── dashboard.json  # Pre-built dashboard
│       └── provisioning/
│           ├── datasources/
│           │   └── datasource.yml
│           └── dashboards/
│               └── dashboard.yml
│
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD pipeline
│
├── docker-compose.yml          # All services orchestration
├── .env.example                # Environment template
├── .gitignore
└── README.md                   # This file
```

---

## 💻 Local Development Setup

### Prerequisites
- **Node.js** 18+ and npm
- **Docker** and Docker Compose
- **Git**
- **MongoDB Atlas** account (free tier)

### Step 1: Clone the Repository
```bash
git clone https://github.com/yourusername/teamsync-devops.git
cd teamsync-devops
```

### Step 2: Setup Environment Variables
```bash
# Copy the environment template
cp .env.example .env

# Edit with your MongoDB Atlas URI and a JWT secret
nano .env
```

### Step 3: Run Backend (Development)
```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI
npm install
npm run dev
# Backend runs on http://localhost:5000
```

### Step 4: Run Frontend (Development)
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:3000
# API requests are proxied to :5000 via Vite
```

### Demo Credentials
```
Email:    demo@teamsync.io
Password: demo123
```

---

## 🐳 Docker Deployment

### Build and Run All Services
```bash
# Copy environment template
cp .env.example .env
# Edit .env with your values

# Build and start all containers
docker compose up -d --build

# Check container status
docker compose ps

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

### Service URLs (after Docker Compose up)
| Service     | URL                          |
|-------------|------------------------------|
| Application | http://localhost              |
| Backend API | http://localhost/api          |
| Health Check| http://localhost/api/health   |
| Prometheus  | http://localhost:9090         |
| Grafana     | http://localhost:3001         |

### Grafana Login
```
Username: admin
Password: admin123
```

---

## ☁️ AWS EC2 Deployment

### Step 1: Launch EC2 Instance
1. Go to **AWS Console → EC2 → Launch Instance**
2. Choose **Ubuntu 22.04 LTS (t2.micro for free tier)**
3. Configure Security Group:
   - SSH (22) - Your IP
   - HTTP (80) - Anywhere
   - Custom TCP (3001) - Anywhere (Grafana)
   - Custom TCP (9090) - Anywhere (Prometheus)
4. Download the `.pem` key file

### Step 2: Connect to EC2
```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<EC2-PUBLIC-IP>
```

### Step 3: Install Docker on EC2
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to Docker group
sudo usermod -aG docker ubuntu
newgrp docker

# Install Docker Compose
sudo apt install -y docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### Step 4: Deploy Application
```bash
# Clone repository
git clone https://github.com/yourusername/teamsync-devops.git /home/ubuntu/teamsync
cd /home/ubuntu/teamsync

# Create .env file
cat > .env << EOF
MONGODB_URI=mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/teamsync
JWT_SECRET=$(openssl rand -hex 32)
EOF

# Build and start
docker compose up -d --build

# Verify
docker compose ps
curl http://localhost/api/health
```

### Step 5: Access the Application
- **Dashboard**: `http://<EC2-PUBLIC-IP>`
- **Grafana**: `http://<EC2-PUBLIC-IP>:3001`
- **Prometheus**: `http://<EC2-PUBLIC-IP>:9090`

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

The pipeline runs automatically on every push to `main`:

```
Push to main → Build & Test → Docker Build → Deploy to EC2
```

### Pipeline Stages

| Stage | Description |
|-------|-------------|
| **Build & Test** | Install deps, build frontend, verify code |
| **Docker Build** | Build Docker images, validate compose config |
| **Deploy** | SSH into EC2, pull code, rebuild containers |

### Required GitHub Secrets

Set these in **Settings → Secrets and Variables → Actions**:

| Secret Name    | Value                              |
|---------------|------------------------------------|
| `EC2_HOST`     | Your EC2 public IP address         |
| `EC2_USERNAME` | `ubuntu`                           |
| `EC2_SSH_KEY`  | Contents of your `.pem` key file   |
| `MONGODB_URI`  | Your MongoDB Atlas connection URI  |
| `JWT_SECRET`   | Your JWT secret key                |

---

## 📊 Monitoring Setup

The monitoring stack is fully **auto-configured on container startup** — no manual setup required. It uses **Prometheus** for metrics collection and **Grafana** for visualization, both wired together via Docker Compose.

---

### 📁 Monitoring Folder Structure

```
monitoring/
├── prometheus/
│   └── prometheus.yml              ← What to scrape & how often
└── grafana/
    ├── dashboards/
    │   └── dashboard.json          ← Pre-built visual dashboard
    └── provisioning/
        ├── datasources/
        │   └── datasource.yml      ← Tells Grafana where to get data
        └── dashboards/
            └── dashboard.yml       ← Tells Grafana where to load dashboards from
```

---

### ⚙️ Step 1 — Prometheus Collects Metrics

**Prometheus** is a metrics collector. It **pulls (scrapes)** data from your services on a schedule defined in `prometheus.yml`.

```yaml
global:
  scrape_interval: 15s       # Default: fetch metrics every 15 seconds
  evaluation_interval: 15s
```

It scrapes **3 targets**:

| Job Name | Target | What It Collects | Interval |
|---|---|---|---|
| `prometheus` | `localhost:9090` | Prometheus own health stats | 15s |
| `teamsync-backend` | `backend:5006/metrics` | HTTP requests, response times, memory, event loop | **10s** |
| `nginx` | `nginx:80/nginx_status` | Active connections, request counts | 30s |

The **Node.js backend** exposes a `/metrics` endpoint (via the `prom-client` library) that Prometheus reads. Raw metrics look like:

```
http_requests_total{method="GET", route="/api/health", status_code="200"} 42
process_resident_memory_bytes 52428800
nodejs_eventloop_lag_seconds 0.0021
```

All scraped data is stored in a **time-series database** (Docker volume: `teamsync-prometheus-data`) and retained for **7 days**.

---

### 📊 Step 2 — Grafana Visualizes It

Grafana is the **dashboard UI**. It reads data from Prometheus using **PromQL queries** and renders them as graphs, gauges, and stat panels. It auto-configures via **provisioning files** on startup.

#### 🔌 `datasource.yml` — Connect to Prometheus

```yaml
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090   # Grafana queries Prometheus internally
    isDefault: true
```

`access: proxy` means Grafana's **server** talks to Prometheus — not the browser directly.

#### 📂 `dashboard.yml` — Auto-load Dashboards

```yaml
providers:
  - name: 'TeamSync'
    type: file
    options:
      path: /var/lib/grafana/dashboards   # Scan this folder on startup
```

On startup, Grafana scans this folder and **automatically imports** all `.json` dashboard files. No manual import needed.

#### 🖥️ Dashboard Panels (`dashboard.json`)

The **TeamSync DevOps Dashboard** contains 5 panels:

| Panel | Type | PromQL Query | What It Shows |
|---|---|---|---|
| **HTTP Request Rate** | Time series | `rate(http_requests_total[5m])` | Requests/sec over last 5 min, broken down by method, route & status |
| **Response Time p95** | Time series | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` | 95th percentile latency — worst-case response time |
| **Active Connections** | Stat (big number) | `active_connections` | Live connections at this moment |
| **Total Requests** | Stat (big number) | `http_requests_total` | All-time request count |
| **Memory Usage (MB)** | Gauge | `process_resident_memory_bytes / 1024 / 1024` | Node.js RAM usage in MB |
| **Event Loop Lag** | Time series | `nodejs_eventloop_lag_seconds` | Node.js health — high lag = server under stress |

---

### 🌐 Step 3 — Nginx Routes Both UIs

Both monitoring tools are accessible through **Nginx on port 80** — users never need to hit raw ports:

```nginx
# Grafana Dashboard → http://localhost/grafana/
location /grafana/ {
    proxy_pass http://grafana:3000/;
}

# Prometheus UI → http://localhost/prometheus/
location /prometheus/ {
    proxy_pass http://prometheus:9090/;
}

# Nginx itself exposes /nginx_status for Prometheus to scrape
location /nginx_status {
    stub_status on;
    allow 127.0.0.1;
    allow 172.0.0.0/8;
    deny all;
}
```

---

### 🔄 Complete Monitoring Data Flow

```
Node.js Backend (/metrics endpoint)
        │
        │ Prometheus scrapes every 10s
        ▼
   Prometheus ─────────────────────────────────────────────────┐
   (stores 7 days of time-series data)                         │
        │                                                       │
        │ Grafana queries via PromQL                            │
        ▼                                                       │
   Grafana renders panels                                       │
   (HTTP rate, p95 latency, memory, event loop)                │
        │                                                       │
        │ Served through Nginx                                  │
        ▼                                                       │
   Browser: http://localhost/grafana/    ←────────────────────-┘
            http://localhost/prometheus/
```

---

### 🔑 Access URLs

| Service | URL | Credentials |
|---|---|---|
| Grafana Dashboard | `http://localhost/grafana/` (via Nginx) or `http://localhost:3001` | admin / admin123 |
| Prometheus UI | `http://localhost/prometheus/` (via Nginx) or `http://localhost:9090` | None required |
| Raw Metrics Endpoint | `http://localhost/metrics` | None required |

---

### 📌 Key Metrics Reference

| Metric | Type | Description |
|---|---|---|
| `http_requests_total` | Counter | Total HTTP requests (labeled by method, route, status) |
| `http_request_duration_seconds` | Histogram | Request latency distribution |
| `active_connections` | Gauge | Current number of active connections |
| `process_resident_memory_bytes` | Gauge | Node.js RSS memory usage |
| `nodejs_eventloop_lag_seconds` | Gauge | Event loop delay (health indicator) |
| `nodejs_heap_size_used_bytes` | Gauge | V8 heap memory used |

---

## 📡 API Documentation

### Authentication
| Method | Endpoint             | Description          | Auth |
|--------|---------------------|----------------------|------|
| POST   | `/api/auth/register` | Register new user    | No   |
| POST   | `/api/auth/login`    | Login & get JWT      | No   |
| GET    | `/api/auth/profile`  | Get user profile     | Yes  |

### Dashboard
| Method | Endpoint                | Description            | Auth |
|--------|------------------------|------------------------|------|
| GET    | `/api/dashboard/stats`  | Dashboard statistics   | Yes  |
| GET    | `/api/dashboard/activity`| Recent activity feed  | Yes  |
| GET    | `/api/dashboard/team`   | Team members list      | Yes  |

### System
| Method | Endpoint       | Description          | Auth |
|--------|---------------|----------------------|------|
| GET    | `/api/health`  | Health check         | No   |
| GET    | `/api`         | API info             | No   |
| GET    | `/metrics`     | Prometheus metrics   | No   |

### Example: Login Request
```bash
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@teamsync.io","password":"demo123"}'
```

---

## 🔧 Useful Commands

```bash
# View all container logs
docker compose logs -f

# Restart a specific service
docker compose restart backend

# Scale a service
docker compose up -d --scale backend=2

# Check container resource usage
docker stats

# Access container shell
docker exec -it teamsync-backend sh

# Clean up everything
docker compose down -v --rmi all
```

---

## 👤 Author

**Tarun Shetty**
- MCA Internship Project
- End-to-End DevOps Pipeline Demo

---

## 📄 License

This project is built for educational and demonstration purposes.

---

## 🔗 How Prometheus & Grafana Interact

### 1️⃣ Docker Network — They Can "See" Each Other

Both containers are on the **same Docker network**:

```yaml
# docker-compose.yml
networks:
  - teamsync-network   # ← both prometheus & grafana join this network
```

Because of this, Grafana can reach Prometheus using its **container name** as a hostname — no IP addresses needed:

```
http://prometheus:9090
```

---

### 2️⃣ Grafana Starts AFTER Prometheus

```yaml
# docker-compose.yml
grafana:
  depends_on:
    - prometheus    # ← Grafana waits for Prometheus to be ready first
```

---

### 3️⃣ Grafana is Told WHERE Prometheus Is (`datasource.yml`)

```yaml
# monitoring/grafana/provisioning/datasources/datasource.yml
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090   # ← Grafana points to Prometheus container
    isDefault: true
```

This file is **mounted into the Grafana container** via Docker volume:

```yaml
volumes:
  - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
```

On startup, Grafana reads this file and **automatically registers Prometheus as a data source** — no manual clicking needed.

---

### 4️⃣ The Actual Communication Flow (Request-by-Request)

```
┌──────────────┐           ┌──────────────┐           ┌──────────────┐
│   Browser    │           │   Grafana    │           │  Prometheus  │
│  (You)       │           │  Container   │           │  Container   │
└──────┬───────┘           └──────┬───────┘           └──────┬───────┘
       │                          │                           │
       │  1. Open Grafana UI      │                           │
       │─────────────────────────>│                           │
       │                          │                           │
       │                          │  2. Send PromQL query     │
       │                          │  rate(http_requests_      │
       │                          │   total[5m])              │
       │                          │──────────────────────────>│
       │                          │                           │
       │                          │  3. Return metric data    │
       │                          │  (JSON time-series)       │
       │                          │<──────────────────────────│
       │                          │                           │
       │  4. Rendered graph/panel │                           │
       │<─────────────────────────│                           │
```

> **Key point:** Your browser **never talks to Prometheus directly**. Grafana's server acts as the middleman (`access: proxy`).

---

### 5️⃣ Each Dashboard Panel = One PromQL Query to Prometheus

Every panel in `dashboard.json` sends a **PromQL query** to Prometheus when you open Grafana:

| Panel | Query Sent to Prometheus |
|---|---|
| HTTP Request Rate | `rate(http_requests_total[5m])` |
| Response Time p95 | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` |
| Active Connections | `active_connections` |
| Total Requests | `http_requests_total` |
| Memory Usage | `process_resident_memory_bytes / 1024 / 1024` |
| Event Loop Lag | `nodejs_eventloop_lag_seconds` |

Prometheus receives the query → looks up its stored time-series data → returns JSON → Grafana draws the chart.

---

### 6️⃣ Full Interaction Loop

```
Your App (Node.js backend)
    │ exposes /metrics endpoint
    │
    ▼ Prometheus scrapes every 10s (PULL model)
Prometheus STORES time-series data (7 days)
    │
    ▼ When you open Grafana (QUERY model)
Grafana sends PromQL → gets JSON data back
    │
    ▼
Your Browser sees GRAPHS, GAUGES & STATS
```

---

### 🔑 One-Line Summary

```
Prometheus = DATABASE  (collects & stores metrics by pulling from your app)
Grafana    = FRONTEND  (queries Prometheus & displays results as dashboards)

Grafana queries Prometheus the same way a web app queries a database.
```

- **Prometheus is PULL-based** — it goes to your app to fetch metrics on a schedule
- **Grafana is QUERY-based** — it asks Prometheus "give me data for this time range" on demand
- They **never push data to each other** — all communication is request/response
