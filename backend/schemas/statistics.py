from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel


class AssistantStats(BaseModel):
    total_assistants: int
    active_assistants: int
    total_change_percentage: Optional[float] = None
    active_change_percentage: Optional[float] = None


class UserStats(BaseModel):
    total_users: Optional[int] = None
    change_percentage: Optional[float] = None

class GPUMetrics(BaseModel):
    id: int
    name: str
    memory_used: float  # MB
    memory_total: float  # MB
    memory_usage: float  # Percentage
    gpu_usage: float  # Percentage
    temperature: float  # Celsius

class SystemMetrics(BaseModel):
    cpu_usage: float  # Percentage
    memory_usage: float  # Percentage
    storage_usage: float  # Percentage
    network_bytes_sent: int
    network_bytes_recv: int
    network_packets_sent: int
    network_packets_recv: int
    gpu_metrics: Optional[List[GPUMetrics]] = None


class StatisticsResponse(BaseModel):
    period: str
    assistant_stats: AssistantStats
    user_stats: UserStats
    token_usage: Dict[str, Any]
    system_metrics: SystemMetrics
    availability: Dict[str, Any]
    generated_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

