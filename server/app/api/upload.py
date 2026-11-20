import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status

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
async def upload_files(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    filename: Optional[str] = Form(None),
):
    """
    Upload one or multiple photos/videos from Mobile App or Web UI.
    Enforces license switch, checks deduplication, generates thumbnails, and notifies clients.
    Accepts field names 'files' or 'file', handles missing extensions via MIME or magic bytes.
    """
    # Check license switch
    if not licensing_service.is_operational():
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Server is paused or subscription has expired. Please renew to resume uploads."
        )

    upload_list = []
    if files:
        upload_list.extend(files)
    if file:
        upload_list.append(file)
    if not upload_list:
        raise HTTPException(status_code=400, detail="No files provided for upload.")

    results = []
    now = datetime.now(timezone.utc)
    target_dir = ORIGINALS_DIR / str(now.year) / f"{now.month:02d}"
    target_dir.mkdir(parents=True, exist_ok=True)

    for upload in upload_list:
        orig_name = filename or upload.filename or "upload.jpg"
        ext = Path(orig_name).suffix.lower()

        # Handle missing or unrecognized extension from mobile content URIs
        if ext not in SUPPORTED_EXTENSIONS:
            content_type = (upload.content_type or "").lower()
            if "jpeg" in content_type or "jpg" in content_type:
                ext = ".jpg"
            elif "png" in content_type:
                ext = ".png"
            elif "webp" in content_type:
                ext = ".webp"
            elif "heic" in content_type:
                ext = ".heic"
            elif "mp4" in content_type:
                ext = ".mp4"
            elif "mov" in content_type or "quicktime" in content_type:
                ext = ".mov"
            else:
                ext = ".jpg"  # default fallback for camera uploads

            if not orig_name.endswith(ext):
                orig_name = f"{orig_name}{ext}"

        # Save to temp location first to compute hash
        temp_id = str(uuid.uuid4())
        safe_name = f"{temp_id}_{orig_name}"
        final_path = target_dir / safe_name

        try:
            with open(final_path, "wb") as buffer:
                shutil.copyfileobj(upload.file, buffer)

            # Auto-detect real format from magic bytes if needed
            try:
                with open(final_path, "rb") as check_f:
                    magic = check_f.read(16)
                if magic.startswith(b"\xff\xd8\xff") and not final_path.suffix.lower() in [".jpg", ".jpeg"]:
                    new_path = final_path.with_suffix(".jpg")
                    final_path.rename(new_path)
                    final_path = new_path
                elif magic.startswith(b"\x89PNG") and final_path.suffix.lower() != ".png":
                    new_path = final_path.with_suffix(".png")
                    final_path.rename(new_path)
                    final_path = new_path
            except Exception:
                pass

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
                        "filename": orig_name,
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
                "filename": orig_name,
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
                "filename": orig_name,
                "status": "error",
                "detail": str(e)
            })

    return {"uploaded_count": len([r for r in results if r["status"] == "success"]), "results": results}
