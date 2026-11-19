import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server.app.core.database import get_db, row_to_dict

router = APIRouter(prefix="/api/albums", tags=["albums"])

class CreateAlbumRequest(BaseModel):
    title: str
    description: Optional[str] = ""

class AddPhotosToAlbumRequest(BaseModel):
    photo_ids: List[str]

@router.get("")
def list_albums():
    """List all user albums with photo counts and cover photo thumbnail."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT 
            a.id, a.title, a.description, a.cover_photo_id, a.created_at, a.updated_at,
            COUNT(ap.photo_id) as photo_count,
            p.thumbnail_preview as cover_thumbnail
        FROM albums a
        LEFT JOIN album_photos ap ON a.id = ap.album_id
        LEFT JOIN photos p ON a.cover_photo_id = p.id
        GROUP BY a.id
        ORDER BY a.updated_at DESC;
        """)
        rows = cursor.fetchall()
        return [row_to_dict(r) for r in rows]

@router.post("")
def create_album(body: CreateAlbumRequest):
    """Create a new album."""
    album_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO albums (id, title, description, cover_photo_id, created_at, updated_at)
        VALUES (?, ?, ?, NULL, ?, ?);
        """, (album_id, body.title, body.description, now_iso, now_iso))

    return {
        "id": album_id,
        "title": body.title,
        "description": body.description,
        "photo_count": 0,
        "cover_thumbnail": None,
        "created_at": now_iso,
        "updated_at": now_iso
    }

@router.get("/{album_id}")
def get_album(album_id: str):
    """Get album metadata and list of photos."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM albums WHERE id = ?;", (album_id,))
        album_row = cursor.fetchone()
        if not album_row:
            raise HTTPException(status_code=404, detail="Album not found")

        cursor.execute("""
        SELECT p.*, ap.added_at
        FROM photos p
        JOIN album_photos ap ON p.id = ap.photo_id
        WHERE ap.album_id = ? AND p.is_trashed = 0
        ORDER BY ap.added_at DESC;
        """, (album_id,))
        photo_rows = cursor.fetchall()

        album = row_to_dict(album_row)
        album["photos"] = [row_to_dict(p) for p in photo_rows]
        return album

@router.post("/{album_id}/photos")
def add_photos_to_album(album_id: str, body: AddPhotosToAlbumRequest):
    """Add one or more photos to an album."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, cover_photo_id FROM albums WHERE id = ?;", (album_id,))
        album = cursor.fetchone()
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")

        first_photo_id = None
        for pid in body.photo_ids:
            cursor.execute("""
            INSERT OR IGNORE INTO album_photos (album_id, photo_id, added_at)
            VALUES (?, ?, ?);
            """, (album_id, pid, now_iso))
            if not first_photo_id:
                first_photo_id = pid

        # Set cover photo if missing
        if not album["cover_photo_id"] and first_photo_id:
            cursor.execute("UPDATE albums SET cover_photo_id = ?, updated_at = ? WHERE id = ?;", (first_photo_id, now_iso, album_id))
        else:
            cursor.execute("UPDATE albums SET updated_at = ? WHERE id = ?;", (now_iso, album_id))

        return {"album_id": album_id, "added_count": len(body.photo_ids)}

@router.delete("/{album_id}")
def delete_album(album_id: str):
    """Delete an album (photos inside are not deleted from your library)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM albums WHERE id = ?;", (album_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Album not found")
        return {"id": album_id, "deleted": True}
