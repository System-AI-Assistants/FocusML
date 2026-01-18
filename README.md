![FocusML header](repo/header.png)

# FocusML

FocusML is a platform for managing, benchmarking, routing, and monitoring specialized ML models. It provides a FastAPI backend, React frontend, and integrated MLOps stack (MLflow, MinIO, Keycloak) for teams to onboard models, run benchmarks, route requests to optimal models, and monitor quality and drift.

## Overview

Organizations often maintain multiple task-specific models with varying strengths and costs. FocusML centralizes lifecycle management and decision logic, enabling consistent measurement, optimal model selection, and early detection of performance issues. All operations are tracked with reproducible records in MLflow.

## Features

- Model registry with metadata management
- Plug-in execution providers (local Ollama/llama.cpp or cloud APIs)
- MLflow-backed benchmarking and experiment tracking
- Dynamic model selection and routing
- Prometheus-compatible metrics with Grafana dashboards
- Role-based access control with Keycloak integration
- Data collections for RAG-enabled assistants
- User and group management with configurable limits

## Repository Structure

```
FocusML/
├── backend/          # FastAPI application, SQLAlchemy models, services
├── front/            # React application (dashboard, benchmarks, chat)
├── init/             # Database initialization scripts
├── nginx/            # Reverse proxy configuration
├── keycloak/         # Authentication themes and configuration
├── mlflow_data/      # MLflow tracking data
└── docker-compose.yml
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for frontend development)
- Python 3.10+ (for backend development)

### Running with Docker

1. Create a `.env` file with required configuration (see `.env.example`)

2. Start all services:

```bash
docker-compose up --build -d
```

3. Access the application at `http://localhost:3000`

4. Log in via Keycloak with default credentials

### Development Setup

For backend development:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

For frontend development:

```bash
cd front
npm install
npm start
```

## Core Workflows

### Model Management

Register model agents with name, task type, and execution provider. Push versions to the MLflow Model Registry for tracking and deployment.

### Benchmarking

Run benchmarks from the UI or API. Results and artifacts are stored in MLflow Tracking for comparison and analysis.

### Request Routing

Production routing queries MLflow for models tagged for specific tasks, uses benchmark metrics to select the optimal candidate, and invokes the configured execution provider.

### Monitoring

Latency, quality, and drift metrics are logged to MLflow and exposed via Prometheus endpoints for dashboards and alerting.

## Configuration

Key environment variables:

| Variable | Description |
|----------|-------------|
| `KEYCLOAK_SERVER_URL` | Keycloak server base URL |
| `KEYCLOAK_REALM_NAME` | Keycloak realm name |
| `KEYCLOAK_ADMIN_CLIENT_ID` | Admin client ID |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | Admin client secret |
| `OLLAMA_HOST` | Ollama server URL |
| `MLFLOW_TRACKING_URI` | MLflow tracking server URL |
| `DATABASE_URL` | PostgreSQL connection string |

## Contributing

Keep changes modular. When adding features, include a design note, tests, and documentation updates.

## License

Proprietary - All rights reserved.

---

Author: Adam Terlo  
Academic Supervisor: Hadi Saleh  
Higher School of Economics  
2025
