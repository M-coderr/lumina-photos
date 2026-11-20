import sys
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent

def build():
    print("=" * 60)
    print("  Building Lumina Photos Standalone Windows App (.exe)")
    print("=" * 60)

    # 1. Verify frontend dist exists
    dist_dir = ROOT_DIR / "web" / "dist"
    if not dist_dir.exists():
        print("[Build] Compiling React frontend...")
        subprocess.run(["cmd.exe", "/c", "cd web && npm run build"], check=True)

    print("[Build] Frontend verified at:", dist_dir)

    # 2. PyInstaller command
    pyinstaller_exe = ROOT_DIR / ".venv" / "Scripts" / "pyinstaller.exe"
    
    cmd = [
        str(pyinstaller_exe),
        "--noconfirm",
        "--onedir",
        "--windowed", # No console window (pure system tray app)
        "--name=LuminaPhotos",
        f"--add-data={dist_dir};web/dist",
        "--hidden-import=uvicorn.logging",
        "--hidden-import=uvicorn.loops",
        "--hidden-import=uvicorn.loops.auto",
        "--hidden-import=uvicorn.protocols",
        "--hidden-import=uvicorn.protocols.http",
        "--hidden-import=uvicorn.protocols.http.auto",
        "--hidden-import=uvicorn.protocols.websockets",
        "--hidden-import=uvicorn.protocols.websockets.auto",
        "--hidden-import=uvicorn.lifespans",
        "--hidden-import=uvicorn.lifespans.on",
        "--hidden-import=pystray._win32",
        "--hidden-import=PIL._imaging",
        "--hidden-import=watchdog.observers.winapi",
        "desktop_app.py"
    ]

    print("[Build] Running PyInstaller...")
    res = subprocess.run(cmd)
    if res.returncode == 0:
        print("=" * 60)
        print("  Build Succeeded!")
        print(f"  Standalone Application: {ROOT_DIR / 'dist' / 'LuminaPhotos' / 'LuminaPhotos.exe'}")
        print("=" * 60)
    else:
        print("[Build] PyInstaller exited with code:", res.returncode)

if __name__ == "__main__":
    build()
