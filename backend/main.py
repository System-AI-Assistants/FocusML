import os
import pathlib

import mlflow
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.middleware_api_key import APIKeyMiddleware

from api import routes_users, routes_assistants, routes_models, routes_benchmarks, routes_statistics
from api.routes_data_collections import router as data_collections_router
from api.routes_chat import router as chat_router
from api.routes_integrations import router as integrations_router
from core.config import settings


load_dotenv()

TMP_DIR = os.getenv("MLFLOW_TMP_DIR", "./.mlflow_tmp")
pathlib.Path(TMP_DIR).mkdir(parents=True, exist_ok=True)
os.environ["MLFLOW_TMP_DIR"] = TMP_DIR

# MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://mlflow:5000")
# mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)

mlflow.set_tracking_uri(settings.MLFLOW_TRACKING_URI)


app = FastAPI(
    title="FocusML Platform Backend",
    description="API for managing users and other platform resources.",
    version="1.0.0",
    root_path="/api",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://aiassistant.smartlilac.com",
                   "http://localhost:3000",
                   "http://localhost:8000",
                   "http://127.0.0.1:3000"
                   "http://127.0.0.1:8000"
                   ],

    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Add API key middleware (after CORS so it can set headers)
app.add_middleware(APIKeyMiddleware)

app.include_router(routes_users.router)
app.include_router(routes_assistants.router)
app.include_router(routes_models.router)
app.include_router(chat_router, prefix="/chat", tags=["chat"])
app.include_router(data_collections_router, prefix="/data-collections", tags=["Data Collections"])
app.include_router(routes_benchmarks.router)
app.include_router(routes_statistics.router)
app.include_router(integrations_router)


@app.get("/")
def root():
    return {"message": "FocusML Platform API is running."}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
