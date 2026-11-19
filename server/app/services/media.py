import hashlib
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
from PIL import Image, ImageOps, ExifTags
import mimetypes

from server.app.core.config import (
    ORIGINALS_DIR,
    THUMBNAILS_DIR,
    THUMBNAIL_MICRO_DIR,
    THUMBNAIL_PREVIEW_DIR,
)

SUPPORTED_IMAGE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif", ".gif"
}

SUPPORTED_VIDEO_EXTENSIONS = {
    ".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"
}

SUPPORTED_EXTENSIONS = SUPPORTED_IMAGE_EXTENSIONS | SUPPORTED_VIDEO_EXTENSIONS

def calculate_file_hash(file_path: Path, chunk_size: int = 65536) -> str:
    """Compute SHA-256 hash for deduplication."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(chunk_size):
            sha256.update(chunk)
    return sha256.hexdigest()

def _convert_gps_to_degrees(value) -> Optional[float]:
    """Convert GPS coordinates from degrees, minutes, seconds to decimal."""
    try:
        d = float(value[0])
        m = float(value[1])
        s = float(value[2])
        return d + (m / 60.0) + (s / 3600.0)
    except Exception:
        return None

def extract_exif(img: Image.Image) -> Dict[str, Any]:
    """Extract standard EXIF metadata from Pillow Image."""
    meta = {
        "taken_at": None,
        "camera_make": None,
        "camera_model": None,
        "lens_model": None,
        "focal_length": None,
        "iso": None,
        "aperture": None,
        "exposure_time": None,
        "latitude": None,
        "longitude": None,
        "altitude": None,
    }
    
    try:
        exif_raw = img.getexif()
        if not exif_raw:
            return meta

        named_exif = {}
        for tag_id, val in exif_raw.items():
            tag_name = ExifTags.TAGS.get(tag_id, tag_id)
            named_exif[tag_name] = val

        # Camera info
        if "Make" in named_exif:
            meta["camera_make"] = str(named_exif["Make"]).strip().strip('\x00')
        if "Model" in named_exif:
            meta["camera_model"] = str(named_exif["Model"]).strip().strip('\x00')

        # Date taken
        date_str = named_exif.get("DateTimeOriginal") or named_exif.get("DateTime")
        if date_str:
            try:
                # Standard format is "YYYY:MM:DD HH:MM:SS"
                dt = datetime.strptime(str(date_str).strip(), "%Y:%m:%d %H:%M:%S")
                meta["taken_at"] = dt.replace(tzinfo=timezone.utc).isoformat()
            except Exception:
                pass

        # Detailed Exif IFD
        if hasattr(ExifTags, 'IFD') and ExifTags.IFD.Exif in exif_raw:
            try:
                exif_ifd = exif_raw.get_ifd(ExifTags.IFD.Exif)
                for tag_id, val in exif_ifd.items():
                    tag_name = ExifTags.TAGS.get(tag_id, tag_id)
                    if tag_name == "ISOSpeedRatings" or tag_name == "PhotographicSensitivity":
                        try:
                            meta["iso"] = int(val)
                        except Exception:
                            pass
                    elif tag_name == "FNumber":
                        try:
                            meta["aperture"] = f"f/{float(val):.1f}"
                        except Exception:
                            pass
                    elif tag_name == "ExposureTime":
                        try:
                            exp = float(val)
                            meta["exposure_time"] = f"1/{round(1/exp)}" if exp < 1 and exp > 0 else f"{exp}s"
                        except Exception:
                            pass
                    elif tag_name == "FocalLength":
                        try:
                            meta["focal_length"] = f"{float(val):.0f}mm"
                        except Exception:
                            pass
                    elif tag_name == "LensModel":
                        meta["lens_model"] = str(val).strip().strip('\x00')
                    elif tag_name == "DateTimeOriginal" and not meta["taken_at"]:
                        try:
                            dt = datetime.strptime(str(val).strip(), "%Y:%m:%d %H:%M:%S")
                            meta["taken_at"] = dt.replace(tzinfo=timezone.utc).isoformat()
                        except Exception:
                            pass
            except Exception:
                pass

        # GPS IFD
        if hasattr(ExifTags, 'IFD') and ExifTags.IFD.GPSInfo in exif_raw:
            try:
                gps_ifd = exif_raw.get_ifd(ExifTags.IFD.GPSInfo)
                gps_tags = {}
                for t, v in gps_ifd.items():
                    name = ExifTags.GPSTAGS.get(t, t)
                    gps_tags[name] = v

                lat = gps_tags.get("GPSLatitude")
                lat_ref = gps_tags.get("GPSLatitudeRef", "N")
                lon = gps_tags.get("GPSLongitude")
                lon_ref = gps_tags.get("GPSLongitudeRef", "E")

                if lat and lon:
                    lat_deg = _convert_gps_to_degrees(lat)
                    lon_deg = _convert_gps_to_degrees(lon)
                    if lat_deg is not None and lon_deg is not None:
                        if lat_ref == "S":
                            lat_deg = -lat_deg
                        if lon_ref == "W":
                            lon_deg = -lon_deg
                        meta["latitude"] = lat_deg
                        meta["longitude"] = lon_deg

                alt = gps_tags.get("GPSAltitude")
                if alt:
                    try:
                        meta["altitude"] = float(alt)
                    except Exception:
                        pass
            except Exception:
                pass

    except Exception:
        pass

    return meta

def process_media_file(
    file_path: Path,
    source_type: str = "upload",
    watched_folder_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Process an image or video file:
    - Auto-rotates image by EXIF orientation
    - Extracts dimensions & EXIF metadata
    - Generates 240px micro WebP thumbnail
    - Generates 1600px preview WebP thumbnail
    - Computes hash for deduplication
    """
    ext = file_path.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file format: {ext}")

    file_size = file_path.stat().st_size
    file_hash = calculate_file_hash(file_path)
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if not mime_type:
        mime_type = "image/jpeg" if ext in SUPPORTED_IMAGE_EXTENSIONS else "video/mp4"

    photo_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Fallback taken_at to file modification time
    file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime, tz=timezone.utc).isoformat()

    width = 0
    height = 0
    exif_data = {
        "taken_at": None,
        "camera_make": None,
        "camera_model": None,
        "lens_model": None,
        "focal_length": None,
        "iso": None,
        "aperture": None,
        "exposure_time": None,
        "latitude": None,
        "longitude": None,
        "altitude": None,
    }

    micro_rel_path = f"micro/{photo_id}.webp"
    preview_rel_path = f"preview/{photo_id}.webp"
    micro_full_path = THUMBNAILS_DIR / micro_rel_path
    preview_full_path = THUMBNAILS_DIR / preview_rel_path

    if ext in SUPPORTED_IMAGE_EXTENSIONS:
        try:
            with Image.open(file_path) as img:
                # Correct orientation first
                oriented_img = ImageOps.exif_transpose(img)
                if oriented_img is None:
                    oriented_img = img

                width, height = oriented_img.size
                exif_data = extract_exif(img)

                # Ensure RGB for WebP conversion
                if oriented_img.mode in ("RGBA", "LA", "P"):
                    rgb_img = oriented_img.convert("RGBA")
                else:
                    rgb_img = oriented_img.convert("RGB")

                # Generate 240px micro thumbnail
                micro_img = rgb_img.copy()
                micro_img.thumbnail((240, 240), Image.Resampling.LANCZOS)
                micro_img.save(micro_full_path, "WEBP", quality=75, method=4)

                # Generate 1600px preview thumbnail
                preview_img = rgb_img.copy()
                preview_img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
                preview_img.save(preview_full_path, "WEBP", quality=85, method=4)

        except Exception as e:
            # Fallback for images that fail Pillow decoding
            print(f"Warning: Failed to process image {file_path}: {e}")
            width, height = 800, 600
            # create blank placeholder thumbnail
            blank = Image.new("RGB", (240, 240), (40, 40, 40))
            blank.save(micro_full_path, "WEBP", quality=50)
            blank.save(preview_full_path, "WEBP", quality=50)
    else:
        # Video file (placeholder poster thumbnail if ffmpeg not in path)
        width, height = 1920, 1080
        # Placeholder video thumbnail
        poster = Image.new("RGB", (320, 180), (30, 35, 45))
        poster.save(micro_full_path, "WEBP", quality=70)
        poster.save(preview_full_path, "WEBP", quality=70)

    taken_at = exif_data["taken_at"] or file_mtime

    return {
        "id": photo_id,
        "filename": file_path.name,
        "original_path": str(file_path.resolve()),
        "file_hash": file_hash,
        "file_size": file_size,
        "mime_type": mime_type,
        "width": width,
        "height": height,
        "taken_at": taken_at,
        "created_at": now_iso,
        "is_favorite": 0,
        "is_trashed": 0,
        "camera_make": exif_data["camera_make"],
        "camera_model": exif_data["camera_model"],
        "lens_model": exif_data["lens_model"],
        "focal_length": exif_data["focal_length"],
        "iso": exif_data["iso"],
        "aperture": exif_data["aperture"],
        "exposure_time": exif_data["exposure_time"],
        "latitude": exif_data["latitude"],
        "longitude": exif_data["longitude"],
        "altitude": exif_data["altitude"],
        "thumbnail_micro": micro_rel_path,
        "thumbnail_preview": preview_rel_path,
        "source_type": source_type,
        "watched_folder_id": watched_folder_id
    }
