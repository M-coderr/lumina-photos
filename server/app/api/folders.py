import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from server.app.core.database import get_db, row_to_dict
from server.app.services.watcher import watcher_manager

router = APIRouter(prefix="/api/folders", tags=["folders"])

class AddFolderRequest(BaseModel):
    folder_path: str
    name: Optional[str] = None
    auto_backup: bool = True

@router.get("")
def list_watched_folders():
    """List all watched folders on this PC."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM watched_folders ORDER BY created_at DESC;")
        rows = cursor.fetchall()
        return [row_to_dict(r) for r in rows]

@router.post("")
def add_watched_folder(body: AddFolderRequest):
    """Add a directory on the PC to be automatically watched and indexed in real-time."""
    path = Path(body.folder_path).resolve()
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Directory does not exist on PC: {body.folder_path}"
        )
    if not path.is_dir():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path is not a directory: {body.folder_path}"
        )

    folder_id = str(uuid.uuid4())
    name = body.name or path.name or str(path)
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO watched_folders (id, folder_path, name, is_active, auto_backup, photo_count, created_at)
            VALUES (?, ?, ?, 1, ?, 0, ?);
            """, (folder_id, str(path), name, 1 if body.auto_backup else 0, now_iso))

        # Register with watcher service
        watcher_manager.add_folder(folder_id, str(path))

        return {
            "id": folder_id,
            "folder_path": str(path),
            "name": name,
            "is_active": True,
            "auto_backup": body.auto_backup,
            "photo_count": 0,
            "created_at": now_iso
        }
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Folder is already being watched")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{folder_id}/scan")
def trigger_scan(folder_id: str):
    """Trigger a background scan of this watched folder."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM watched_folders WHERE id = ?;", (folder_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Watched folder not found")

        path = Path(row["folder_path"])
        if not path.exists():
            raise HTTPException(status_code=400, detail="Folder path no longer exists on disk")

        watcher_manager.add_folder(folder_id, str(path))
        return {"status": "scanning_started", "folder": row_to_dict(row)}

@router.delete("/{folder_id}")
def remove_watched_folder(folder_id: str):
    """Stop watching a folder (existing indexed photos are preserved)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM watched_folders WHERE id = ?;", (folder_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Watched folder not found")

    watcher_manager.remove_folder(folder_id)
    return {"id": folder_id, "removed": True}
