"""
Widget API routes for embeddable chat widget management
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import secrets
import uuid
import httpx

from api.deps import get_current_user
from db.session import SessionLocal
from db.models.widget import Widget, WidgetSession, WidgetMessage, WidgetUsageLog
from db.models.assistant import Assistant
from core.config import settings

router = APIRouter(prefix="/widgets", tags=["Widgets"])


# Pydantic Schemas
class WidgetCreate(BaseModel):
    assistant_id: int
    name: str = Field(..., min_length=1, max_length=255)
    
    # Optional configuration
    position: str = Field(default='bottom-right', pattern='^(bottom-right|bottom-left|top-right|top-left)$')
    primary_color: str = Field(default='#1890ff', max_length=20)
    button_size: int = Field(default=60, ge=40, le=100)
    button_icon: str = Field(default='chat', max_length=50)
    custom_icon_url: Optional[str] = None
    avatar_url: Optional[str] = None
    
    start_message: Optional[str] = None
    placeholder_text: str = Field(default='Type a message...', max_length=255)
    allow_attachments: bool = False
    max_attachment_size_mb: int = Field(default=5, ge=1, le=25)
    allowed_attachment_types: List[str] = ['image/jpeg', 'image/png', 'application/pdf']
    
    enable_persistence: bool = True
    persistence_type: str = Field(default='local', pattern='^(local|server)$')
    session_timeout_hours: int = Field(default=24, ge=1, le=720)
    
    show_branding: bool = True
    custom_css: Optional[str] = None
    window_title: str = Field(default='Chat with us', max_length=255)
    
    allowed_domains: List[str] = []
    usage_quota: Optional[int] = Field(None, gt=0)
    usage_period: Optional[str] = Field(None, pattern='^(day|week|month)$')
    expires_at: Optional[datetime] = None


class WidgetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    is_active: Optional[bool] = None
    
    position: Optional[str] = Field(None, pattern='^(bottom-right|bottom-left|top-right|top-left)$')
    primary_color: Optional[str] = Field(None, max_length=20)
    button_size: Optional[int] = Field(None, ge=40, le=100)
    button_icon: Optional[str] = Field(None, max_length=50)
    custom_icon_url: Optional[str] = None
    avatar_url: Optional[str] = None
    
    start_message: Optional[str] = None
    placeholder_text: Optional[str] = Field(None, max_length=255)
    allow_attachments: Optional[bool] = None
    max_attachment_size_mb: Optional[int] = Field(None, ge=1, le=25)
    allowed_attachment_types: Optional[List[str]] = None
    
    enable_persistence: Optional[bool] = None
    persistence_type: Optional[str] = Field(None, pattern='^(local|server)$')
    session_timeout_hours: Optional[int] = Field(None, ge=1, le=720)
    
    show_branding: Optional[bool] = None
    custom_css: Optional[str] = None
    window_title: Optional[str] = Field(None, max_length=255)
    
    allowed_domains: Optional[List[str]] = None
    usage_quota: Optional[int] = Field(None, gt=0)
    usage_period: Optional[str] = Field(None, pattern='^(day|week|month)$')
    expires_at: Optional[datetime] = None


class WidgetResponse(BaseModel):
    id: int
    assistant_id: int
    name: str
    token_prefix: str
    masked_token: str
    is_active: bool
    last_used_at: Optional[datetime]
    created_at: datetime
    expires_at: Optional[datetime]
    
    position: str
    primary_color: str
    button_size: int
    button_icon: str
    custom_icon_url: Optional[str]
    avatar_url: Optional[str]
    
    start_message: Optional[str]
    placeholder_text: str
    allow_attachments: bool
    max_attachment_size_mb: int
    allowed_attachment_types: List[str]
    
    enable_persistence: bool
    persistence_type: str
    session_timeout_hours: int
    
    show_branding: bool
    custom_css: Optional[str]
    window_title: str
    
    allowed_domains: List[str]
    usage_quota: Optional[int]
    usage_period: Optional[str]
    current_usage: int
    usage_reset_at: Optional[datetime]
    
    # Stats
    total_sessions: int = 0
    active_sessions: int = 0
    total_messages: int = 0

    class Config:
        from_attributes = True


class WidgetFullResponse(WidgetResponse):
    full_token: str  # Only returned once on creation


class WidgetSessionResponse(BaseModel):
    id: int
    session_id: str
    visitor_id: Optional[str]
    is_active: bool
    created_at: datetime
    last_activity_at: datetime
    message_count: int
    summary: Optional[str]

    class Config:
        from_attributes = True


class WidgetMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    attachments: List[dict]
    created_at: datetime
    response_time_ms: Optional[int]
    ttft_ms: Optional[int]

    class Config:
        from_attributes = True


class WidgetStatsResponse(BaseModel):
    total_requests: int
    successful_requests: int
    failed_requests: int
    error_rate: float
    avg_latency_ms: float
    avg_ttft_ms: Optional[float]
    total_sessions: int
    active_sessions: int
    total_messages: int
    requests_by_day: List[dict]
    error_breakdown: dict


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    visitor_id: Optional[str] = None


class ChatResponse(BaseModel):
    session_id: str
    message: str
    response_time_ms: int
    ttft_ms: Optional[int] = None


# Helper functions
def get_widget_stats(db: Session, widget_id: int) -> dict:
    """Get stats for a widget"""
    total_sessions = db.query(func.count(WidgetSession.id)).filter(
        WidgetSession.widget_id == widget_id
    ).scalar() or 0
    
    active_sessions = db.query(func.count(WidgetSession.id)).filter(
        and_(
            WidgetSession.widget_id == widget_id,
            WidgetSession.is_active == True
        )
    ).scalar() or 0
    
    total_messages = db.query(func.count(WidgetMessage.id)).join(WidgetSession).filter(
        WidgetSession.widget_id == widget_id
    ).scalar() or 0
    
    total_usage = db.query(func.count(WidgetUsageLog.id)).filter(
        WidgetUsageLog.widget_id == widget_id
    ).scalar() or 0
    
    return {
        'total_sessions': total_sessions,
        'active_sessions': active_sessions,
        'total_messages': total_messages,
        'current_usage': total_usage
    }


# Widget CRUD Endpoints
@router.post("/", response_model=WidgetFullResponse, dependencies=[Depends(get_current_user)])
def create_widget(
    widget_data: WidgetCreate,
    token_info: dict = Depends(get_current_user)
):
    """Create a new widget for an assistant"""
    db = SessionLocal()
    try:
        # Verify assistant exists and belongs to user
        assistant = db.query(Assistant).filter(
            and_(
                Assistant.id == widget_data.assistant_id,
                Assistant.owner == token_info.get('sub')
            )
        ).first()
        
        if not assistant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assistant not found or access denied"
            )

        # Generate new widget token
        full_token = Widget.generate_token()
        token_hash = Widget.hash_token(full_token)
        token_prefix = full_token[:12]

        # Calculate usage reset time if quota is set
        usage_reset_at = None
        if widget_data.usage_quota:
            if widget_data.usage_period == 'day':
                usage_reset_at = datetime.utcnow() + timedelta(days=1)
            elif widget_data.usage_period == 'week':
                usage_reset_at = datetime.utcnow() + timedelta(weeks=1)
            elif widget_data.usage_period == 'month':
                usage_reset_at = datetime.utcnow() + timedelta(days=30)

        widget = Widget(
            assistant_id=widget_data.assistant_id,
            owner=token_info.get('sub'),
            name=widget_data.name,
            token_hash=token_hash,
            token_prefix=token_prefix,
            
            position=widget_data.position,
            primary_color=widget_data.primary_color,
            button_size=widget_data.button_size,
            button_icon=widget_data.button_icon,
            custom_icon_url=widget_data.custom_icon_url,
            avatar_url=widget_data.avatar_url,
            
            start_message=widget_data.start_message,
            placeholder_text=widget_data.placeholder_text,
            allow_attachments=widget_data.allow_attachments,
            max_attachment_size_mb=widget_data.max_attachment_size_mb,
            allowed_attachment_types=widget_data.allowed_attachment_types,
            
            enable_persistence=widget_data.enable_persistence,
            persistence_type=widget_data.persistence_type,
            session_timeout_hours=widget_data.session_timeout_hours,
            
            show_branding=widget_data.show_branding,
            custom_css=widget_data.custom_css,
            window_title=widget_data.window_title,
            
            allowed_domains=widget_data.allowed_domains,
            usage_quota=widget_data.usage_quota,
            usage_period=widget_data.usage_period,
            usage_reset_at=usage_reset_at,
            expires_at=widget_data.expires_at
        )

        db.add(widget)
        db.commit()
        db.refresh(widget)

        stats = get_widget_stats(db, widget.id)

        return WidgetFullResponse(
            id=widget.id,
            assistant_id=widget.assistant_id,
            name=widget.name,
            token_prefix=widget.token_prefix,
            masked_token=widget.mask_token(),
            is_active=widget.is_active,
            last_used_at=widget.last_used_at,
            created_at=widget.created_at,
            expires_at=widget.expires_at,
            
            position=widget.position,
            primary_color=widget.primary_color,
            button_size=widget.button_size,
            button_icon=widget.button_icon,
            custom_icon_url=widget.custom_icon_url,
            avatar_url=widget.avatar_url,
            
            start_message=widget.start_message,
            placeholder_text=widget.placeholder_text,
            allow_attachments=widget.allow_attachments,
            max_attachment_size_mb=widget.max_attachment_size_mb,
            allowed_attachment_types=widget.allowed_attachment_types or [],
            
            enable_persistence=widget.enable_persistence,
            persistence_type=widget.persistence_type,
            session_timeout_hours=widget.session_timeout_hours,
            
            show_branding=widget.show_branding,
            custom_css=widget.custom_css,
            window_title=widget.window_title,
            
            allowed_domains=widget.allowed_domains or [],
            usage_quota=widget.usage_quota,
            usage_period=widget.usage_period,
            current_usage=stats['current_usage'],
            usage_reset_at=widget.usage_reset_at,
            
            total_sessions=stats['total_sessions'],
            active_sessions=stats['active_sessions'],
            total_messages=stats['total_messages'],
            
            full_token=full_token
        )

    finally:
        db.close()


@router.get("/", response_model=List[WidgetResponse], dependencies=[Depends(get_current_user)])
def list_widgets(
    assistant_id: Optional[int] = None,
    token_info: dict = Depends(get_current_user)
):
    """List all widgets for the current user"""
    db = SessionLocal()
    try:
        query = db.query(Widget).filter(Widget.owner == token_info.get('sub'))
        
        if assistant_id:
            query = query.filter(Widget.assistant_id == assistant_id)

        widgets = query.order_by(Widget.created_at.desc()).all()

        result = []
        for widget in widgets:
            stats = get_widget_stats(db, widget.id)
            
            result.append(WidgetResponse(
                id=widget.id,
                assistant_id=widget.assistant_id,
                name=widget.name,
                token_prefix=widget.token_prefix,
                masked_token=widget.mask_token(),
                is_active=widget.is_active,
                last_used_at=widget.last_used_at,
                created_at=widget.created_at,
                expires_at=widget.expires_at,
                
                position=widget.position,
                primary_color=widget.primary_color,
                button_size=widget.button_size,
                button_icon=widget.button_icon,
                custom_icon_url=widget.custom_icon_url,
                avatar_url=widget.avatar_url,
                
                start_message=widget.start_message,
                placeholder_text=widget.placeholder_text,
                allow_attachments=widget.allow_attachments,
                max_attachment_size_mb=widget.max_attachment_size_mb,
                allowed_attachment_types=widget.allowed_attachment_types or [],
                
                enable_persistence=widget.enable_persistence,
                persistence_type=widget.persistence_type,
                session_timeout_hours=widget.session_timeout_hours,
                
                show_branding=widget.show_branding,
                custom_css=widget.custom_css,
                window_title=widget.window_title,
                
                allowed_domains=widget.allowed_domains or [],
                usage_quota=widget.usage_quota,
                usage_period=widget.usage_period,
                current_usage=stats['current_usage'],
                usage_reset_at=widget.usage_reset_at,
                
                total_sessions=stats['total_sessions'],
                active_sessions=stats['active_sessions'],
                total_messages=stats['total_messages']
            ))
        
        return result

    finally:
        db.close()


@router.get("/{widget_id}/", response_model=WidgetResponse, dependencies=[Depends(get_current_user)])
def get_widget(
    widget_id: int,
    token_info: dict = Depends(get_current_user)
):
    """Get a specific widget"""
    db = SessionLocal()
    try:
        widget = db.query(Widget).filter(
            and_(
                Widget.id == widget_id,
                Widget.owner == token_info.get('sub')
            )
        ).first()

        if not widget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Widget not found"
            )

        stats = get_widget_stats(db, widget.id)

        return WidgetResponse(
            id=widget.id,
            assistant_id=widget.assistant_id,
            name=widget.name,
            token_prefix=widget.token_prefix,
            masked_token=widget.mask_token(),
            is_active=widget.is_active,
            last_used_at=widget.last_used_at,
            created_at=widget.created_at,
            expires_at=widget.expires_at,
            
            position=widget.position,
            primary_color=widget.primary_color,
            button_size=widget.button_size,
            button_icon=widget.button_icon,
            custom_icon_url=widget.custom_icon_url,
            avatar_url=widget.avatar_url,
            
            start_message=widget.start_message,
            placeholder_text=widget.placeholder_text,
            allow_attachments=widget.allow_attachments,
            max_attachment_size_mb=widget.max_attachment_size_mb,
            allowed_attachment_types=widget.allowed_attachment_types or [],
            
            enable_persistence=widget.enable_persistence,
            persistence_type=widget.persistence_type,
            session_timeout_hours=widget.session_timeout_hours,
            
            show_branding=widget.show_branding,
            custom_css=widget.custom_css,
            window_title=widget.window_title,
            
            allowed_domains=widget.allowed_domains or [],
            usage_quota=widget.usage_quota,
            usage_period=widget.usage_period,
            current_usage=stats['current_usage'],
            usage_reset_at=widget.usage_reset_at,
            
            total_sessions=stats['total_sessions'],
            active_sessions=stats['active_sessions'],
            total_messages=stats['total_messages']
        )

    finally:
        db.close()


@router.put("/{widget_id}/", response_model=WidgetResponse, dependencies=[Depends(get_current_user)])
def update_widget(
    widget_id: int,
    widget_data: WidgetUpdate,
    token_info: dict = Depends(get_current_user)
):
    """Update a widget's configuration"""
    db = SessionLocal()
    try:
        widget = db.query(Widget).filter(
            and_(
                Widget.id == widget_id,
                Widget.owner == token_info.get('sub')
            )
        ).first()

        if not widget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Widget not found"
            )

        # Update fields that are provided
        update_data = widget_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None:
                setattr(widget, field, value)

        db.commit()
        db.refresh(widget)

        stats = get_widget_stats(db, widget.id)

        return WidgetResponse(
            id=widget.id,
            assistant_id=widget.assistant_id,
            name=widget.name,
            token_prefix=widget.token_prefix,
            masked_token=widget.mask_token(),
            is_active=widget.is_active,
            last_used_at=widget.last_used_at,
            created_at=widget.created_at,
            expires_at=widget.expires_at,
            
            position=widget.position,
            primary_color=widget.primary_color,
            button_size=widget.button_size,
            button_icon=widget.button_icon,
            custom_icon_url=widget.custom_icon_url,
            avatar_url=widget.avatar_url,
            
            start_message=widget.start_message,
            placeholder_text=widget.placeholder_text,
            allow_attachments=widget.allow_attachments,
            max_attachment_size_mb=widget.max_attachment_size_mb,
            allowed_attachment_types=widget.allowed_attachment_types or [],
            
            enable_persistence=widget.enable_persistence,
            persistence_type=widget.persistence_type,
            session_timeout_hours=widget.session_timeout_hours,
            
            show_branding=widget.show_branding,
            custom_css=widget.custom_css,
            window_title=widget.window_title,
            
            allowed_domains=widget.allowed_domains or [],
            usage_quota=widget.usage_quota,
            usage_period=widget.usage_period,
            current_usage=stats['current_usage'],
            usage_reset_at=widget.usage_reset_at,
            
            total_sessions=stats['total_sessions'],
            active_sessions=stats['active_sessions'],
            total_messages=stats['total_messages']
        )

    finally:
        db.close()


@router.delete("/{widget_id}/", dependencies=[Depends(get_current_user)])
def delete_widget(
    widget_id: int,
    token_info: dict = Depends(get_current_user)
):
    """Delete a widget"""
    db = SessionLocal()
    try:
        widget = db.query(Widget).filter(
            and_(
                Widget.id == widget_id,
                Widget.owner == token_info.get('sub')
            )
        ).first()

        if not widget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Widget not found"
            )

        db.delete(widget)
        db.commit()

        return {"message": "Widget deleted successfully"}

    finally:
        db.close()


@router.post("/{widget_id}/regenerate-token/", response_model=WidgetFullResponse, dependencies=[Depends(get_current_user)])
def regenerate_widget_token(
    widget_id: int,
    token_info: dict = Depends(get_current_user)
):
    """Regenerate a widget's token"""
    db = SessionLocal()
    try:
        widget = db.query(Widget).filter(
            and_(
                Widget.id == widget_id,
                Widget.owner == token_info.get('sub')
            )
        ).first()

        if not widget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Widget not found"
            )

        # Generate new token
        full_token = Widget.generate_token()
        widget.token_hash = Widget.hash_token(full_token)
        widget.token_prefix = full_token[:12]
        
        db.commit()
        db.refresh(widget)

        stats = get_widget_stats(db, widget.id)

        return WidgetFullResponse(
            id=widget.id,
            assistant_id=widget.assistant_id,
            name=widget.name,
            token_prefix=widget.token_prefix,
            masked_token=widget.mask_token(),
            is_active=widget.is_active,
            last_used_at=widget.last_used_at,
            created_at=widget.created_at,
            expires_at=widget.expires_at,
            
            position=widget.position,
            primary_color=widget.primary_color,
            button_size=widget.button_size,
            button_icon=widget.button_icon,
            custom_icon_url=widget.custom_icon_url,
            avatar_url=widget.avatar_url,
            
            start_message=widget.start_message,
            placeholder_text=widget.placeholder_text,
            allow_attachments=widget.allow_attachments,
            max_attachment_size_mb=widget.max_attachment_size_mb,
            allowed_attachment_types=widget.allowed_attachment_types or [],
            
            enable_persistence=widget.enable_persistence,
            persistence_type=widget.persistence_type,
            session_timeout_hours=widget.session_timeout_hours,
            
            show_branding=widget.show_branding,
            custom_css=widget.custom_css,
            window_title=widget.window_title,
            
            allowed_domains=widget.allowed_domains or [],
            usage_quota=widget.usage_quota,
            usage_period=widget.usage_period,
            current_usage=stats['current_usage'],
            usage_reset_at=widget.usage_reset_at,
            
            total_sessions=stats['total_sessions'],
            active_sessions=stats['active_sessions'],
            total_messages=stats['total_messages'],
            
            full_token=full_token
        )

    finally:
        db.close()


# Session management endpoints
@router.get("/{widget_id}/sessions/", response_model=List[WidgetSessionResponse], dependencies=[Depends(get_current_user)])
def list_widget_sessions(
    widget_id: int,
    active_only: bool = False,
    token_info: dict = Depends(get_current_user)
):
    """List all sessions for a widget"""
    db = SessionLocal()
    try:
        widget = db.query(Widget).filter(
            and_(
                Widget.id == widget_id,
                Widget.owner == token_info.get('sub')
            )
        ).first()

        if not widget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Widget not found"
            )

        query = db.query(WidgetSession).filter(WidgetSession.widget_id == widget_id)
        
        if active_only:
            query = query.filter(WidgetSession.is_active == True)

        sessions = query.order_by(WidgetSession.last_activity_at.desc()).all()

        return [
            WidgetSessionResponse(
                id=session.id,
                session_id=session.session_id,
                visitor_id=session.visitor_id,
                is_active=session.is_active,
                created_at=session.created_at,
                last_activity_at=session.last_activity_at,
                message_count=session.message_count,
                summary=session.summary
            )
            for session in sessions
        ]

    finally:
        db.close()


@router.get("/{widget_id}/sessions/{session_id}/messages/", response_model=List[WidgetMessageResponse], dependencies=[Depends(get_current_user)])
def get_session_messages(
    widget_id: int,
    session_id: str,
    token_info: dict = Depends(get_current_user)
):
    """Get all messages for a session"""
    db = SessionLocal()
    try:
        widget = db.query(Widget).filter(
            and_(
                Widget.id == widget_id,
                Widget.owner == token_info.get('sub')
            )
        ).first()

        if not widget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Widget not found"
            )

        session = db.query(WidgetSession).filter(
            and_(
                WidgetSession.widget_id == widget_id,
                WidgetSession.session_id == session_id
            )
        ).first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

        messages = db.query(WidgetMessage).filter(
            WidgetMessage.session_id == session.id
        ).order_by(WidgetMessage.created_at.asc()).all()

        return [
            WidgetMessageResponse(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                attachments=msg.attachments or [],
                created_at=msg.created_at,
                response_time_ms=msg.response_time_ms,
                ttft_ms=msg.ttft_ms
            )
            for msg in messages
        ]

    finally:
        db.close()


@router.get("/{widget_id}/statistics/", response_model=WidgetStatsResponse, dependencies=[Depends(get_current_user)])
def get_widget_statistics(
    widget_id: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    token_info: dict = Depends(get_current_user)
):
    """Get statistics for a widget"""
    db = SessionLocal()
    try:
        widget = db.query(Widget).filter(
            and_(
                Widget.id == widget_id,
                Widget.owner == token_info.get('sub')
            )
        ).first()

        if not widget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Widget not found"
            )

        # Default to last 30 days
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        # Query usage logs
        query = db.query(WidgetUsageLog).filter(
            and_(
                WidgetUsageLog.widget_id == widget_id,
                WidgetUsageLog.created_at >= start_date,
                WidgetUsageLog.created_at <= end_date
            )
        )

        logs = query.all()
        
        total_requests = len(logs)
        successful = [l for l in logs if 200 <= l.status_code < 400]
        failed = [l for l in logs if l.status_code >= 400]
        
        avg_latency = sum(l.response_time_ms or 0 for l in logs) / total_requests if total_requests > 0 else 0
        ttft_logs = [l for l in logs if l.ttft_ms is not None]
        avg_ttft = sum(l.ttft_ms for l in ttft_logs) / len(ttft_logs) if ttft_logs else None
        
        # Sessions stats
        total_sessions = db.query(func.count(WidgetSession.id)).filter(
            WidgetSession.widget_id == widget_id
        ).scalar() or 0
        
        active_sessions = db.query(func.count(WidgetSession.id)).filter(
            and_(
                WidgetSession.widget_id == widget_id,
                WidgetSession.is_active == True
            )
        ).scalar() or 0
        
        total_messages = db.query(func.count(WidgetMessage.id)).join(WidgetSession).filter(
            WidgetSession.widget_id == widget_id
        ).scalar() or 0
        
        # Requests by day
        requests_by_day = []
        current = start_date
        while current <= end_date:
            next_day = current + timedelta(days=1)
            day_count = len([l for l in logs if current <= l.created_at < next_day])
            requests_by_day.append({
                'date': current.isoformat(),
                'count': day_count
            })
            current = next_day
        
        # Error breakdown
        error_breakdown = {}
        for log in failed:
            error_type = log.error_type or f'http_{log.status_code}'
            error_breakdown[error_type] = error_breakdown.get(error_type, 0) + 1

        return WidgetStatsResponse(
            total_requests=total_requests,
            successful_requests=len(successful),
            failed_requests=len(failed),
            error_rate=len(failed) / total_requests * 100 if total_requests > 0 else 0,
            avg_latency_ms=avg_latency,
            avg_ttft_ms=avg_ttft,
            total_sessions=total_sessions,
            active_sessions=active_sessions,
            total_messages=total_messages,
            requests_by_day=requests_by_day,
            error_breakdown=error_breakdown
        )

    finally:
        db.close()


@router.get("/{widget_id}/embed-code/", dependencies=[Depends(get_current_user)])
def get_embed_code(
    widget_id: int,
    token_info: dict = Depends(get_current_user)
):
    """Get the embeddable JavaScript code for a widget"""
    db = SessionLocal()
    try:
        widget = db.query(Widget).filter(
            and_(
                Widget.id == widget_id,
                Widget.owner == token_info.get('sub')
            )
        ).first()

        if not widget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Widget not found"
            )

        # Generate the embed code - user needs to replace YOUR_WIDGET_TOKEN with their actual token
        embed_code = f'''<!-- FocusML Chat Widget -->
<script>
  (function() {{
    var w = document.createElement('script');
    w.type = 'text/javascript';
    w.async = true;
    w.src = '{settings.FRONTEND_URL}/widget/focusml-chat.js';
    w.setAttribute('data-widget-id', '{widget.id}');
    w.setAttribute('data-token', 'YOUR_WIDGET_TOKEN');
    w.setAttribute('data-api-base', '{settings.API_PUBLIC_URL}');
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(w, s);
  }})();
</script>
<!-- End FocusML Chat Widget -->'''

        return {
            "embed_code": embed_code,
            "widget_id": widget.id,
            "token_prefix": widget.token_prefix,
            "instructions": [
                "1. Copy the code snippet above",
                "2. Replace 'YOUR_WIDGET_TOKEN' with your actual widget token (shown when you created the widget)",
                "3. Paste the code just before the closing </body> tag of your website",
                "4. The chat widget will appear automatically on your website",
                "5. (Optional) Add your domain to the whitelist in widget settings for added security"
            ]
        }

    finally:
        db.close()


# Public widget chat endpoint (no auth required, uses widget token)
@router.post("/chat/{widget_token}/")
async def widget_chat(
    widget_token: str,
    request: Request,
    chat_request: ChatRequest
):
    """Handle chat messages from the widget (public endpoint)"""
    import time as time_module
    
    db = SessionLocal()
    start_time = time_module.time()
    
    try:
        # Find widget by token
        token_hash = Widget.hash_token(widget_token)
        widget = db.query(Widget).filter(Widget.token_hash == token_hash).first()
        
        if not widget:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid widget token"
            )
        
        if not widget.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Widget is inactive"
            )
        
        # Check domain whitelist
        origin = request.headers.get('origin', '')
        if widget.allowed_domains:
            domain_allowed = any(
                domain in origin for domain in widget.allowed_domains
            )
            if not domain_allowed and origin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Domain not whitelisted"
                )
        
        # Get or create session
        session = None
        if chat_request.session_id:
            session = db.query(WidgetSession).filter(
                and_(
                    WidgetSession.widget_id == widget.id,
                    WidgetSession.session_id == chat_request.session_id
                )
            ).first()
        
        if not session:
            session = WidgetSession(
                widget_id=widget.id,
                session_id=chat_request.session_id or str(uuid.uuid4()),
                visitor_id=chat_request.visitor_id,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get('user-agent'),
                referrer_url=request.headers.get('referer')
            )
            db.add(session)
            db.commit()
            db.refresh(session)
        
        # Save user message
        user_message = WidgetMessage(
            session_id=session.id,
            role='user',
            content=chat_request.message
        )
        db.add(user_message)
        
        # Get assistant and call Ollama
        assistant = widget.assistant
        
        # Get conversation history
        history = db.query(WidgetMessage).filter(
            WidgetMessage.session_id == session.id
        ).order_by(WidgetMessage.created_at.asc()).all()
        
        messages = [{"role": msg.role, "content": msg.content} for msg in history]
        messages.append({"role": "user", "content": chat_request.message})
        
        # Add start message as system prompt if first message
        if widget.start_message and len(messages) == 1:
            messages.insert(0, {"role": "system", "content": widget.start_message})
        
        # Call Ollama
        url = f"{settings.OLLAMA_HOST.rstrip('/')}/api/chat"
        payload = {
            "model": assistant.model,
            "messages": messages,
            "stream": False
        }
        
        ttft_ms = None
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            result = response.json()
        
        response_content = result.get("message", {}).get("content", "")
        
        response_time_ms = int((time_module.time() - start_time) * 1000)
        
        # Save assistant message
        assistant_message = WidgetMessage(
            session_id=session.id,
            role='assistant',
            content=response_content,
            response_time_ms=response_time_ms,
            ttft_ms=ttft_ms
        )
        db.add(assistant_message)
        
        # Update session
        session.message_count = (session.message_count or 0) + 2
        session.last_activity_at = datetime.utcnow()
        
        # Update widget last used
        widget.last_used_at = datetime.utcnow()
        
        # Log usage
        usage_log = WidgetUsageLog(
            widget_id=widget.id,
            session_id=session.id,
            endpoint='/chat/',
            method='POST',
            status_code=200,
            response_time_ms=response_time_ms,
            ttft_ms=ttft_ms,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get('user-agent'),
            referrer=request.headers.get('referer')
        )
        db.add(usage_log)
        
        db.commit()
        
        return ChatResponse(
            session_id=session.session_id,
            message=response_content,
            response_time_ms=response_time_ms,
            ttft_ms=ttft_ms
        )
        
    except HTTPException:
        raise
    except Exception as e:
        # Log error
        usage_log = WidgetUsageLog(
            widget_id=widget.id if widget else None,
            endpoint='/chat/',
            method='POST',
            status_code=500,
            response_time_ms=int((time_module.time() - start_time) * 1000),
            error_type='server_error',
            ip_address=request.client.host if request.client else None
        )
        db.add(usage_log)
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    finally:
        db.close()


# Get session history for widget (public, uses widget token)
@router.get("/session/{widget_token}/{session_id}/")
async def get_widget_session(
    widget_token: str,
    session_id: str,
    request: Request
):
    """Get session history for a widget chat"""
    db = SessionLocal()
    try:
        # Find widget by token
        token_hash = Widget.hash_token(widget_token)
        widget = db.query(Widget).filter(Widget.token_hash == token_hash).first()
        
        if not widget:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid widget token"
            )
        
        session = db.query(WidgetSession).filter(
            and_(
                WidgetSession.widget_id == widget.id,
                WidgetSession.session_id == session_id
            )
        ).first()
        
        if not session:
            return {"messages": [], "session_id": session_id}
        
        messages = db.query(WidgetMessage).filter(
            WidgetMessage.session_id == session.id
        ).order_by(WidgetMessage.created_at.asc()).all()
        
        return {
            "session_id": session.session_id,
            "messages": [
                {
                    "role": msg.role,
                    "content": msg.content,
                    "timestamp": msg.created_at.isoformat()
                }
                for msg in messages
            ],
            "start_message": widget.start_message
        }
        
    finally:
        db.close()

