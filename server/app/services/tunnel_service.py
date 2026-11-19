import io
import json
import socket
import base64
from typing import Dict, Any, Optional
import qrcode
from qrcode.image.pil import PilImage

from server.app.core.config import SERVER_PORT, PAIRING_TOKEN, APP_NAME
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
    @staticmethod
    def get_status() -> Dict[str, Any]:
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
            "pairing_token": PAIRING_TOKEN
        }

    @staticmethod
    def set_tunnel_url(public_url: Optional[str], provider: str = "cloudflare"):
        is_active = 1 if public_url else 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE tunnel_state
            SET is_active = :active,
                provider = :provider,
                public_url = :url
            WHERE id = 'current';
            """, {"active": is_active, "provider": provider, "url": public_url})

    @staticmethod
    def generate_pairing_payload() -> Dict[str, Any]:
        status = TunnelService.get_status()
        return {
            "app": APP_NAME,
            "local_url": status["local_url"],
            "remote_url": status["public_url"],
            "primary_url": status["effective_url"],
            "token": status["pairing_token"]
        }

    @staticmethod
    def generate_pairing_qr_base64() -> str:
        payload = TunnelService.generate_pairing_payload()
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
