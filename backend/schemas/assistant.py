from typing import Optional

from pydantic import BaseModel


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
    mlflow_run_id: Optional[str] = None
    create_time: str
    last_modified: str

    class Config:
        orm_mode = True


class AssistantEndpointResponse(BaseModel):
    endpoint: str
    method: str
    description: str
