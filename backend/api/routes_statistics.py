import os
import psutil
import shutil
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, and_
from sqlalchemy.exc import SQLAlchemyError

from api.deps import get_current_user
from db.models.assistant import Assistant
from db.session import SessionLocal
from services.keycloack_service import get_keycloak_admin
from schemas.statistics import StatisticsResponse, SystemMetrics, AssistantStats, UserStats, GPUMetrics
import mlflow
from mlflow.tracking import MlflowClient


try:
    import GPUtil
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False
class TimePeriod(str, Enum):
    TODAY = "today"
    SEVEN_DAYS = "last7days"
    THIRTY_DAYS = "last30days"
    NINETY_DAYS = "last90days"
    THIS_MONTH = "thisMonth"
    ALL_TIME = "allTime"


router = APIRouter(prefix="/statistics", tags=["Statistics"])


def get_period_dates(period: TimePeriod) -> tuple[Optional[datetime], datetime]:
    """Get start and end dates for the specified period"""
    now = datetime.utcnow()

    if period == TimePeriod.TODAY:
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == TimePeriod.SEVEN_DAYS:
        start_date = now - timedelta(days=7)
    elif period == TimePeriod.THIRTY_DAYS:
        start_date = now - timedelta(days=30)
    elif period == TimePeriod.NINETY_DAYS:
        start_date = now - timedelta(days=90)
    elif period == TimePeriod.THIS_MONTH:
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == TimePeriod.ALL_TIME:
        start_date = None
    else:
        raise HTTPException(status_code=400, detail="Invalid period specified")

    return start_date, now


def get_previous_period_dates(period: TimePeriod, start_date: Optional[datetime], end_date: datetime) -> tuple[Optional[datetime], Optional[datetime]]:
    """Get the previous period dates for comparison"""
    if period == TimePeriod.ALL_TIME or start_date is None:
        return None, None

    period_duration = end_date - start_date
    prev_end_date = start_date
    prev_start_date = start_date - period_duration

    return prev_start_date, prev_end_date


def calculate_percentage_change(current: int, previous: int) -> Optional[float]:
    """Calculate percentage change between current and previous values"""
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return ((current - previous) / previous) * 100


def get_assistant_statistics(session, period: TimePeriod) -> AssistantStats:
    """Get assistant statistics for the specified period"""
    start_date, end_date = get_period_dates(period)

    # Current period stats
    query = session.query(Assistant)
    if start_date:
        current_total = query.filter(Assistant.create_time <= end_date).count()
        current_active = query.filter(
            and_(
                Assistant.create_time <= end_date,
                Assistant.status == 'running'
            )
        ).count()
    else:
        current_total = query.count()
        current_active = query.filter(Assistant.status == 'running').count()

    # Previous period stats for comparison
    prev_start_date, prev_end_date = get_previous_period_dates(period, start_date, end_date)
    total_change = None
    active_change = None

    if prev_start_date and prev_end_date:
        prev_total = query.filter(Assistant.create_time <= prev_end_date).count()
        prev_active = query.filter(
            and_(
                Assistant.create_time <= prev_end_date,
                Assistant.status == 'running'
            )
        ).count()

        total_change = calculate_percentage_change(current_total, prev_total)
        active_change = calculate_percentage_change(current_active, prev_active)

    return AssistantStats(
        total_assistants=current_total,
        active_assistants=current_active,
        total_change_percentage=total_change,
        active_change_percentage=active_change
    )


def get_user_statistics(period: TimePeriod) -> UserStats:
    """Get user statistics from Keycloak for the specified period"""
    try:
        keycloak_admin = get_keycloak_admin()
        if not keycloak_admin:
            return UserStats(total_users=0, change_percentage=None)

        users = keycloak_admin.get_users()
        current_total = len(users) if users else 0

        return UserStats(
            total_users=current_total,
            change_percentage=None  # Would need historical tracking
        )
    except Exception as e:
        print(f"Failed to get user statistics from Keycloak: {e}")
        # Return default values instead of failing completely
        return UserStats(total_users=0, change_percentage=None)

def get_token_usage_statistics(session, period: TimePeriod) -> Dict[str, Any]:
    """Get token usage statistics from MLflow"""

    try:
        client = MlflowClient()

        return {
            "total_tokens": None,
            "input_tokens": None,
            "output_tokens": None,
            "change_percentage": None,

        }
    except Exception as e:
        return {
            "total_tokens": None,
            "error": f"MLflow client error: {str(e)}"
        }


def get_gpu_metrics() -> Optional[List[GPUMetrics]]:
    """Get GPU metrics if available"""
    if not GPU_AVAILABLE:
        return None

    try:
        gpus = GPUtil.getGPUs()
        if not gpus:
            return None

        gpu_metrics = []
        for gpu in gpus:
            gpu_metrics.append(GPUMetrics(
                                   id=gpu.id,
                                   name=gpu.name,
                                   memory_used=gpu.memoryUsed,
                                   memory_total=gpu.memoryTotal,
                                   memory_usage=gpu.memoryUtil * 100,  # Convert to percentage
                                   gpu_usage=gpu.load * 100,  # Convert to percentage
                                   temperature=gpu.temperature
                               ))

        return gpu_metrics
    except Exception as e:
        print(f"Failed to get GPU metrics: {e}")
        return None

def get_system_metrics() -> SystemMetrics:
    """Get current system metrics"""
    try:
        # CPU usage
        cpu_usage = psutil.cpu_percent(interval=1)

        # Memory usage
        memory = psutil.virtual_memory()
        memory_usage = memory.percent

        # Storage usage
        disk = psutil.disk_usage('/')
        storage_usage = (disk.used / disk.total) * 100

        # Network I/O
        network = psutil.net_io_counters()

        # GPU metrics
        gpu_metrics = get_gpu_metrics()

        return SystemMetrics(
            cpu_usage=cpu_usage,
            memory_usage=memory_usage,
            storage_usage=storage_usage,
            network_bytes_sent=network.bytes_sent,
            network_bytes_recv=network.bytes_recv,
            network_packets_sent=network.packets_sent,
            network_packets_recv=network.packets_recv,
            gpu_metrics=gpu_metrics
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get system metrics: {str(e)}")


def calculate_availability_metrics() -> Dict[str, Any]:


    return {
        "availability_percentage": 99.95,
        "uptime_hours": 720,
        "total_requests": None,
        "failed_requests": None,
        "average_response_time_ms": None,
        
    }


@router.get("/", response_model=StatisticsResponse, dependencies=[Depends(get_current_user)])
def get_statistics(
        period: TimePeriod = Query(TimePeriod.SEVEN_DAYS, description="Time period for statistics")
):
    """Get comprehensive system statistics for the specified period"""
    try:
        with SessionLocal() as session:
            # Get assistant statistics
            assistant_stats = get_assistant_statistics(session, period)

            # Get user statistics
            user_stats = get_user_statistics(period)

            # Get token usage (placeholder for now)
            token_usage = get_token_usage_statistics(session, period)

            # Get system metrics
            system_metrics = get_system_metrics()

            # Get availability metrics (placeholder for now)
            availability = calculate_availability_metrics()

            return StatisticsResponse(
                period=period,
                assistant_stats=assistant_stats,
                user_stats=user_stats,
                token_usage=token_usage,
                system_metrics=system_metrics,
                availability=availability,
                generated_at=datetime.utcnow()
            )

    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate statistics: {str(e)}")


@router.get("/system/", response_model=SystemMetrics, dependencies=[Depends(get_current_user)])
def get_system_metrics_only():
    """Get current system metrics only"""
    return get_system_metrics()


@router.get("/assistants/", dependencies=[Depends(get_current_user)])
def get_assistant_statistics_only(
        period: TimePeriod = Query(TimePeriod.SEVEN_DAYS, description="Time period for statistics")
):
    """Get assistant statistics only"""
    try:
        with SessionLocal() as session:
            return get_assistant_statistics(session, period)
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")