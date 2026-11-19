import sys
from pathlib import Path
import uvicorn

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from server.app.core.config import SERVER_HOST, SERVER_PORT, APP_NAME, APP_VERSION

if __name__ == "__main__":
    print("=" * 60)
    print(f"  Starting {APP_NAME} v{APP_VERSION}")
    print(f"  Local Access: http://localhost:{SERVER_PORT}")
    print("=" * 60)
    uvicorn.run(
        "server.app.main:app",
        host=SERVER_HOST,
        port=SERVER_PORT,
        reload=False
    )
