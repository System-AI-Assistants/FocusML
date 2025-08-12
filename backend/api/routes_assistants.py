import os

from fastapi import APIRouter, Depends, HTTPException
from mlflow.types.chat import ChatMessage
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError

from backend.api.deps import get_current_user
from backend.db.models.assistant import Assistant
from backend.db.models.model import Model
from backend.db.session import SessionLocal
from backend.api.ollama_model import OllamaModel
from backend.schemas.assistant import AssistantCreate, AssistantResponse, AssistantEndpointResponse
import mlflow

from backend.schemas.chat import ChatResponse, ChatRequest

router = APIRouter(prefix="/api/assistants", tags=["Assistants"])


@router.post("/", dependencies=[Depends(get_current_user)])
def create_assistant(assistant: AssistantCreate, token_info: dict = Depends(get_current_user)):
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
                    model_info = mlflow.pyfunc.log_model(
                        name="model",  # 'artifact_path' is deprecated; use 'name'
                        python_model="api/ollama_model.py",  # << script file, not an instance
                        model_config={
                            "model_name": assistant.model,  # e.g., "mistral:7b"
                            "ollama_host": os.getenv("OLLAMA_HOST", "http://localhost:11434"),
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


@router.get("/{assistant_id}", dependencies=[Depends(get_current_user)])
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
                            from backend.db.models.model_family import ModelFamily  # local import to avoid hard dependency
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


@router.get("/{assistant_id}/endpoints", response_model=list[AssistantEndpointResponse],
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


@router.post("/{assistant_id}/run", response_model=AssistantResponse,
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


@router.post("/{assistant_id}/stop", response_model=AssistantResponse,
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


@router.post("/{assistant_id}/chat", response_model=ChatResponse, dependencies=[Depends(get_current_user)])
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
            messages = [{"role": m.role, "content": m.content} for m in request.messages]

            params = {
                "max_tokens": request.max_tokens,
                "temperature": request.temperature,
                "top_p": request.top_p,
                "stop": request.stop,  # ensure list[str] or None
                "custom_inputs": request.custom_inputs,
            }

            # ❌ was: model.predict(messages, params)
            # ✅ MLflow ChatModel expects data={"messages": [...]}
            # Call model
            out = model.predict({"messages": messages}, params)

            # Normalize result to a dict shape your API expects
            if isinstance(out, dict):
                model_name = out.get("model") or assistant.model
                choices_in = out.get("choices", [])
                choices = []
                for i, ch in enumerate(choices_in):
                    msg = ch.get("message") or {}
                    choices.append({
                        "index": ch.get("index", i),
                        "message": {
                            "role": msg.get("role", "assistant"),
                            "content": msg.get("content", "")
                        }
                    })
            else:
                # Fallback if your model returns a ChatCompletionResponse object
                model_name = getattr(out, "model", assistant.model)
                choices = [{
                    "index": c.index,
                    "message": {
                        "role": c.message.role,
                        "content": c.message.content
                    }
                } for c in getattr(out, "choices", [])]

            return ChatResponse(choices=choices, model=model_name)

    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Failed to process chat: {str(e)}")
