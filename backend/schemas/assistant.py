from typing import Optional

from pydantic import BaseModel


class AssistantCreate(BaseModel):
    name: str
    version: str = None
    stage: str = None
    model: str
    is_local: bool = False
    group_id: Optional[int] = None
    data_collection_id: Optional[int] = None


class AssistantResponse(BaseModel):
    id: int
    name: str
    owner: str
    owner_username: Optional[str] = None
    group_id: Optional[int] = None
    data_collection_id: Optional[int] = None
    version: str = None
    stage: str = None
    model: str
    is_local: bool = None
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
