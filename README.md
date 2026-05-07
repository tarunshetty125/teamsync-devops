# 🚀 TeamSync - End-to-End DevOps Pipeline

> **End-to-End DevOps Pipeline for a SaaS Application using Docker, CI/CD, AWS, Nginx, and Monitoring Tools**

A production-ready SaaS dashboard application demonstrating a complete DevOps pipeline — from code commit to production deployment with automated CI/CD, containerization, reverse proxy, and real-time monitoring.

---

## 📋 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Local Development Setup](#-local-development-setup)
- [Docker Deployment](#-docker-deployment)
- [AWS EC2 Deployment](#-aws-ec2-deployment)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Monitoring Setup](#-monitoring-setup)
- [API Documentation](#-api-documentation)
- [Screenshots](#-screenshots)

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

### Prometheus
- **URL**: `http://localhost:9090`
- **Scrape Interval**: 15 seconds
- **Targets**: Backend API metrics, Nginx status
- **Retention**: 7 days

#### Key Metrics Collected
- `http_requests_total` - Total HTTP request count
- `http_request_duration_seconds` - Request latency histogram
- `active_connections` - Current active connections
- `nodejs_*` - Node.js runtime metrics (memory, CPU, event loop)

### Grafana
- **URL**: `http://localhost:3001`
- **Default Login**: admin / admin123
- **Pre-loaded Dashboard**: TeamSync DevOps Dashboard

#### Dashboard Panels
1. HTTP Request Rate (requests/sec)
2. Response Time P95 (latency)
3. Active Connections (gauge)
4. Total Requests (counter)
5. Memory Usage (MB)
6. Node.js Event Loop Lag

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
