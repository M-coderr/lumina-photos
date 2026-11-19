import os
import secrets
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parents[3] # Project root
DATA_DIR = Path(os.getenv("LUMINA_DATA_DIR", BASE_DIR / "data"))

ORIGINALS_DIR = DATA_DIR / "originals"
THUMBNAILS_DIR = DATA_DIR / "thumbnails"
THUMBNAIL_MICRO_DIR = THUMBNAILS_DIR / "micro"
THUMBNAIL_PREVIEW_DIR = THUMBNAILS_DIR / "preview"
DB_PATH = DATA_DIR / "lumina.db"
CONFIG_FILE = DATA_DIR / "config.json"

# Create directories
for p in [DATA_DIR, ORIGINALS_DIR, THUMBNAILS_DIR, THUMBNAIL_MICRO_DIR, THUMBNAIL_PREVIEW_DIR]:
    p.mkdir(parents=True, exist_ok=True)

# App settings
APP_NAME = "Lumina Photos"
APP_VERSION = "1.0.0"
SERVER_HOST = os.getenv("LUMINA_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("LUMINA_PORT", "8000"))

# Secret key for local tokens
SECRET_KEY_FILE = DATA_DIR / ".secret"
if not SECRET_KEY_FILE.exists():
    SECRET_KEY_FILE.write_text(secrets.token_hex(32), encoding="utf-8")
SECRET_KEY = SECRET_KEY_FILE.read_text(encoding="utf-8").strip()

# Pairing token for mobile app
PAIRING_TOKEN_FILE = DATA_DIR / ".pair_token"
if not PAIRING_TOKEN_FILE.exists():
    PAIRING_TOKEN_FILE.write_text(secrets.token_urlsafe(16), encoding="utf-8")
PAIRING_TOKEN = PAIRING_TOKEN_FILE.read_text(encoding="utf-8").strip()

# License server default endpoint (can be configured)
CENTRAL_LICENSE_URL = os.getenv("LUMINA_LICENSE_URL", "https://api.luminaphotos.internal")
