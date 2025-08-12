![FocusML header](repo/header.png)

# FocusML

FocusML is a platform for managing, benchmarking, routing and monitoring a portfolio of specialized ML models. It bundles a FastAPI backend, a React frontend, and an MLOps stack (MLflow, MinIO, Keycloak, etc) so teams can onboard models, run task-specific benchmarks, route requests to the best model for each task, and keep an eye on quality and drift. 🚀

## Why this exists

Model teams end up with many task-specific models, each with different strengths and costs. FocusML centralizes lifecycle management and decision logic so you can measure agents consistently, pick the best option for a job, and detect performance/regression issues quickly — all with reproducible records in MLflow. This reduces manual overhead and cost leakage while improving reliability. 📈

## What it does (short)

FocusML gives you: model registry + metadata, plug-in execution providers (local Ollama / llama.cpp or cloud APIs), MLflow-backed benchmarking and tracking, dynamic selection logic for routing, and Prometheus-compatible metrics plus Grafana dashboards for observability. 🔧

## Repo layout (quick)

The repo splits backend and frontend. `backend/` contains the FastAPI app, SQLAlchemy models, MLflow and provider service wrappers. `front/` is a React app with dashboard, bench UI, and chat interface. Top-level `docker-compose.yml` wires MLflow, MinIO, Keycloak and observability stacks for a local prototype. 🗂️

## Quick start (dev)

Create a `.env` with required secrets. Then from the repo root:

```bash
docker-compose up --build -d
```

Open the frontend URL shown in the compose logs and log in via Keycloak. If you want just the backend or frontend, see the `backend/README.md` and `front/README.md` respectively. ⚠️

## Core flows (how you’ll use it)

Register a Model Agent (name, task type, execution provider) and push its version into the MLflow Model Registry. Run benchmarks from the UI or API — results and artifacts go to MLflow Tracking. Production routing queries MLflow for `Production` models tagged for a task and uses benchmarked metrics to pick the best candidate, then invokes the configured execution provider to fulfill the request. Monitoring logs latency, quality and drift metrics to MLflow and exposes Prometheus metrics for dashboards/alerts.

## Contributing

Keep changes modular. When adding features, include a short design note, unit tests, and update docs. 

