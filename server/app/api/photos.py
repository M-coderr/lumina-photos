from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Response, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from server.app.core.config import THUMBNAILS_DIR
from server.app.core.database import get_db, row_to_dict

router = APIRouter(prefix="/api/photos", tags=["photos"])

class PhotoFavoriteToggle(BaseModel):
    is_favorite: bool

class PhotoTrashToggle(BaseModel):
    is_trashed: bool

@router.get("")
def list_photos(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    favorite: Optional[bool] = None,
    trashed: bool = False,
    search: Optional[str] = None,
    month: Optional[str] = None # format "YYYY-MM"
):
    """List photos for the Google Photos timeline, sorted by taken_at DESC."""
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM photos WHERE is_trashed = :trashed"
        params = {"trashed": 1 if trashed else 0, "limit": limit, "offset": offset}

        if favorite is not None:
            query += " AND is_favorite = :favorite"
            params["favorite"] = 1 if favorite else 0

        if month:
            query += " AND strftime('%Y-%m', taken_at) = :month"
            params["month"] = month

        if search:
            query += " AND (filename LIKE :search OR camera_make LIKE :search OR camera_model LIKE :search)"
            params["search"] = f"%{search}%"

        query += " ORDER BY taken_at DESC LIMIT :limit OFFSET :offset;"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        photos = [row_to_dict(r) for r in rows]

        # Get total count
        count_query = "SELECT COUNT(*) as total FROM photos WHERE is_trashed = :trashed"
        if favorite is not None:
            count_query += f" AND is_favorite = {1 if favorite else 0}"
        if month:
            count_query += f" AND strftime('%Y-%m', taken_at) = '{month}'"
        cursor.execute(count_query, {"trashed": 1 if trashed else 0})
        total = cursor.fetchone()["total"]

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "items": photos
        }

@router.get("/timeline/dates")
def get_timeline_dates():
    """Returns list of distinct years and months with photo counts for the scrubber bar."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT 
            strftime('%Y', taken_at) as year,
            strftime('%Y-%m', taken_at) as month,
            COUNT(*) as count
        FROM photos
        WHERE is_trashed = 0
        GROUP BY month
        ORDER BY month DESC;
        """)
        rows = cursor.fetchall()
        return [row_to_dict(r) for r in rows]

@router.get("/{photo_id}")
def get_photo(photo_id: str):
    """Retrieve full photo metadata."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM photos WHERE id = ?;", (photo_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Photo not found")
        return row_to_dict(row)

@router.get("/{photo_id}/file")
def get_original_file(photo_id: str):
    """Stream the original photo or video file."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT original_path, mime_type, filename FROM photos WHERE id = ?;", (photo_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Photo not found")

        path = Path(row["original_path"])
        if not path.exists():
            raise HTTPException(status_code=404, detail="File on disk missing")

        return FileResponse(
            path=str(path),
            media_type=row["mime_type"],
            filename=row["filename"]
        )

@router.get("/{photo_id}/thumbnail/{size}")
def get_thumbnail(photo_id: str, size: str):
    """
    Serve generated WebP thumbnail:
    - size='micro': 240px for grid view
    - size='preview': 1600px for lightbox
    """
    if size not in ("micro", "preview"):
        raise HTTPException(status_code=400, detail="Size must be 'micro' or 'preview'")

    rel_path = f"{size}/{photo_id}.webp"
    full_path = THUMBNAILS_DIR / rel_path

    if not full_path.exists():
        # Fallback to original if thumbnail missing
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT original_path, mime_type FROM photos WHERE id = ?;", (photo_id,))
            row = cursor.fetchone()
            if row and Path(row["original_path"]).exists():
                return FileResponse(row["original_path"], media_type=row["mime_type"])
            raise HTTPException(status_code=404, detail="Thumbnail not found")

    return FileResponse(
        path=str(full_path),
        media_type="image/webp",
        headers={"Cache-Control": "public, max-age=31536000, immutable"}
    )

@router.post("/{photo_id}/favorite")
def toggle_favorite(photo_id: str, body: PhotoFavoriteToggle):
    """Toggle photo favorite state."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE photos SET is_favorite = ? WHERE id = ?;",
            (1 if body.is_favorite else 0, photo_id)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Photo not found")
        return {"id": photo_id, "is_favorite": body.is_favorite}

@router.post("/{photo_id}/trash")
def toggle_trash(photo_id: str, body: PhotoTrashToggle):
    """Move photo to trash or restore it."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE photos SET is_trashed = ? WHERE id = ?;",
            (1 if body.is_trashed else 0, photo_id)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Photo not found")
        return {"id": photo_id, "is_trashed": body.is_trashed}

@router.delete("/{photo_id}")
def delete_permanently(photo_id: str):
    """Permanently delete photo and its thumbnails from disk and database."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT original_path, thumbnail_micro, thumbnail_preview, source_type FROM photos WHERE id = ?;", (photo_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Photo not found")

        # Delete database record
        cursor.execute("DELETE FROM photos WHERE id = ?;", (photo_id,))

        # Delete thumbnails
        for t in [row["thumbnail_micro"], row["thumbnail_preview"]]:
            if t:
                thumb_path = THUMBNAILS_DIR / t
                if thumb_path.exists():
                    try:
                        thumb_path.unlink()
                    except Exception:
                        pass

        # If it was uploaded directly to app managed storage, delete original file
        if row["source_type"] == "upload":
            orig = Path(row["original_path"])
            if orig.exists():
                try:
                    orig.unlink()
                except Exception:
                    pass

        return {"id": photo_id, "deleted": True}
