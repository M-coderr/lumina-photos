import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from server.app.core.config import APP_NAME, APP_VERSION, BASE_DIR
from server.app.core.database import init_db
from server.app.services.watcher import watcher_manager, set_ws_broadcaster
from server.app.api.photos import router as photos_router
from server.app.api.upload import router as upload_router
from server.app.api.folders import router as folders_router
from server.app.api.albums import router as albums_router
from server.app.api.system import router as system_router

# Active WebSocket connections
active_connections: Set[WebSocket] = set()

async def ws_broadcaster(event_type: str, data: dict):
    """Broadcast real-time events to all connected clients."""
    if not active_connections:
        return
    message = json.dumps({"event": event_type, "data": data})
    disconnected = set()
    for ws in active_connections:
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.add(ws)
    for ws in disconnected:
        active_connections.discard(ws)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database and file watchers
    init_db()
    set_ws_broadcaster(ws_broadcaster)
    watcher_manager.start()
    print(f"[{APP_NAME}] Server engine initialized.")
    yield
    # Shutdown
    watcher_manager.stop()
    print(f"[{APP_NAME}] Server stopped.")

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    lifespan=lifespan
)

# CORS configuration for local & remote access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(photos_router)
app.include_router(upload_router)
app.include_router(folders_router)
app.include_router(albums_router)
app.include_router(system_router)

# Health endpoint
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": APP_NAME,
        "version": APP_VERSION
    }

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    try:
        while True:
            # Keepalive ping/pong
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.discard(websocket)
    except Exception:
        active_connections.discard(websocket)

# Serve built frontend if available in web/dist
DIST_DIR = BASE_DIR / "web" / "dist"
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't intercept API or WS
        if full_path.startswith("api/") or full_path.startswith("ws"):
            return None
        file_path = DIST_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(DIST_DIR / "index.html")
