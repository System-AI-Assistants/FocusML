from pydantic import BaseModel, Field
from typing import Optional, List


class BenchmarkDataset(BaseModel):
    name: str
    description: Optional[str] = None
    task_type: Optional[str] = None
    url: Optional[str] = None


class BenchmarkRunRequest(BaseModel):
    model: str = Field(..., description="Model name to evaluate, e.g., 'mistral:7b'")
    dataset: str = Field(..., description="Benchmark dataset identifier, e.g., 'mmlu-pro'")


class BenchmarkRunResponse(BaseModel):
    id: str
    model: str
    dataset: str
    status: str
    score: Optional[float] = None


class BenchmarkRun(BaseModel):
    id: str
    model: str
    dataset: str
    status: str
    score: Optional[float] = None
    created_at: str
