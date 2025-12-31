from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import secrets

from api.deps import get_current_user
from db.session import SessionLocal
from db.models.api_key import APIKey, APIUsageLog, APIKeyWhitelist
from db.models.assistant import Assistant

router = APIRouter(prefix="/integrations", tags=["Integrations"])


# Pydantic schemas
class APIKeyCreate(BaseModel):
    assistant_id: int
    name: str = Field(..., min_length=1, max_length=255)
    expires_at: Optional[datetime] = None
    usage_quota: Optional[int] = Field(None, gt=0)
    usage_period: Optional[str] = Field(None, pattern="^(day|week|month)$")


class APIKeyResponse(BaseModel):
    id: int
    assistant_id: int
    name: str
    key_prefix: str
    masked_key: str
    is_active: bool
    last_used_at: Optional[datetime]
    created_at: datetime
    expires_at: Optional[datetime]
    usage_quota: Optional[int]
    usage_period: Optional[str]
    current_usage: int
    usage_reset_at: Optional[datetime]

    class Config:
        from_attributes = True


class APIKeyFullResponse(APIKeyResponse):
    full_key: str  # Only returned once on creation


class WhitelistEntryCreate(BaseModel):
    type: str = Field(..., pattern="^(domain|ip)$")
    value: str
    description: Optional[str] = None


class WhitelistEntryResponse(BaseModel):
    id: int
    api_key_id: int
    type: str
    value: str
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class StatisticsResponse(BaseModel):
    total_requests: int
    successful_requests: int
    failed_requests: int
    error_rate: float
    avg_latency_ms: float
    avg_ttft_ms: Optional[float]
    requests_by_endpoint: dict
    requests_by_status: dict
    requests_over_time: List[dict]
    error_breakdown: dict


# API Key Management Endpoints
@router.post("/api-keys/", response_model=APIKeyFullResponse, dependencies=[Depends(get_current_user)])
def create_api_key(
    api_key_data: APIKeyCreate,
    token_info: dict = Depends(get_current_user)
):
    """Create a new API key for an assistant"""
    db = SessionLocal()
    try:
        # Verify assistant exists and belongs to user
        assistant = db.query(Assistant).filter(
            and_(
                Assistant.id == api_key_data.assistant_id,
                Assistant.owner == token_info.get('sub')
            )
        ).first()
        
        if not assistant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assistant not found or access denied"
            )

        # Generate new API key
        full_key = APIKey.generate_key()
        key_hash = APIKey.hash_key(full_key)
        key_prefix = full_key[:20]  # First 20 chars for prefix

        # Calculate usage reset time if quota is set
        usage_reset_at = None
        if api_key_data.usage_quota:
            if api_key_data.usage_period == 'day':
                usage_reset_at = datetime.utcnow() + timedelta(days=1)
            elif api_key_data.usage_period == 'week':
                usage_reset_at = datetime.utcnow() + timedelta(weeks=1)
            elif api_key_data.usage_period == 'month':
                usage_reset_at = datetime.utcnow() + timedelta(days=30)

        api_key = APIKey(
            assistant_id=api_key_data.assistant_id,
            name=api_key_data.name,
            key_hash=key_hash,
            key_prefix=key_prefix,
            owner=token_info.get('sub'),
            expires_at=api_key_data.expires_at,
            usage_quota=api_key_data.usage_quota,
            usage_period=api_key_data.usage_period,
            usage_reset_at=usage_reset_at
        )

        db.add(api_key)
        db.commit()
        db.refresh(api_key)

        response = APIKeyFullResponse(
            id=api_key.id,
            assistant_id=api_key.assistant_id,
            name=api_key.name,
            key_prefix=api_key.key_prefix,
            masked_key=api_key.mask_key(),
            is_active=api_key.is_active,
            last_used_at=api_key.last_used_at,
            created_at=api_key.created_at,
            expires_at=api_key.expires_at,
            usage_quota=api_key.usage_quota,
            usage_period=api_key.usage_period,
            current_usage=api_key.current_usage,
            usage_reset_at=api_key.usage_reset_at,
            full_key=full_key  # Only time this is returned
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create API key: {str(e)}"
        )
    finally:
        db.close()


@router.get("/api-keys/", response_model=List[APIKeyResponse], dependencies=[Depends(get_current_user)])
def list_api_keys(
    assistant_id: Optional[int] = None,
    token_info: dict = Depends(get_current_user)
):
    """List all API keys for the current user, optionally filtered by assistant"""
    db = SessionLocal()
    try:
        query = db.query(APIKey).filter(APIKey.owner == token_info.get('sub'))
        
        if assistant_id:
            query = query.filter(APIKey.assistant_id == assistant_id)

        api_keys = query.order_by(APIKey.created_at.desc()).all()

        result = []
        for key in api_keys:
            # Count actual requests from usage logs
            actual_usage = db.query(func.count(APIUsageLog.id)).filter(
                APIUsageLog.api_key_id == key.id
            ).scalar() or 0
            
            result.append(APIKeyResponse(
                id=key.id,
                assistant_id=key.assistant_id,
                name=key.name,
                key_prefix=key.key_prefix,
                masked_key=key.mask_key(),
                is_active=key.is_active,
                last_used_at=key.last_used_at,
                created_at=key.created_at,
                expires_at=key.expires_at,
                usage_quota=key.usage_quota,
                usage_period=key.usage_period,
                current_usage=actual_usage,
                usage_reset_at=key.usage_reset_at
            ))
        
        return result

    finally:
        db.close()


@router.get("/api-keys/{key_id}/", response_model=APIKeyResponse, dependencies=[Depends(get_current_user)])
def get_api_key(
    key_id: int,
    token_info: dict = Depends(get_current_user)
):
    """Get a specific API key"""
    db = SessionLocal()
    try:
        api_key = db.query(APIKey).filter(
            and_(
                APIKey.id == key_id,
                APIKey.owner == token_info.get('sub')
            )
        ).first()

        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )

        # Count actual requests from usage logs
        actual_usage = db.query(func.count(APIUsageLog.id)).filter(
            APIUsageLog.api_key_id == api_key.id
        ).scalar() or 0

        return APIKeyResponse(
            id=api_key.id,
            assistant_id=api_key.assistant_id,
            name=api_key.name,
            key_prefix=api_key.key_prefix,
            masked_key=api_key.mask_key(),
            is_active=api_key.is_active,
            last_used_at=api_key.last_used_at,
            created_at=api_key.created_at,
            expires_at=api_key.expires_at,
            usage_quota=api_key.usage_quota,
            usage_period=api_key.usage_period,
            current_usage=actual_usage,
            usage_reset_at=api_key.usage_reset_at
        )

    finally:
        db.close()


@router.delete("/api-keys/{key_id}/", dependencies=[Depends(get_current_user)])
def revoke_api_key(
    key_id: int,
    token_info: dict = Depends(get_current_user)
):
    """Revoke (delete) an API key"""
    db = SessionLocal()
    try:
        api_key = db.query(APIKey).filter(
            and_(
                APIKey.id == key_id,
                APIKey.owner == token_info.get('sub')
            )
        ).first()

        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )

        db.delete(api_key)
        db.commit()

        return {"message": "API key revoked successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to revoke API key: {str(e)}"
        )
    finally:
        db.close()


@router.patch("/api-keys/{key_id}/toggle/", dependencies=[Depends(get_current_user)])
def toggle_api_key(
    key_id: int,
    token_info: dict = Depends(get_current_user)
):
    """Toggle API key active status"""
    db = SessionLocal()
    try:
        api_key = db.query(APIKey).filter(
            and_(
                APIKey.id == key_id,
                APIKey.owner == token_info.get('sub')
            )
        ).first()

        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )

        api_key.is_active = not api_key.is_active
        db.commit()
        db.refresh(api_key)

        return {"message": f"API key {'activated' if api_key.is_active else 'deactivated'}", "is_active": api_key.is_active}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle API key: {str(e)}"
        )
    finally:
        db.close()


# Whitelist Management Endpoints
@router.post("/api-keys/{key_id}/whitelist/", response_model=WhitelistEntryResponse, dependencies=[Depends(get_current_user)])
def add_whitelist_entry(
    key_id: int,
    entry: WhitelistEntryCreate,
    token_info: dict = Depends(get_current_user)
):
    """Add a domain or IP to the whitelist for an API key"""
    db = SessionLocal()
    try:
        api_key = db.query(APIKey).filter(
            and_(
                APIKey.id == key_id,
                APIKey.owner == token_info.get('sub')
            )
        ).first()

        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )

        whitelist_entry = APIKeyWhitelist(
            api_key_id=key_id,
            type=entry.type,
            value=entry.value,
            description=entry.description
        )

        db.add(whitelist_entry)
        db.commit()
        db.refresh(whitelist_entry)

        return WhitelistEntryResponse(
            id=whitelist_entry.id,
            api_key_id=whitelist_entry.api_key_id,
            type=whitelist_entry.type,
            value=whitelist_entry.value,
            description=whitelist_entry.description,
            created_at=whitelist_entry.created_at
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add whitelist entry: {str(e)}"
        )
    finally:
        db.close()


@router.get("/api-keys/{key_id}/whitelist/", response_model=List[WhitelistEntryResponse], dependencies=[Depends(get_current_user)])
def list_whitelist_entries(
    key_id: int,
    token_info: dict = Depends(get_current_user)
):
    """List all whitelist entries for an API key"""
    db = SessionLocal()
    try:
        api_key = db.query(APIKey).filter(
            and_(
                APIKey.id == key_id,
                APIKey.owner == token_info.get('sub')
            )
        ).first()

        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )

        entries = db.query(APIKeyWhitelist).filter(
            APIKeyWhitelist.api_key_id == key_id
        ).all()

        return [
            WhitelistEntryResponse(
                id=entry.id,
                api_key_id=entry.api_key_id,
                type=entry.type,
                value=entry.value,
                description=entry.description,
                created_at=entry.created_at
            )
            for entry in entries
        ]

    finally:
        db.close()


@router.delete("/api-keys/{key_id}/whitelist/{entry_id}/", dependencies=[Depends(get_current_user)])
def remove_whitelist_entry(
    key_id: int,
    entry_id: int,
    token_info: dict = Depends(get_current_user)
):
    """Remove a whitelist entry"""
    db = SessionLocal()
    try:
        api_key = db.query(APIKey).filter(
            and_(
                APIKey.id == key_id,
                APIKey.owner == token_info.get('sub')
            )
        ).first()

        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )

        entry = db.query(APIKeyWhitelist).filter(
            and_(
                APIKeyWhitelist.id == entry_id,
                APIKeyWhitelist.api_key_id == key_id
            )
        ).first()

        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Whitelist entry not found"
            )

        db.delete(entry)
        db.commit()

        return {"message": "Whitelist entry removed successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove whitelist entry: {str(e)}"
        )
    finally:
        db.close()


# Statistics Endpoints
@router.get("/api-keys/{key_id}/statistics/", response_model=StatisticsResponse, dependencies=[Depends(get_current_user)])
def get_api_key_statistics(
    key_id: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    token_info: dict = Depends(get_current_user)
):
    """Get statistics for an API key"""
    db = SessionLocal()
    try:
        api_key = db.query(APIKey).filter(
            and_(
                APIKey.id == key_id,
                APIKey.owner == token_info.get('sub')
            )
        ).first()

        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )

        # Default to last 30 days if not specified
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        # Base query
        query = db.query(APIUsageLog).filter(
            and_(
                APIUsageLog.api_key_id == key_id,
                APIUsageLog.created_at >= start_date,
                APIUsageLog.created_at <= end_date
            )
        )

        # Total requests
        total_requests = query.count()

        # Successful vs failed
        successful_requests = query.filter(APIUsageLog.status_code < 400).count()
        failed_requests = query.filter(APIUsageLog.status_code >= 400).count()
        error_rate = (failed_requests / total_requests * 100) if total_requests > 0 else 0

        # Average latency
        avg_latency = db.query(func.avg(APIUsageLog.response_time_ms)).filter(
            and_(
                APIUsageLog.api_key_id == key_id,
                APIUsageLog.created_at >= start_date,
                APIUsageLog.created_at <= end_date,
                APIUsageLog.response_time_ms.isnot(None)
            )
        ).scalar() or 0

        # Average TTFT
        avg_ttft = db.query(func.avg(APIUsageLog.time_to_first_token_ms)).filter(
            and_(
                APIUsageLog.api_key_id == key_id,
                APIUsageLog.created_at >= start_date,
                APIUsageLog.created_at <= end_date,
                APIUsageLog.time_to_first_token_ms.isnot(None)
            )
        ).scalar()

        # Requests by endpoint
        endpoint_stats = db.query(
            APIUsageLog.endpoint,
            func.count(APIUsageLog.id).label('count')
        ).filter(
            and_(
                APIUsageLog.api_key_id == key_id,
                APIUsageLog.created_at >= start_date,
                APIUsageLog.created_at <= end_date
            )
        ).group_by(APIUsageLog.endpoint).all()

        requests_by_endpoint = {endpoint: count for endpoint, count in endpoint_stats}

        # Requests by status code
        status_stats = db.query(
            APIUsageLog.status_code,
            func.count(APIUsageLog.id).label('count')
        ).filter(
            and_(
                APIUsageLog.api_key_id == key_id,
                APIUsageLog.created_at >= start_date,
                APIUsageLog.created_at <= end_date
            )
        ).group_by(APIUsageLog.status_code).all()

        requests_by_status = {str(status): count for status, count in status_stats}

        # Requests over time (hourly buckets)
        time_buckets = db.query(
            func.date_trunc('hour', APIUsageLog.created_at).label('hour'),
            func.count(APIUsageLog.id).label('count')
        ).filter(
            and_(
                APIUsageLog.api_key_id == key_id,
                APIUsageLog.created_at >= start_date,
                APIUsageLog.created_at <= end_date
            )
        ).group_by('hour').order_by('hour').all()

        requests_over_time = [
            {"timestamp": bucket.hour.isoformat(), "count": bucket.count}
            for bucket in time_buckets
        ]

        # Error breakdown
        error_breakdown = db.query(
            APIUsageLog.error_type,
            func.count(APIUsageLog.id).label('count')
        ).filter(
            and_(
                APIUsageLog.api_key_id == key_id,
                APIUsageLog.created_at >= start_date,
                APIUsageLog.created_at <= end_date,
                APIUsageLog.error_type.isnot(None)
            )
        ).group_by(APIUsageLog.error_type).all()

        error_breakdown_dict = {error_type: count for error_type, count in error_breakdown if error_type}

        return StatisticsResponse(
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            error_rate=round(error_rate, 2),
            avg_latency_ms=round(float(avg_latency), 2),
            avg_ttft_ms=round(float(avg_ttft), 2) if avg_ttft else None,
            requests_by_endpoint=requests_by_endpoint,
            requests_by_status=requests_by_status,
            requests_over_time=requests_over_time,
            error_breakdown=error_breakdown_dict
        )

    finally:
        db.close()


@router.get("/assistants/{assistant_id}/statistics/", response_model=StatisticsResponse, dependencies=[Depends(get_current_user)])
def get_assistant_statistics(
    assistant_id: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    token_info: dict = Depends(get_current_user)
):
    """Get aggregated statistics for all API keys of an assistant"""
    db = SessionLocal()
    try:
        assistant = db.query(Assistant).filter(
            and_(
                Assistant.id == assistant_id,
                Assistant.owner == token_info.get('sub')
            )
        ).first()

        if not assistant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assistant not found"
            )

        # Get all API keys for this assistant
        api_keys = db.query(APIKey).filter(APIKey.assistant_id == assistant_id).all()
        key_ids = [key.id for key in api_keys]

        if not key_ids:
            return StatisticsResponse(
                total_requests=0,
                successful_requests=0,
                failed_requests=0,
                error_rate=0,
                avg_latency_ms=0,
                avg_ttft_ms=None,
                requests_by_endpoint={},
                requests_by_status={},
                requests_over_time=[],
                error_breakdown={}
            )

        # Default to last 30 days if not specified
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        # Aggregate statistics across all keys
        query = db.query(APIUsageLog).filter(
            and_(
                APIUsageLog.api_key_id.in_(key_ids),
                APIUsageLog.created_at >= start_date,
                APIUsageLog.created_at <= end_date
            )
        )

        total_requests = query.count()
        successful_requests = query.filter(APIUsageLog.status_code < 400).count()
        failed_requests = query.filter(APIUsageLog.status_code >= 400).count()
        error_rate = (failed_requests / total_requests * 100) if total_requests > 0 else 0

        avg_latency = db.query(func.avg(APIUsageLog.response_time_ms)).filter(
            and_(
                APIUsageLog.api_key_id.in_(key_ids),
                APIUsageLog.created_at >= start_date,
                APIUsageLog.created_at <= end_date,
                APIUsageLog.response_time_ms.isnot(None)
            )
        ).scalar() or 0

        avg_ttft = db.query(func.avg(APIUsageLog.time_to_first_token_ms)).filter(
            and_(
                APIUsageLog.api_key_id.in_(key_ids),
                APIUsageLog.created_at >= start_date,
                APIUsageLog.created_at <= end_date,
                APIUsageLog.time_to_first_token_ms.isnot(None)
            )
        ).scalar()

        endpoint_stats = db.query(
            APIUsageLog.endpoint,
            func.count(APIUsageLog.id).label('count')
        ).filter(
            and_(
                APIUsageLog.api_key_id.in_(key_ids),
                APIUsageLog.created_at >= start_date,
                APIUsageLog.created_at <= end_date
            )
        ).group_by(APIUsageLog.endpoint).all()

        requests_by_endpoint = {endpoint: count for endpoint, count in endpoint_stats}

        status_stats = db.query(
            APIUsageLog.status_code,
            func.count(APIUsageLog.id).label('count')
        ).filter(
            and_(
                APIUsageLog.api_key_id.in_(key_ids),
                APIUsageLog.created_at >= start_date,
                APIUsageLog.created_at <= end_date
            )
        ).group_by(APIUsageLog.status_code).all()

        requests_by_status = {str(status): count for status, count in status_stats}

        time_buckets = db.query(
            func.date_trunc('hour', APIUsageLog.created_at).label('hour'),
            func.count(APIUsageLog.id).label('count')
        ).filter(
            and_(
                APIUsageLog.api_key_id.in_(key_ids),
                APIUsageLog.created_at >= start_date,
                APIUsageLog.created_at <= end_date
            )
        ).group_by('hour').order_by('hour').all()

        requests_over_time = [
            {"timestamp": bucket.hour.isoformat(), "count": bucket.count}
            for bucket in time_buckets
        ]

        error_breakdown = db.query(
            APIUsageLog.error_type,
            func.count(APIUsageLog.id).label('count')
        ).filter(
            and_(
                APIUsageLog.api_key_id.in_(key_ids),
                APIUsageLog.created_at >= start_date,
                APIUsageLog.created_at <= end_date,
                APIUsageLog.error_type.isnot(None)
            )
        ).group_by(APIUsageLog.error_type).all()

        error_breakdown_dict = {error_type: count for error_type, count in error_breakdown if error_type}

        return StatisticsResponse(
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            error_rate=round(error_rate, 2),
            avg_latency_ms=round(float(avg_latency), 2),
            avg_ttft_ms=round(float(avg_ttft), 2) if avg_ttft else None,
            requests_by_endpoint=requests_by_endpoint,
            requests_by_status=requests_by_status,
            requests_over_time=requests_over_time,
            error_breakdown=error_breakdown_dict
        )

    finally:
        db.close()

