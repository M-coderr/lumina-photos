import asyncio
import os
import time
from pathlib import Path
from typing import Dict, Set
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from server.app.core.database import get_db
from server.app.services.media import (
    SUPPORTED_EXTENSIONS,
    calculate_file_hash,
    process_media_file,
)

# Global set to avoid processing same file simultaneously
_processing_files: Set[str] = set()

# WebSocket broadcaster hook
_ws_broadcaster = None

def set_ws_broadcaster(broadcaster_func):
    global _ws_broadcaster
    _ws_broadcaster = broadcaster_func

def broadcast_event(event_type: str, data: dict):
    if _ws_broadcaster:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(_ws_broadcaster(event_type, data), loop)
            else:
                asyncio.run(_ws_broadcaster(event_type, data))
        except Exception:
            pass

def index_file(file_path: Path, watched_folder_id: str = None) -> bool:
    """Index an individual file into the database if not already indexed."""
    ext = file_path.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        return False

    abs_str = str(file_path.resolve())
    if abs_str in _processing_files:
        return False
    _processing_files.add(abs_str)

    try:
        # Wait until file is done writing (check size stability)
        prev_size = -1
        stable_count = 0
        for _ in range(8):
            if not file_path.exists():
                return False
            curr_size = file_path.stat().st_size
            if curr_size > 0 and curr_size == prev_size:
                stable_count += 1
                if stable_count >= 2:
                    break
            else:
                stable_count = 0
            prev_size = curr_size
            time.sleep(0.05)

        file_hash = calculate_file_hash(file_path)

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM photos WHERE file_hash = ?;", (file_hash,))
            existing = cursor.fetchone()
            if existing:
                # Already indexed
                return False

            # Process file
            record = process_media_file(
                file_path,
                source_type="watched_folder" if watched_folder_id else "upload",
                watched_folder_id=watched_folder_id
            )

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

            # Update count for watched folder
            if watched_folder_id:
                cursor.execute("""
                UPDATE watched_folders 
                SET photo_count = photo_count + 1, last_scanned_at = :now
                WHERE id = :fid;
                """, {"now": record["created_at"], "fid": watched_folder_id})

        broadcast_event("photo_added", record)
        print(f"Indexed: {file_path.name}")
        return True

    except Exception as e:
        print(f"Error indexing {file_path}: {e}")
        return False
    finally:
        _processing_files.discard(abs_str)


class FolderWatchHandler(FileSystemEventHandler):
    def __init__(self, folder_id: str):
        super().__init__()
        self.folder_id = folder_id

    def on_created(self, event):
        if not event.is_directory:
            index_file(Path(event.src_path), self.folder_id)

    def on_moved(self, event):
        if not event.is_directory:
            index_file(Path(event.dest_path), self.folder_id)

    def on_modified(self, event):
        if not event.is_directory:
            index_file(Path(event.src_path), self.folder_id)


class FolderWatcherManager:
    def __init__(self):
        self.observer = Observer()
        self.watches: Dict[str, Any] = {}
        self.running = False

    def start(self):
        if not self.running:
            self.observer.start()
            self.running = True
            self.sync_all_watched_folders()

    def stop(self):
        if self.running:
            self.observer.stop()
            self.observer.join()
            self.running = False

    def add_folder(self, folder_id: str, folder_path: str):
        path = Path(folder_path)
        if not path.exists() or not path.is_dir():
            raise ValueError(f"Path does not exist or is not a directory: {folder_path}")

        if folder_id in self.watches:
            self.remove_folder(folder_id)

        handler = FolderWatchHandler(folder_id)
        watch = self.observer.schedule(handler, str(path), recursive=True)
        self.watches[folder_id] = watch

        # Initial scan in background
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._scan_folder_async(path, folder_id))
        except RuntimeError:
            import threading
            threading.Thread(target=self._scan_folder_sync, args=(path, folder_id), daemon=True).start()

    def remove_folder(self, folder_id: str):
        if folder_id in self.watches:
            try:
                self.observer.unschedule(self.watches[folder_id])
            except Exception:
                pass
            del self.watches[folder_id]

    async def _scan_folder_async(self, path: Path, folder_id: str):
        """Asynchronously scan folder for existing photos."""
        await asyncio.to_thread(self._scan_folder_sync, path, folder_id)

    def _scan_folder_sync(self, path: Path, folder_id: str):
        print(f"Scanning watched folder: {path}")
        count = 0
        for root, _, files in os.walk(path):
            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in SUPPORTED_EXTENSIONS:
                    file_path = Path(root) / f
                    if index_file(file_path, folder_id):
                        count += 1
        print(f"Finished scanning {path}. Indexed {count} new items.")

    def sync_all_watched_folders(self):
        """Load and start monitoring all active watched folders from database."""
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id, folder_path, is_active FROM watched_folders;")
                folders = cursor.fetchall()

            for f in folders:
                if f["is_active"] and Path(f["folder_path"]).exists():
                    self.add_folder(f["id"], f["folder_path"])
        except Exception as e:
            print(f"Error syncing watched folders: {e}")

watcher_manager = FolderWatcherManager()
