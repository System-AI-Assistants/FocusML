# FocusML Backend

FastAPI backend for the FocusML platform. Provides REST APIs for user management, assistant orchestration, model registry, benchmarking, and data collection management.

## Prerequisites

- Python 3.10+
- PostgreSQL database
- Running Keycloak instance
- Ollama (for local model inference)

## Setup

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/macOS
# or: .\venv\Scripts\activate  # Windows
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `KEYCLOAK_SERVER_URL` | Keycloak server URL |
| `KEYCLOAK_REALM_NAME` | Keycloak realm |
| `KEYCLOAK_ADMIN_CLIENT_ID` | Admin client ID |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | Admin client secret |
| `KEYCLOAK_FRONTEND_CLIENT_ID` | Frontend client ID |
| `OLLAMA_HOST` | Ollama server URL |
| `MLFLOW_TRACKING_URI` | MLflow tracking server |

## Running

Start the development server:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.

API documentation is available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Project Structure

```
backend/
├── api/              # Route handlers
├── core/             # Configuration and utilities
├── db/               # Database models and session
├── schemas/          # Pydantic request/response models
├── services/         # External service integrations
├── tasks/            # Background tasks
├── tests/            # Test suite
├── uploads/          # Uploaded data files
└── main.py           # Application entry point
```

## API Endpoints

| Prefix | Description |
|--------|-------------|
| `/users` | User management |
| `/groups` | Group management |
| `/assistants` | AI assistant CRUD and chat |
| `/models` | Model registry |
| `/benchmarks` | Benchmark execution |
| `/data-collections` | Data collection management |
| `/statistics` | Platform statistics |
| `/widgets` | Embeddable chat widgets |

## Testing

```bash
pytest tests/
```
