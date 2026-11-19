import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException, status

from server.app.core.config import ORIGINALS_DIR
from server.app.core.database import get_db, row_to_dict
from server.app.services.licensing import licensing_service
from server.app.services.media import (
    SUPPORTED_EXTENSIONS,
    calculate_file_hash,
    process_media_file,
)
from server.app.services.watcher import broadcast_event

router = APIRouter(prefix="/api/upload", tags=["upload"])

@router.post("")
async def upload_files(files: List[UploadFile] = File(...)):
    """
    Upload one or multiple photos/videos from Mobile App or Web UI.
    Enforces license switch, checks deduplication, generates thumbnails, and notifies clients.
    """
    # Check license switch
    if not licensing_service.is_operational():
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Server is paused or subscription has expired. Please renew to resume uploads."
        )

    results = []
    now = datetime.now(timezone.utc)
    target_dir = ORIGINALS_DIR / str(now.year) / f"{now.month:02d}"
    target_dir.mkdir(parents=True, exist_ok=True)

    for upload in files:
        ext = Path(upload.filename).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            results.append({
                "filename": upload.filename,
                "status": "error",
                "detail": f"Unsupported format '{ext}'"
            })
            continue

        # Save to temp location first to compute hash
        temp_id = str(uuid.uuid4())
        safe_name = f"{temp_id}_{upload.filename}"
        final_path = target_dir / safe_name

        try:
            with open(final_path, "wb") as buffer:
                shutil.copyfileobj(upload.file, buffer)

            # Compute SHA-256 for deduplication
            file_hash = calculate_file_hash(final_path)

            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM photos WHERE file_hash = ?;", (file_hash,))
                existing = cursor.fetchone()

                if existing:
                    # Duplicate found! Delete the uploaded copy to save disk space
                    try:
                        final_path.unlink()
                    except Exception:
                        pass
                    results.append({
                        "filename": upload.filename,
                        "status": "duplicate",
                        "photo": row_to_dict(existing)
                    })
                    continue

                # Process media: auto-rotate, EXIF, micro & preview WebP thumbnails
                record = process_media_file(final_path, source_type="upload")

                cursor.execute("""
                INSERT INTO photos (
                    id, filename, original_path, file_hash, file_size, mime_type,
                    width, height, taken_at, created_at, is_favorite, is_trashed,
                    camera_make, camera_model, lens_model, focal_length, iso,
                    aperture, exposure_time, latitude, longitude, altitude,
                    thumbnail_micro, thumbnail_preview, source_type, watched_folder_id
                ) VALUES (
                    :id, :filename, :original_path, :file_hash, :file_size, :mime_type,
                    :width, :height, :taken_at, :created_at, :is_favorite, :is_trashed,
                    :camera_make, :camera_model, :lens_model, :focal_length, :iso,
                    :aperture, :exposure_time, :latitude, :longitude, :altitude,
                    :thumbnail_micro, :thumbnail_preview, :source_type, :watched_folder_id
                );
                """, record)

            broadcast_event("photo_added", record)
            results.append({
                "filename": upload.filename,
                "status": "success",
                "photo": record
            })

        except Exception as e:
            if final_path.exists():
                try:
                    final_path.unlink()
                except Exception:
                    pass
            results.append({
                "filename": upload.filename,
                "status": "error",
                "detail": str(e)
            })

    return {"uploaded_count": len([r for r in results if r["status"] == "success"]), "results": results}
