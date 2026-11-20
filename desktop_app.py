import sys
import os
import threading
import time
import webbrowser
import winreg
from pathlib import Path
from PIL import Image, ImageDraw

import uvicorn
import pystray
from pystray import MenuItem as item, Menu

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT_DIR))

from server.app.core.config import SERVER_HOST, SERVER_PORT, APP_NAME, APP_VERSION
from server.app.services.licensing import licensing_service

REG_RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
APP_REG_NAME = "LuminaPhotos"

def create_tray_image():
    """Generate a clean, high-DPI system tray icon for Lumina Photos."""
    size = (64, 64)
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Outer rounded circle with gradient appearance
    draw.ellipse([4, 4, 60, 60], fill=(37, 99, 235)) # Blue
    draw.ellipse([10, 10, 54, 54], fill=(99, 102, 241)) # Indigo

    # Center sparkle / diamond
    draw.polygon([(32, 16), (40, 32), (32, 48), (24, 32)], fill=(255, 255, 255))
    draw.polygon([(16, 32), (32, 26), (48, 32), (32, 38)], fill=(255, 255, 255))

    return image

def is_autostart_enabled() -> bool:
    """Check if app is registered to auto-start on Windows boot."""
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_RUN_KEY, 0, winreg.KEY_READ) as key:
            winreg.QueryValueEx(key, APP_REG_NAME)
            return True
    except FileNotFoundError:
        return False
    except Exception:
        return False

def toggle_autostart(icon, item_obj):
    """Enable or disable auto-start on Windows boot."""
    currently_enabled = is_autostart_enabled()
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
            if currently_enabled:
                winreg.DeleteValue(key, APP_REG_NAME)
                print("[Desktop] Windows auto-start disabled.")
            else:
                exe_path = sys.executable
                script_path = str(ROOT_DIR / "desktop_app.py")
                cmd = f'"{exe_path}" "{script_path}"'
                winreg.SetValueEx(key, APP_REG_NAME, 0, winreg.REG_SZ, cmd)
                print("[Desktop] Windows auto-start enabled.")
    except Exception as e:
        print(f"[Desktop] Failed to toggle auto-start: {e}")

class LuminaDesktopApp:
    def __init__(self):
        self.server = None
        self.server_thread = None
        self.icon = None
        self.running = True

    def start_server(self):
        """Run the FastAPI backend on a background daemon thread."""
        config = uvicorn.Config(
            "server.app.main:app",
            host=SERVER_HOST,
            port=SERVER_PORT,
            log_level="warning",
            loop="asyncio"
        )
        self.server = uvicorn.Server(config)
        self.server_thread = threading.Thread(target=self.server.run, daemon=True)
        self.server_thread.start()
        print(f"[Desktop] Lumina Photos backend started on http://localhost:{SERVER_PORT}")

    def open_web_app(self, icon=None, item=None):
        webbrowser.open(f"http://localhost:{SERVER_PORT}")

    def open_watched_folders(self, icon=None, item=None):
        webbrowser.open(f"http://localhost:{SERVER_PORT}/#folders")

    def open_mobile_pair(self, icon=None, item=None):
        webbrowser.open(f"http://localhost:{SERVER_PORT}/#pair")

    def get_status_label(self, item=None):
        status = licensing_service.get_license_state().get("status", "active")
        return f"Status: {status.upper()} (Zero-Knowledge)"

    def quit_app(self, icon=None, item=None):
        """Gracefully shut down server and tray icon."""
        print("[Desktop] Shutting down Lumina Photos...")
        self.running = False
        if self.server:
            self.server.should_exit = True
        if self.icon:
            self.icon.stop()
        sys.exit(0)

    def run(self):
        # 1. Start server in background thread
        self.start_server()

        # Wait a moment for server to bind
        time.sleep(1.0)

        # 2. Automatically open web dashboard on launch
        self.open_web_app()

        # 3. Create Tray Menu
        menu = Menu(
            item("Open Lumina Photos", self.open_web_app, default=True),
            item("Pair Mobile App (QR Code)", self.open_mobile_pair),
            item("Manage Watched Folders", self.open_watched_folders),
            Menu.SEPARATOR,
            item(self.get_status_label, lambda icon, item: None, enabled=False),
            item("Start with Windows", toggle_autostart, checked=lambda item: is_autostart_enabled()),
            Menu.SEPARATOR,
            item("Quit Lumina Photos", self.quit_app)
        )

        # 4. Initialize and run system tray icon on main thread
        tray_image = create_tray_image()
        self.icon = pystray.Icon(
            name="LuminaPhotos",
            icon=tray_image,
            title=f"{APP_NAME} v{APP_VERSION} - Running",
            menu=menu
        )

        print("[Desktop] Lumina Photos is running in the Windows System Tray.")
        self.icon.run()

if __name__ == "__main__":
    app = LuminaDesktopApp()
    app.run()
