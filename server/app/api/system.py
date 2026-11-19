from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from server.app.core.config import DATA_DIR, ORIGINALS_DIR
from server.app.core.database import get_db
from server.app.services.licensing import licensing_service
from server.app.services.tunnel_service import tunnel_service

router = APIRouter(prefix="/api/system", tags=["system"])

class UpdateSwitchRequest(BaseModel):
    status: str # 'active', 'trial', 'paused', 'expired'
    plan_type: Optional[str] = None
    license_key: Optional[str] = None

class SetTunnelRequest(BaseModel):
    public_url: Optional[str]
    provider: Optional[str] = "cloudflare"

@router.get("/pair")
def get_pairing_info():
    """
    Returns pairing QR Code base64 image + connection credentials.
    The user points their mobile app at this QR code to connect instantly.
    """
    qr_image = tunnel_service.generate_pairing_qr_base64()
    payload = tunnel_service.generate_pairing_payload()
    return {
        "qr_image": qr_image,
        "credentials": payload
    }

@router.get("/license")
def get_license():
    """Returns current server licensing and subscription status."""
    return licensing_service.get_license_state()

@router.post("/admin/switch")
def update_admin_switch(body: UpdateSwitchRequest):
    """
    The Creator/Admin Remote Switch:
    Control the running/subscription state of the server.
    Can be called by your central billing webhook or directly tested in the UI.
    """
    try:
        updated = licensing_service.update_license_status(
            status=body.status,
            plan_type=body.plan_type,
            license_key=body.license_key
        )
        return {"success": True, "license": updated}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/tunnel")
def get_tunnel_status():
    """Get remote connection tunnel status and active public URL."""
    return tunnel_service.get_status()

@router.post("/tunnel")
def set_tunnel_status(body: SetTunnelRequest):
    """Update or configure remote tunnel URL."""
    tunnel_service.set_tunnel_url(body.public_url, body.provider or "cloudflare")
    return tunnel_service.get_status()

@router.get("/stats")
def get_system_stats():
    """Retrieve system storage and photo statistics."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) as count FROM photos WHERE is_trashed = 0;")
        total_photos = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM photos WHERE is_favorite = 1 AND is_trashed = 0;")
        favorite_photos = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM photos WHERE is_trashed = 1;")
        trashed_photos = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM albums;")
        total_albums = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM watched_folders WHERE is_active = 1;")
        watched_folders = cursor.fetchone()["count"]

        cursor.execute("SELECT COALESCE(SUM(file_size), 0) as total_bytes FROM photos;")
        total_bytes = cursor.fetchone()["total_bytes"]

    # Calculate readable storage size
    mb = total_bytes / (1024 * 1024)
    gb = mb / 1024
    readable_size = f"{gb:.2f} GB" if gb >= 1 else f"{mb:.1f} MB"

    return {
        "total_photos": total_photos,
        "favorite_photos": favorite_photos,
        "trashed_photos": trashed_photos,
        "total_albums": total_albums,
        "watched_folders": watched_folders,
        "storage_bytes": total_bytes,
        "readable_storage": readable_size,
        "license": licensing_service.get_license_state()
    }
