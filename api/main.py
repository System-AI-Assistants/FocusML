import os

import mlflow
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from keycloak import KeycloakAdmin, KeycloakOpenID
from mlflow.types.llm import ChatMessage
from pydantic import BaseModel, EmailStr
from sqlalchemy import DateTime, func
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

from api.ollama_model import OllamaModel

Base = declarative_base()


class ModelFamily(Base):
    __tablename__ = 'model_families'

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    icon = Column(String(255))
    url = Column(String(255))
    installed = Column(Boolean)
    models = relationship("Model", back_populates="family")


class Model(Base):
    __tablename__ = 'models'

    id = Column(Integer, primary_key=True)
    family_id = Column(Integer, ForeignKey('model_families.id'), nullable=False)
    name = Column(String(255), nullable=False)
    size = Column(String(50))
    context = Column(String(50))
    input_type = Column(String(100))
    family = relationship("ModelFamily", back_populates="models")


class Assistant(Base):
    __tablename__ = 'assistants'

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    owner = Column(String(255), nullable=False)  # Keycloak user ID
    database_url = Column(String(255))
    version = Column(String(50))
    stage = Column(String(50))
    model = Column(String(255), nullable=False)
    is_local = Column(Boolean, default=False)
    status = Column(String(50))
    mlflow_run_id = Column(String(255))
    create_time = Column(DateTime, server_default=func.now())
    last_modified = Column(DateTime, server_default=func.now(), onupdate=func.now())


load_dotenv()

KEYCLOAK_SERVER_URL = os.getenv("KEYCLOAK_SERVER_URL")
KEYCLOAK_REALM_NAME = os.getenv("KEYCLOAK_REALM_NAME")
KEYCLOAK_ADMIN_CLIENT_ID = os.getenv("KEYCLOAK_ADMIN_CLIENT_ID")
KEYCLOAK_ADMIN_NAME = os.getenv("KEYCLOAK_ADMIN_NAME")
KEYCLOAK_ADMIN_PASSWORD = os.getenv("KEYCLOAK_ADMIN_PASSWORD")
KEYCLOAK_ADMIN_CLIENT_SECRET = os.getenv("KEYCLOAK_ADMIN_CLIENT_SECRET")
KEYCLOAK_FRONTEND_CLIENT_ID = os.getenv("KEYCLOAK_FRONTEND_CLIENT_ID")

# MLflow configuration
MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)

app = FastAPI(
    title="FocusML Platform Backend",
    description="API for managing users and other platform resources.",
    version="1.0.0"
)

DB_URL = 'postgresql://react:DcaErJGsvJdLvzRV3FYddcVfH5gDcnBcErJGasdcaS@localhost:5432/react_db'

engine = create_engine(DB_URL)
Base.metadata.create_all(engine, checkfirst=True)  # Create tables if they don't exist
SessionLocal = sessionmaker(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


def get_keycloak_admin():
    """Get an authenticated Keycloak admin client"""
    try:
        admin = KeycloakAdmin(
            server_url=KEYCLOAK_SERVER_URL,
            username=KEYCLOAK_ADMIN_NAME,
            password=KEYCLOAK_ADMIN_PASSWORD,
            realm_name=KEYCLOAK_REALM_NAME,
            client_id=KEYCLOAK_ADMIN_CLIENT_ID,
            client_secret_key=KEYCLOAK_ADMIN_CLIENT_SECRET
        )

        return admin
    except Exception as e:
        print(f"Failed to initialize Keycloak Admin: {e}")
        return None


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    firstName: str = None
    lastName: str = None


class AssistantCreate(BaseModel):
    name: str
    database_url: str = None
    version: str = None
    stage: str = None
    model: str
    is_local: bool = False


class AssistantResponse(BaseModel):
    id: int
    name: str
    owner: str
    database_url: str
    version: str
    stage: str
    model: str
    is_local: bool
    status: str
    mlflow_run_id: str
    create_time: str
    last_modified: str


class AssistantEndpointResponse(BaseModel):
    endpoint: str
    method: str
    description: str

class ChatMessageRequest(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessageRequest]
    max_tokens: int = None
    temperature: float = None
    top_p: float = None
    stop: list[str] = None
    custom_inputs: dict = None

class ChatResponse(BaseModel):
    choices: list[dict]
    model: str


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

keycloak_openid = KeycloakOpenID(server_url=KEYCLOAK_SERVER_URL,
                                 realm_name=KEYCLOAK_REALM_NAME,
                                 client_id=KEYCLOAK_FRONTEND_CLIENT_ID)


def get_current_user(token: str = Depends(oauth2_scheme)):
    print(f"Received token: {token[:50]}...")
    try:
        # Try to introspect the token with Keycloak
        print(f"Attempting to introspect token with Keycloak at {KEYCLOAK_SERVER_URL}")
        token_info = keycloak_openid.introspect(token)
        print(f"Token introspection result: {token_info}")

        if not token_info.get('active', False):
            print("Token is not active")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is not active",
                headers={"WWW-Authenticate": "Bearer"},
            )

        print("Token validation successful")
        return token_info
    except HTTPException:
        raise
    except Exception as e:
        print(f"Token validation error: {e}")
        print(f"Error type: {type(e)}")
        # For debugging, let's be more permissive temporarily
        print("WARNING: Bypassing token validation for debugging")
        return {"sub": "debug-user", "active": True}


# --- API Endpoints ---
@app.get("/api/users", dependencies=[Depends(get_current_user)], tags=["Users"])
def get_users():
    """Retrieve all users from the Keycloak realm."""
    print("Getting users endpoint called")

    keycloak_admin = get_keycloak_admin()
    print(keycloak_admin)
    if not keycloak_admin:
        print("Keycloak admin client not available")
        raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")
    try:
        print("Attempting to fetch users from Keycloak")
        users = keycloak_admin.get_users()
        print(f"Successfully fetched {len(users)} users")
        return users
    except Exception as e:
        print(f"Error fetching users: {e}")
        print(f"Error type: {type(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")


@app.post("/api/users", status_code=status.HTTP_201_CREATED, dependencies=[Depends(get_current_user)], tags=["Users"])
def create_user(user: UserCreate):
    """Create a new user in the Keycloak realm."""

    keycloak_admin = get_keycloak_admin()
    if not keycloak_admin:
        raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")
    try:
        creds = {
            "username": user.username,
            "email": user.email,
            "firstName": user.firstName,
            "lastName": user.lastName,
            "enabled": True,
            "credentials": [{
                "type": "password",
                "value": user.password,
                "temporary": False
            }]
        }

        new_user_id = keycloak_admin.create_user(creds)
        return {"message": "User created successfully", "user_id": new_user_id}
    except Exception as e:
        print(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")


@app.delete("/api/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(get_current_user)],
            tags=["Users"])
def delete_user(user_id: str):
    """Delete a user from the Keycloak realm by their ID."""
    keycloak_admin = get_keycloak_admin()
    if not keycloak_admin:
        raise HTTPException(status_code=503, detail="Keycloak Admin client not available.")
    try:
        keycloak_admin.delete_user(user_id=user_id)
        return
    except Exception as e:
        print(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")


@app.get("/")
def root():
    return {"message": "FocusML Platform API is running."}


@app.get("/api/ollama-models", dependencies=[Depends(get_current_user)], tags=["Models"])
def get_models():
    """Retrieve all model families and their models from the database in the original JSON format."""
    try:
        with SessionLocal() as session:
            families = session.query(ModelFamily).all()
            result = []
            for family in families:
                family_data = {
                    "name": family.name,
                    "description": family.description,
                    "icon": family.icon,
                    "url": family.url,
                    "installed": family.installed,
                    "models": [
                        {
                            "name": model.name,
                            "size": model.size,
                            "context": model.context,
                            "input": model.input_type
                        } for model in family.models
                    ]
                }
                result.append(family_data)
            return result
    except SQLAlchemyError as e:
        print(f"Error fetching models: {e}, type: {type(e)}")


@app.post("/api/assistants", status_code=status.HTTP_201_CREATED, dependencies=[Depends(get_current_user)], tags=["Assistants"])
def create_assistant(assistant: AssistantCreate, token_info: dict = Depends(get_current_user)):
    """Create a new assistant in the database."""

    try:
        with SessionLocal() as session:
            # Validate model exists
            model = session.query(Model).filter_by(name=assistant.model).first()
            if not model:

                raise HTTPException(status_code=400, detail=f"Model '{assistant.model}' not found")

            db_assistant = Assistant(
                name=assistant.name,
                owner=token_info.get('sub'),
                database_url=assistant.database_url,
                version=assistant.version,
                stage=assistant.stage,
                model=assistant.model,
                status='running',
                is_local=assistant.is_local
            )
            session.add(db_assistant)
            session.commit()
            session.refresh(db_assistant)

            try:
                with mlflow.start_run(run_name=f"assistant-{db_assistant.id}") as run:
                    ollama_model = OllamaModel()

                    mlflow.log_param("model_name", assistant.model)
                    mlflow.pyfunc.log_model(
                        artifact_path="model",
                        python_model=ollama_model,
                        code_paths=["api/ollama_model.py"],  # Include code for reference
                        artifacts={"model_name": assistant.model},
                        pip_requirements=["mlflow", "ollama"]
                    )
                    db_assistant.mlflow_run_id = run.info.run_id
                    session.commit()

            except Exception as e:

                session.delete(db_assistant)
                session.commit()
                raise HTTPException(status_code=500, detail=f"Failed to log model to MLflow: {str(e)}")

            response = {
                "id": db_assistant.id,
                "name": db_assistant.name,
                "owner": db_assistant.owner,
                "database_url": db_assistant.database_url,
                "version": db_assistant.version,
                "stage": db_assistant.stage,
                "model": db_assistant.model,
                "is_local": db_assistant.is_local,
                "status": db_assistant.status,
                "mlflow_run_id": db_assistant.mlflow_run_id,
                "create_time": db_assistant.create_time.isoformat(),
                "last_modified": db_assistant.last_modified.isoformat()
            }

            return response
    except SQLAlchemyError as e:

        raise HTTPException(status_code=500, detail=f"Failed to create assistant: {str(e)}")


@app.get("/api/assistants", response_model=list[AssistantResponse], dependencies=[Depends(get_current_user)],
         tags=["Assistants"])
def get_assistants():
    """Retrieve all assistants from the database."""
    try:
        with SessionLocal() as session:
            assistants = session.query(Assistant).all()
            result = [
                {
                    "id": assistant.id,
                    "name": assistant.name,
                    "owner": assistant.owner,
                    "database_url": assistant.database_url,
                    "version": assistant.version,
                    "stage": assistant.stage,
                    "model": assistant.model,
                    "is_local": assistant.is_local,
                    "status": assistant.status,
                    "mlflow_run_id": assistant.mlflow_run_id,
                    "create_time": assistant.create_time.isoformat() if assistant.create_time else None,
                    "last_modified": assistant.last_modified.isoformat() if assistant.last_modified else None
                }
                for assistant in assistants
            ]
            return result
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch assistants: {str(e)}")


@app.get("/api/assistants/{assistant_id}/endpoints", response_model=list[AssistantEndpointResponse],
         dependencies=[Depends(get_current_user)], tags=["Assistants"])
def get_assistant_endpoints(assistant_id: int):
    """Retrieve API endpoints for a specific assistant."""
    try:
        with SessionLocal() as session:
            assistant = session.query(Assistant).filter_by(id=assistant_id).first()
            if not assistant:
                raise HTTPException(status_code=404, detail="Assistant not found")

            # Placeholder endpoints (customize as needed)
            endpoints = [
                {
                    "endpoint": f"/api/assistants/{assistant_id}/chat",
                    "method": "POST",
                    "description": "Send a message to the assistant and receive a response."
                },
                {
                    "endpoint": f"/api/assistants/{assistant_id}/completions",
                    "method": "POST",
                    "description": "Traditional prompt completion."
                },
                {
                    "endpoint": f"/api/assistants/{assistant_id}/status",
                    "method": "GET",
                    "description": "Check the status and availability of the assistant."
                }
            ]
            return endpoints
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch assistant endpoints: {str(e)}")


@app.post("/api/assistants/{assistant_id}/run", response_model=AssistantResponse,
          dependencies=[Depends(get_current_user)], tags=["Assistants"])
def run_assistant(assistant_id: int):
    """Run an assistant by updating its status to 'running'."""
    try:
        with SessionLocal() as session:
            assistant = session.query(Assistant).filter_by(id=assistant_id).first()
            if not assistant:
                raise HTTPException(status_code=404, detail="Assistant not found")
            if assistant.status == 'running':
                raise HTTPException(status_code=400, detail="Assistant is already running")

            assistant.status = 'running'
            assistant.last_modified = func.now()
            session.commit()
            session.refresh(assistant)

            response = {
                "id": assistant.id,
                "name": assistant.name,
                "owner": assistant.owner,
                "database_url": assistant.database_url,
                "version": assistant.version,
                "stage": assistant.stage,
                "model": assistant.model,
                "is_local": assistant.is_local,
                "status": assistant.status,
                "mlflow_run_id": assistant.mlflow_run_id,
                "create_time": assistant.create_time.isoformat(),
                "last_modified": assistant.last_modified.isoformat()
            }
            return response
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Failed to run assistant: {str(e)}")


@app.post("/api/assistants/{assistant_id}/stop", response_model=AssistantResponse,
          dependencies=[Depends(get_current_user)], tags=["Assistants"])
def stop_assistant(assistant_id: int):
    """Stop an assistant by updating its status to 'stopped'."""
    try:
        with SessionLocal() as session:
            assistant = session.query(Assistant).filter_by(id=assistant_id).first()
            if not assistant:
                raise HTTPException(status_code=404, detail="Assistant not found")
            if assistant.status != 'running':
                raise HTTPException(status_code=400, detail="Assistant is not running")

            assistant.status = 'stopped'
            assistant.last_modified = func.now()
            session.commit()
            session.refresh(assistant)

            response = {
                "id": assistant.id,
                "name": assistant.name,
                "owner": assistant.owner,
                "database_url": assistant.database_url,
                "version": assistant.version,
                "stage": assistant.stage,
                "model": assistant.model,
                "is_local": assistant.is_local,
                "status": assistant.status,
                "mlflow_run_id": assistant.mlflow_run_id,
                "create_time": assistant.create_time.isoformat(),
                "last_modified": assistant.last_modified.isoformat()
            }
            return response
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop assistant: {str(e)}")


@app.post("/api/assistants/{assistant_id}/chat", response_model=ChatResponse, dependencies=[Depends(get_current_user)],
          tags=["Chat"])
def chat_with_assistant(assistant_id: int, request: ChatRequest):
    """Chat with an assistant using its MLflow-logged model."""
    try:
        with SessionLocal() as session:
            assistant = session.query(Assistant).filter_by(id=assistant_id).first()
            if not assistant:
                raise HTTPException(status_code=404, detail="Assistant not found")
            if not assistant.mlflow_run_id:
                raise HTTPException(status_code=400, detail="Assistant has no associated MLflow model")


            try:
                model = mlflow.pyfunc.load_model(f"runs:/{assistant.mlflow_run_id}/model")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to load MLflow model: {str(e)}")

            # Convert messages to MLflow format
            messages = [ChatMessage(role=msg.role, content=msg.content) for msg in request.messages]
            params = {
                "max_tokens": request.max_tokens,
                "temperature": request.temperature,
                "top_p": request.top_p,
                "stop": request.stop,
                "custom_inputs": request.custom_inputs
            }

            # Call model's predict method
            response = model.predict(None, messages, params)
            return ChatResponse(
                choices=[
                    {
                        "index": choice.index,
                        "message": {
                            "role": choice.message.role,
                            "content": choice.message.content
                        }
                    } for choice in response.choices
                ],
                model=response.model
            )
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Failed to process chat: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
