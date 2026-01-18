import os
import time
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from mlflow.types.chat import ChatMessage
from sqlalchemy import func, or_
from sqlalchemy.exc import SQLAlchemyError

from api.deps import get_current_user, is_platform_admin
from services.keycloack_service import get_keycloak_admin
from db.models.assistant import Assistant
from db.models.model import Model
from db.models.group import Group, GroupMember
from db.session import SessionLocal
from api.ollama_model import OllamaModel
from schemas.assistant import AssistantCreate, AssistantResponse, AssistantEndpointResponse
import mlflow

from schemas.chat import ChatResponse, ChatRequest
from fastapi import BackgroundTasks
from sqlalchemy import desc


router = APIRouter(prefix="/assistants", tags=["Assistants"])


def get_user_group_ids(session, user_id: str) -> List[int]:
    """Get all group IDs that a user is a member of."""
    memberships = session.query(GroupMember).filter(
        GroupMember.user_id == user_id,
        GroupMember.is_active == True
    ).all()
    return [m.group_id for m in memberships]


def user_can_access_assistant(session, user_id: str, assistant: Assistant, token_info: dict = None) -> bool:
    """Check if a user can access an assistant."""
    # Platform admin can access all assistants
    if token_info and is_platform_admin(token_info):
        return True
    
    # Owner can always access
    if assistant.owner == user_id:
        return True
    
    # If assistant belongs to a group, check if user is a member
    if assistant.group_id:
        user_groups = get_user_group_ids(session, user_id)
        if assistant.group_id in user_groups:
            return True
    
    return False


@router.post("/")
async def create_assistant(assistant: AssistantCreate, 
    background_tasks: BackgroundTasks,
    token_info: dict = Depends(get_current_user),
        ):
    try:
        with SessionLocal() as session:
            user_id = token_info.get('sub')
            
            # Validate model exists
            model = session.query(Model).filter_by(name=assistant.model).first()
            if not model:
                raise HTTPException(status_code=400, detail=f"Model '{assistant.model}' not found")
            
            # If group_id is provided, verify user is a member of that group
            if assistant.group_id:
                user_group_ids = get_user_group_ids(session, user_id)
                if assistant.group_id not in user_group_ids:
                    raise HTTPException(status_code=403, detail="You are not a member of the specified group")
                
                # Verify the group exists
                group = session.query(Group).filter_by(id=assistant.group_id).first()
                if not group:
                    raise HTTPException(status_code=404, detail="Group not found")

            db_assistant = Assistant(
                name=assistant.name,
                owner=user_id,
                group_id=assistant.group_id,
                data_collection_id=assistant.data_collection_id,
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
                "group_id": db_assistant.group_id,
                "database_url": db_assistant.database_url,
                "version": db_assistant.version,
                "stage": db_assistant.stage,
                "model": db_assistant.model,
                "is_local": db_assistant.is_local,
                "status": db_assistant.status,
                "mlflow_run_id": None,
                "create_time": db_assistant.create_time.isoformat(),
                "last_modified": db_assistant.last_modified.isoformat()
            }

            return response
    except HTTPException:
        raise
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

@router.get("/{assistant_id}/status/")
def get_assistant_status(assistant_id: int, token_info: dict = Depends(get_current_user)):
    """Check the initialization status of an assistant"""
    try:
        with SessionLocal() as session:
            assistant = session.query(Assistant).filter_by(id=assistant_id).first()
            if not assistant:
                raise HTTPException(status_code=404, detail="Assistant not found")
            
            # Check access permissions
            user_id = token_info.get('sub')
            if not user_can_access_assistant(session, user_id, assistant, token_info):
                raise HTTPException(status_code=403, detail="You don't have permission to access this assistant")
            
            return {
                "id": assistant.id,
                "name": assistant.name,
                "status": assistant.status,
                "mlflow_run_id": assistant.mlflow_run_id,
                "is_ready": assistant.status == 'running' and assistant.mlflow_run_id is not None
            }
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")

@router.get("/{assistant_id}/")
def get_assistant(assistant_id: int, token_info: dict = Depends(get_current_user)):
    """Get a single assistant by ID and include the model family's icon if available."""
    try:
        with SessionLocal() as session:
            assistant = session.query(Assistant).filter_by(id=assistant_id).first()
            if not assistant:
                raise HTTPException(status_code=404, detail="Assistant not found")
            
            # Check access permissions
            user_id = token_info.get('sub')
            if not user_can_access_assistant(session, user_id, assistant, token_info):
                raise HTTPException(status_code=403, detail="You don't have permission to access this assistant")

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
                "group_id": assistant.group_id,
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


@router.get("/", response_model=list[AssistantResponse])
def get_assistants(
    show_all: bool = False,
    token_info: dict = Depends(get_current_user)
):
    """
    Get assistants the current user can access.
    
    - By default (show_all=False): Returns only user's own assistants and group assistants
    - If show_all=True and user is platform admin: Returns ALL assistants
    """
    try:
        with SessionLocal() as session:
            user_id = token_info.get('sub')
            user_is_admin = is_platform_admin(token_info)
            
            # If admin wants to see all assistants
            if show_all and user_is_admin:
                query = session.query(Assistant).order_by(desc(Assistant.create_time))
            else:
                # Get user's group IDs
                user_group_ids = get_user_group_ids(session, user_id)
                
                # Query assistants: owned by user OR belonging to user's groups
                query = session.query(Assistant).filter(
                    or_(
                        Assistant.owner == user_id,
                        Assistant.group_id.in_(user_group_ids) if user_group_ids else False
                    )
                ).order_by(desc(Assistant.create_time))
            
            assistants = query.all()
            
            # Get owner usernames for all unique owners (only if showing all)
            owner_usernames = {}
            if show_all and user_is_admin:
                unique_owners = set(a.owner for a in assistants if a.owner)
                try:
                    admin = get_keycloak_admin()
                    if admin:
                        for owner_id in unique_owners:
                            try:
                                user = admin.get_user(owner_id)
                                owner_usernames[owner_id] = user.get('username', owner_id[:8])
                            except Exception:
                                owner_usernames[owner_id] = owner_id[:8]
                except Exception:
                    pass
            
            result = [
                {
                    "id": assistant.id,
                    "name": assistant.name,
                    "owner": assistant.owner,
                    "owner_username": owner_usernames.get(assistant.owner, assistant.owner[:8] if assistant.owner else None),
                    "group_id": assistant.group_id,
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


@router.get("/{assistant_id}/endpoints/", response_model=list[AssistantEndpointResponse])
def get_assistant_endpoints(assistant_id: int, token_info: dict = Depends(get_current_user)):
    try:
        with SessionLocal() as session:
            assistant = session.query(Assistant).filter_by(id=assistant_id).first()
            if not assistant:
                raise HTTPException(status_code=404, detail="Assistant not found")
            
            # Check access permissions
            user_id = token_info.get('sub')
            if not user_can_access_assistant(session, user_id, assistant, token_info):
                raise HTTPException(status_code=403, detail="You don't have permission to access this assistant")

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


@router.post("/{assistant_id}/run/", response_model=AssistantResponse, tags=["Assistants"])
def run_assistant(assistant_id: int, token_info: dict = Depends(get_current_user)):
    """Run an assistant by updating its status to 'running'."""
    try:
        with SessionLocal() as session:
            assistant = session.query(Assistant).filter_by(id=assistant_id).first()
            if not assistant:
                raise HTTPException(status_code=404, detail="Assistant not found")
            
            # Check access permissions
            user_id = token_info.get('sub')
            if not user_can_access_assistant(session, user_id, assistant, token_info):
                raise HTTPException(status_code=403, detail="You don't have permission to access this assistant")
            
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
                "group_id": assistant.group_id,
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


@router.post("/{assistant_id}/stop/", response_model=AssistantResponse)
def stop_assistant(assistant_id: int, token_info: dict = Depends(get_current_user)):
    """Stop an assistant by updating its status to 'stopped'."""
    try:
        with SessionLocal() as session:
            assistant = session.query(Assistant).filter_by(id=assistant_id).first()
            if not assistant:
                raise HTTPException(status_code=404, detail="Assistant not found")
            
            # Check access permissions
            user_id = token_info.get('sub')
            if not user_can_access_assistant(session, user_id, assistant, token_info):
                raise HTTPException(status_code=403, detail="You don't have permission to access this assistant")
            
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
                "group_id": assistant.group_id,
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
async def chat_with_assistant(assistant_id: int, request: ChatRequest, token_info: dict = Depends(get_current_user)):
    """Chat with an assistant using Ollama directly."""
    import httpx
    from core.config import settings
    
    try:
        with SessionLocal() as session:
            assistant = session.query(Assistant).filter_by(id=assistant_id).first()
            if not assistant:
                raise HTTPException(status_code=404, detail="Assistant not found")
            
            # Check access permissions
            user_id = token_info.get('sub')
            if not user_can_access_assistant(session, user_id, assistant, token_info):
                raise HTTPException(status_code=403, detail="You don't have permission to access this assistant")

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
