import io
import json
import os
import re
import socket
import base64
import subprocess
import threading
import time
from pathlib import Path
from typing import Dict, Any, Optional
import qrcode
from qrcode.image.pil import PilImage

from server.app.core.config import SERVER_PORT, PAIRING_TOKEN, APP_NAME, BASE_DIR
from server.app.core.database import get_db, row_to_dict

def get_local_ip() -> str:
    """Detect the local machine IP on the Wi-Fi/LAN network."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Does not actually connect, just determines outbound interface
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

class TunnelService:
    def __init__(self):
        self.process: Optional[subprocess.Popen] = None
        self.reader_thread: Optional[threading.Thread] = None
        self.public_url: Optional[str] = None

    def find_cloudflared_bin(self) -> Optional[Path]:
        """Locate cloudflared binary in project bin or system paths."""
        candidates = [
            BASE_DIR / "bin" / "cloudflared.exe",
            Path("C:/Program Files/cloudflared/cloudflared.exe"),
            Path("C:/Program Files (x86)/cloudflared/cloudflared.exe"),
        ]
        for c in candidates:
            if c.exists():
                return c
        return None

    def get_status(self) -> Dict[str, Any]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM tunnel_state WHERE id = 'current';")
            row = cursor.fetchone()
            data = row_to_dict(row) if row else {"is_active": 0, "provider": "local", "public_url": None}

        local_ip = get_local_ip()
        local_url = f"http://{local_ip}:{SERVER_PORT}"
        
        # Effective connection URL (prefers remote public URL if active, otherwise local Wi-Fi URL)
        effective_url = data.get("public_url") if (data.get("is_active") and data.get("public_url")) else local_url

        return {
            "is_active": bool(data.get("is_active")),
            "provider": data.get("provider", "local"),
            "public_url": data.get("public_url"),
            "local_ip": local_ip,
            "local_url": local_url,
            "effective_url": effective_url,
            "has_binary": self.find_cloudflared_bin() is not None,
            "pairing_token": PAIRING_TOKEN
        }

    def set_tunnel_url(self, public_url: Optional[str], provider: str = "cloudflare"):
        is_active = 1 if public_url else 0
        self.public_url = public_url
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE tunnel_state
            SET is_active = :active,
                provider = :provider,
                public_url = :url
            WHERE id = 'current';
            """, {"active": is_active, "provider": provider, "url": public_url})

    def start_tunnel(self) -> Dict[str, Any]:
        """Start Cloudflare Quick Tunnel in background."""
        if self.process and self.process.poll() is None:
            return self.get_status()

        bin_path = self.find_cloudflared_bin()
        if not bin_path:
            raise FileNotFoundError("cloudflared binary not found. Place it in bin/cloudflared.exe")

        cmd = [
            str(bin_path),
            "tunnel",
            "--url", f"http://127.0.0.1:{SERVER_PORT}",
            "--no-autoupdate"
        ]

        print(f"[Tunnel] Spawning Cloudflare Quick Tunnel for port {SERVER_PORT}...")
        self.process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )

        def reader():
            url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
            # Cloudflared outputs connection info on stderr
            for line in self.process.stderr:
                match = url_pattern.search(line)
                if match:
                    found_url = match.group(0)
                    print(f"[Tunnel] Cloudflare Tunnel established: {found_url}")
                    self.set_tunnel_url(found_url, "cloudflare")
                    break

        self.reader_thread = threading.Thread(target=reader, daemon=True)
        self.reader_thread.start()

        # Wait up to 5 seconds for URL discovery
        for _ in range(10):
            status = self.get_status()
            if status.get("public_url"):
                return status
            time.sleep(0.5)

        return self.get_status()

    def stop_tunnel(self) -> Dict[str, Any]:
        """Terminate the active tunnel."""
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=3)
            except Exception:
                try:
                    self.process.kill()
                except Exception:
                    pass
            self.process = None

        self.set_tunnel_url(None, "local")
        print("[Tunnel] Cloudflare Tunnel stopped.")
        return self.get_status()

    def generate_pairing_payload(self) -> Dict[str, Any]:
        status = self.get_status()
        return {
            "app": APP_NAME,
            "local_url": status["local_url"],
            "remote_url": status["public_url"],
            "primary_url": status["effective_url"],
            "token": status["pairing_token"]
        }

    def generate_pairing_qr_base64(self) -> str:
        payload = self.generate_pairing_payload()
        qr_text = json.dumps(payload)
        
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        qr.add_data(qr_text)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#000000", back_color="#ffffff")

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64}"

tunnel_service = TunnelService()
