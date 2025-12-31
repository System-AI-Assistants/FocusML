"""
Middleware for API key authentication and usage tracking
"""
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import time
import ipaddress
import logging

from db.session import SessionLocal
from db.models.api_key import APIKey, APIUsageLog, APIKeyWhitelist

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


async def verify_api_key(request: Request, call_next):
    """Verify API key from Authorization header and track usage"""
    path = request.url.path
    logger.info(f"[API Key Middleware] Checking path: {path}")
    
    # Skip API key check for certain paths (management endpoints use Keycloak)
    # Note: paths are WITHOUT /api prefix since it's handled by root_path
    skip_paths = [
        "/docs",
        "/openapi.json",
        "/redoc",
        "/integrations/",  # Integration management endpoints use Keycloak
        "/users/",
        "/models/",
        "/benchmarks/",
        "/statistics/",
        "/data-collections/",
    ]
    
    # Also skip if path doesn't start with /assistants/ (only assistant endpoints should use API keys)
    if any(path.startswith(p) for p in skip_paths):
        logger.info(f"[API Key Middleware] Skipping (in skip_paths)")
        return await call_next(request)
    
    # Only check for API keys on assistant chat/completion endpoints
    # Management endpoints like /assistants/ (list/create) should use Keycloak
    if not path.startswith("/assistants/"):
        logger.info(f"[API Key Middleware] Skipping (not /assistants/)")
        return await call_next(request)
    
    # Skip API key check for assistant management endpoints (list, create, etc.)
    # Only check for API keys on actual usage endpoints (chat, completions)
    if "/chat" not in path and "/completions" not in path:
        logger.info(f"[API Key Middleware] Skipping (no /chat or /completions in path)")
        return await call_next(request)
    
    logger.info(f"[API Key Middleware] Path matches chat/completions endpoint, checking API key")

    # Check for API key in Authorization header
    auth_header = request.headers.get("Authorization", "")
    
    logger.info(f"[API Key Middleware] Path: {request.url.path}, Has Auth Header: {bool(auth_header)}")
    
    if not auth_header.startswith("Bearer "):
        # No API key provided, continue with normal Keycloak auth
        logger.info("[API Key Middleware] No Bearer token found, passing through")
        return await call_next(request)

    api_key = auth_header.replace("Bearer ", "").strip()
    
    # Debug: Check if this looks like an API key (starts with sk_live_) or a Keycloak JWT
    # JWT tokens are much longer and have a different format
    logger.info(f"[API Key Middleware] Token prefix: {api_key[:20]}...")
    
    if not api_key.startswith("sk_"):
        # This might be a Keycloak token, not an API key - let it pass through
        logger.info("[API Key Middleware] Not an API key (no sk_ prefix), passing through for Keycloak")
        return await call_next(request)
    
    logger.info("[API Key Middleware] Detected API key, validating...")
    
    db = SessionLocal()
    try:
        # Find API key by hashing the provided key
        key_hash = APIKey.hash_key(api_key)
        logger.info(f"[API Key Middleware] Looking for key hash: {key_hash[:20]}...")
        api_key_obj = db.query(APIKey).filter(APIKey.key_hash == key_hash).first()

        if not api_key_obj:
            logger.warning("[API Key Middleware] API key not found in database")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key"
            )
        
        logger.info(f"[API Key Middleware] Found API key: id={api_key_obj.id}, name={api_key_obj.name}")

        # Check if key is active
        if not api_key_obj.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key is inactive"
            )

        # Check if key is expired
        if api_key_obj.expires_at and api_key_obj.expires_at < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key has expired"
            )

        # Check usage quota
        if api_key_obj.usage_quota:
            # Reset usage if period has passed
            if api_key_obj.usage_reset_at and api_key_obj.usage_reset_at < datetime.utcnow():
                api_key_obj.current_usage = 0
                if api_key_obj.usage_period == 'day':
                    api_key_obj.usage_reset_at = datetime.utcnow() + timedelta(days=1)
                elif api_key_obj.usage_period == 'week':
                    api_key_obj.usage_reset_at = datetime.utcnow() + timedelta(weeks=1)
                elif api_key_obj.usage_period == 'month':
                    api_key_obj.usage_reset_at = datetime.utcnow() + timedelta(days=30)
                db.commit()

            if api_key_obj.current_usage >= api_key_obj.usage_quota:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Usage quota exceeded"
                )

        # Check IP/Domain whitelist
        client_ip = request.client.host if request.client else None
        if client_ip:
            # Check if there are any whitelist entries
            whitelist_entries = db.query(APIKeyWhitelist).filter(
                APIKeyWhitelist.api_key_id == api_key_obj.id
            ).all()

            if whitelist_entries:
                # If whitelist exists, IP must be in it
                ip_allowed = False
                for entry in whitelist_entries:
                    if entry.type == 'ip':
                        try:
                            # Check if IP matches (supports CIDR)
                            if '/' in entry.value:
                                network = ipaddress.ip_network(entry.value, strict=False)
                                ip_allowed = ipaddress.ip_address(client_ip) in network
                            else:
                                ip_allowed = entry.value == client_ip
                        except:
                            ip_allowed = entry.value == client_ip
                    elif entry.type == 'domain':
                        # Domain whitelisting would require reverse DNS lookup
                        # For now, we'll skip domain checking or implement it later
                        pass

                    if ip_allowed:
                        break

                if not ip_allowed:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="IP address not whitelisted"
                    )

        # Store API key in request state for use in endpoints
        request.state.api_key = api_key_obj
        request.state.authenticated_via_api_key = True
        logger.info(f"[API Key Middleware] Set request.state.authenticated_via_api_key = True")

        # Track request start time
        start_time = time.time()

        # Process request
        response = await call_next(request)

        # Calculate response time
        response_time_ms = int((time.time() - start_time) * 1000)

        # Extract TTFT from response headers if available
        ttft_ms = None
        if "X-TTFT" in response.headers:
            try:
                ttft_ms = int(response.headers["X-TTFT"])
            except:
                pass

        # Determine error type
        error_type = None
        if response.status_code >= 400:
            if response.status_code == 401:
                error_type = "auth_error"
            elif response.status_code == 429:
                error_type = "rate_limit"
            elif response.status_code >= 500:
                error_type = "server_error"
            else:
                error_type = "client_error"

        # Log usage
        usage_log = APIUsageLog(
            api_key_id=api_key_obj.id,
            assistant_id=api_key_obj.assistant_id,
            endpoint=request.url.path,
            method=request.method,
            status_code=response.status_code,
            response_time_ms=response_time_ms,
            time_to_first_token_ms=ttft_ms,
            error_type=error_type,
            ip_address=client_ip,
            user_agent=request.headers.get("User-Agent", "")
        )

        db.add(usage_log)

        # Update API key usage and last used
        api_key_obj.last_used_at = datetime.utcnow()
        if api_key_obj.usage_quota:
            api_key_obj.current_usage += 1

        db.commit()

        return response

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        # Don't fail the request if logging fails
        return await call_next(request)
    finally:
        db.close()


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Middleware class for API key authentication"""
    
    async def dispatch(self, request: Request, call_next):
        return await verify_api_key(request, call_next)

