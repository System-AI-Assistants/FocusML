# MLOps Platform API

This directory contains the FastAPI backend for the MLOps platform. It provides a secure API for managing users via Keycloak and will be extended to handle other platform resources.

## Setup and Installation

### 1. Prerequisites

- Python 3.8+
- A running Keycloak instance

### 2. Create a Virtual Environment

It is highly recommended to use a virtual environment to manage dependencies.

```bash
# Navigate to the api directory
cd /path/to/your/project/api

# Create a virtual environment
python3 -m venv venv

# Activate the virtual environment
# On macOS/Linux:
source venv/bin/activate

# On Windows:
# .\venv\Scripts\activate
```

### 3. Install Dependencies

Install all required Python packages using the `requirements.txt` file.

```bash
(venv) pip install -r requirements.txt
```

### 4. Configure Environment Variables

The application requires credentials to connect to your Keycloak instance. These are loaded from a `.env` file.

1.  **Copy the example file:**

    ```bash
    cp .env.example .env
    ```

2.  **Edit the `.env` file** with your specific Keycloak configuration:

    - `KEYCLOAK_SERVER_URL`: The base URL of your Keycloak server (e.g., `http://localhost:8080/`).
    - `KEYCLOAK_REALM_NAME`: The name of the realm you are using.
    - `KEYCLOAK_ADMIN_CLIENT_ID`: The client ID for a client with admin privileges (often `admin-cli` by default).
    - `KEYCLOAK_ADMIN_CLIENT_SECRET`: The client secret for your admin client. You must enable the "Service Accounts Enabled" option and get the secret from the "Credentials" tab in the Keycloak admin console for your client.
    - `KEYCLOAK_FRONTEND_CLIENT_ID`: The client ID of your React frontend application (e.g., `react-app`).

## Running the Application

Once the setup is complete, you can run the FastAPI server using Uvicorn.

```bash
(venv) uvicorn main:app --reload
```

- The server will start on `http://localhost:8000`.
- The `--reload` flag enables hot-reloading, so the server will automatically restart when you make code changes.

Your API is now running and ready to accept requests from the React frontend.
