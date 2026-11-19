import sqlite3
import json
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from server.app.core.config import DB_PATH

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Photos Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS photos (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            original_path TEXT NOT NULL UNIQUE,
            file_hash TEXT NOT NULL UNIQUE,
            file_size INTEGER NOT NULL,
            mime_type TEXT NOT NULL,
            width INTEGER DEFAULT 0,
            height INTEGER DEFAULT 0,
            taken_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_favorite INTEGER DEFAULT 0,
            is_trashed INTEGER DEFAULT 0,
            trashed_at TEXT,
            camera_make TEXT,
            camera_model TEXT,
            lens_model TEXT,
            focal_length TEXT,
            iso INTEGER,
            aperture TEXT,
            exposure_time TEXT,
            latitude REAL,
            longitude REAL,
            altitude REAL,
            thumbnail_micro TEXT,
            thumbnail_preview TEXT,
            source_type TEXT DEFAULT 'upload',
            watched_folder_id TEXT
        );
        """)
        
        # Indexes for fast timeline queries
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_photos_taken_at ON photos (taken_at DESC);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_photos_is_trashed ON photos (is_trashed);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_photos_is_favorite ON photos (is_favorite);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_photos_file_hash ON photos (file_hash);")

        # Albums Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS albums (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            cover_photo_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (cover_photo_id) REFERENCES photos (id) ON DELETE SET NULL
        );
        """)

        # Album Photos mapping
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS album_photos (
            album_id TEXT NOT NULL,
            photo_id TEXT NOT NULL,
            added_at TEXT NOT NULL,
            PRIMARY KEY (album_id, photo_id),
            FOREIGN KEY (album_id) REFERENCES albums (id) ON DELETE CASCADE,
            FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE CASCADE
        );
        """)

        # Watched Folders Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS watched_folders (
            id TEXT PRIMARY KEY,
            folder_path TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            auto_backup INTEGER DEFAULT 1,
            last_scanned_at TEXT,
            photo_count INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );
        """)

        # License State Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS license_state (
            id TEXT PRIMARY KEY,
            status TEXT DEFAULT 'active',
            plan_type TEXT DEFAULT 'pro_trial',
            license_key TEXT,
            expires_at TEXT,
            last_verified_at TEXT,
            features TEXT DEFAULT '{}'
        );
        """)

        # Tunnel State Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS tunnel_state (
            id TEXT PRIMARY KEY,
            is_active INTEGER DEFAULT 0,
            provider TEXT DEFAULT 'cloudflare',
            public_url TEXT,
            last_connected_at TEXT
        );
        """)

        # Initialize default license state if empty
        cursor.execute("SELECT COUNT(*) as count FROM license_state WHERE id = 'current';")
        if cursor.fetchone()["count"] == 0:
            now_iso = datetime.now(timezone.utc).isoformat()
            default_features = json.dumps({
                "remote_tunnel": True,
                "ai_search": True,
                "unlimited_devices": True,
                "family_sharing": True
            })
            cursor.execute("""
            INSERT INTO license_state (id, status, plan_type, license_key, expires_at, last_verified_at, features)
            VALUES ('current', 'active', 'pro_trial', 'LUMINA-TRIAL-COMMERCIAL', NULL, ?, ?);
            """, (now_iso, default_features))

        # Initialize default tunnel state if empty
        cursor.execute("SELECT COUNT(*) as count FROM tunnel_state WHERE id = 'current';")
        if cursor.fetchone()["count"] == 0:
            cursor.execute("""
            INSERT INTO tunnel_state (id, is_active, provider, public_url, last_connected_at)
            VALUES ('current', 0, 'local', NULL, NULL);
            """)

def row_to_dict(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}
