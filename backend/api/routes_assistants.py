import os
import time

from fastapi import APIRouter, Depends, HTTPException
from mlflow.types.chat import ChatMessage
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError

from api.deps import get_current_user
from db.models.assistant import Assistant
from db.models.model import Model
from db.session import SessionLocal
from api.ollama_model import OllamaModel
from schemas.assistant import AssistantCreate, AssistantResponse, AssistantEndpointResponse
import mlflow

from schemas.chat import ChatResponse, ChatRequest
from fastapi import BackgroundTasks
from sqlalchemy import desc


router = APIRouter(prefix="/assistants", tags=["Assistants"])


@router.post("/", dependencies=[Depends(get_current_user)])
async def create_assistant(assistant: AssistantCreate, 
    background_tasks: BackgroundTasks,
    token_info: dict = Depends(get_current_user),
        ):
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
                status='initializing',
                is_local=assistant.is_local
            )
            session.add(db_assistant)
            session.commit()
            session.refresh(db_assistant)


            background_tasks.add_task(
                initialize_mlflow_model, 
                db_assistant.id, 
                assistant.model
            )

            
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
                "mlflow_run_id": None, # we set later
                "create_time": db_assistant.create_time.isoformat(),
                "last_modified": db_assistant.last_modified.isoformat()
            }

            return response
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Failed to create assistant: {str(e)}")


def initialize_mlflow_model(assistant_id: int, model_name: str):
    """Background task to initialize MLflow model"""
    try:
        with SessionLocal() as session:
            assistant = session.query(Assistant).filter_by(id=assistant_id).first()
            if not assistant:
                return

            with mlflow.start_run(run_name=f"assistant-{assistant.id}") as run:
                model_info = mlflow.pyfunc.log_model(
                    name="model",  # 'artifact_path' is deprecated; use 'name'
                    python_model="api/ollama_model.py",  # << script file, not an instance
                    model_config={
                        "model_name": assistant.model,  # e.g., "mistral:7b"
                        "ollama_host": os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434/"),
                    },
                    # Keep dependencies minimal; pin mlflow to a recent version
                    pip_requirements=[
                        "mlflow>=2.12.2",  # Models-from-Code availability
                        "ollama>=0.3.0",
                    ],
                    input_example={
                        "messages": [{"role": "user", "content": "ping"}]
                    },
                )
                mlflow.log_param("model_name", assistant.model)
                assistant.mlflow_run_id = run.info.run_id
                assistant.status = 'running'
                session.commit()

    except Exception as e:
        with SessionLocal() as session:
            assistant = session.query(Assistant).filter_by(id=assistant_id).first()
            if assistant:
                assistant.status = 'failed'
                session.commit()
        print(f"Failed to initialize MLflow model for assistant {assistant_id}: {e}")

@router.get("/{assistant_id}/status/", dependencies=[Depends(get_current_user)])
def get_assistant_status(assistant_id: int):
    """Check the initialization status of an assistant"""
    try:
        with SessionLocal() as session:
            assistant = session.query(Assistant).filter_by(id=assistant_id).first()
            if not assistant:
                raise HTTPException(status_code=404, detail="Assistant not found")
            
            return {
                "id": assistant.id,
                "name": assistant.name,
                "status": assistant.status,
                "mlflow_run_id": assistant.mlflow_run_id,
                "is_ready": assistant.status == 'running' and assistant.mlflow_run_id is not None
            }
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")

@router.get("/{assistant_id}/", dependencies=[Depends(get_current_user)])
def get_assistant(assistant_id: int):
    """Get a single assistant by ID and include the model family's icon if available."""
    try:
        with SessionLocal() as session:
            assistant = session.query(Assistant).filter_by(id=assistant_id).first()
            if not assistant:
                raise HTTPException(status_code=404, detail="Assistant not found")

            model_icon = None
            try:
                model = session.query(Model).filter_by(name=assistant.model).first()
                if model:
                    # Try relationship-style access: model.family.icon
                    fam_attr = getattr(model, "family", None)
                    if fam_attr is not None and not isinstance(fam_attr, str):
                        model_icon = getattr(fam_attr, "icon", None)
                    else:
                        # Fall back to explicit lookup through ModelFamily by id or name
                        try:
                            from db.models.model_family import ModelFamily  # local import to avoid hard dependency
                            family_id = getattr(model, "family_id", None)
                            if family_id is not None:
                                mf = session.query(ModelFamily).filter_by(id=family_id).first()
                                model_icon = mf.icon if mf else None
                            else:
                                family_name = fam_attr if isinstance(fam_attr, str) else getattr(model, "family_name", None)
                                if family_name:
                                    mf = session.query(ModelFamily).filter_by(name=family_name).first()
                                    model_icon = mf.icon if mf else None
                        except Exception:
                            # If model family table or fields differ, just omit icon gracefully
                            pass
            except Exception:
                # Any issue resolving the icon should not break the endpoint
                pass

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
                "create_time": assistant.create_time.isoformat() if assistant.create_time else None,
                "last_modified": assistant.last_modified.isoformat() if assistant.last_modified else None,
                "model_icon": model_icon,
            }

            return response
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch assistant: {str(e)}")


@router.get("/", response_model=list[AssistantResponse], dependencies=[Depends(get_current_user)])
def get_assistants():
    try:
        with SessionLocal() as session:
            assistants = session.query(Assistant).order_by(desc(Assistant.create_time)).all()
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


@router.get("/{assistant_id}/endpoints/", response_model=list[AssistantEndpointResponse],
            dependencies=[Depends(get_current_user)])
def get_assistant_endpoints(assistant_id: int):
    try:
        with SessionLocal() as session:
            assistant = session.query(Assistant).filter_by(id=assistant_id).first()
            if not assistant:
                raise HTTPException(status_code=404, detail="Assistant not found")

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


@router.post("/{assistant_id}/run/", response_model=AssistantResponse,
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


@router.post("/{assistant_id}/stop/", response_model=AssistantResponse,
             dependencies=[Depends(get_current_user)])
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


@router.post("/{assistant_id}/chat/", response_model=ChatResponse)
async def chat_with_assistant(assistant_id: int, request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """Chat with an assistant using Ollama directly."""
    import httpx
    from core.config import settings
    
    try:
        with SessionLocal() as session:
            assistant = session.query(Assistant).filter_by(id=assistant_id).first()
            if not assistant:
                raise HTTPException(status_code=404, detail="Assistant not found")

            if assistant.status == 'initializing':
                raise HTTPException(status_code=202, detail="Assistant is still initializing. Please try again later.")
            
            if assistant.status == 'failed':
                raise HTTPException(status_code=500, detail="Assistant initialization failed")

            try:
                # Prepare messages for Ollama
                messages = [{"role": m.role, "content": m.content} for m in request.messages]
                
                # Call Ollama directly
                url = f"{settings.OLLAMA_HOST.rstrip('/')}/api/chat"
                
                payload = {
                    "model": assistant.model,
                    "messages": messages,
                    "stream": False,
                    "options": {}
                }
                
                # Add optional parameters
                if request.temperature is not None:
                    payload["options"]["temperature"] = request.temperature
                if request.max_tokens is not None:
                    payload["options"]["num_predict"] = request.max_tokens
                if request.top_p is not None:
                    payload["options"]["top_p"] = request.top_p
                
                start_time = time.time()
                
                async with httpx.AsyncClient(timeout=120.0) as client:
                    response = await client.post(url, json=payload)
                    response.raise_for_status()
                    result = response.json()
                
                duration = time.time() - start_time
                
                # Extract the response content
                response_content = result.get("message", {}).get("content", "")
                
                # Format the response
                choices = [{
                    "message": {
                        "role": "assistant",
                        "content": response_content
                    },
                    "index": 0,
                    "finish_reason": "stop"
                }]
                
                return ChatResponse(choices=choices, model=assistant.model)

            except httpx.HTTPError as e:
                raise HTTPException(status_code=500, detail=f"Failed to communicate with model: {str(e)}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to process chat: {str(e)}")

    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
