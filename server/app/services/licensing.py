import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from server.app.core.database import get_db, row_to_dict

class LicensingService:
    @staticmethod
    def get_license_state() -> Dict[str, Any]:
        """Fetch current license and subscription status."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM license_state WHERE id = 'current';")
            row = cursor.fetchone()
            if not row:
                return {
                    "status": "active",
                    "plan_type": "free_tier",
                    "license_key": None,
                    "expires_at": None,
                    "features": {}
                }
            data = row_to_dict(row)
            try:
                data["features"] = json.loads(data.get("features", "{}"))
            except Exception:
                data["features"] = {}
            return data

    @staticmethod
    def update_license_status(
        status: str,
        plan_type: Optional[str] = None,
        license_key: Optional[str] = None,
        expires_at: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        The Switch: Admin or payment webhook updates the server running status.
        Allowed statuses: 'active', 'trial', 'paused', 'expired'.
        """
        valid_statuses = {"active", "trial", "paused", "expired"}
        if status not in valid_statuses:
            raise ValueError(f"Invalid status '{status}'. Must be one of {valid_statuses}")

        now_iso = datetime.now(timezone.utc).isoformat()
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE license_state
            SET status = :status,
                plan_type = COALESCE(:plan_type, plan_type),
                license_key = COALESCE(:license_key, license_key),
                expires_at = COALESCE(:expires_at, expires_at),
                last_verified_at = :now
            WHERE id = 'current';
            """, {
                "status": status,
                "plan_type": plan_type,
                "license_key": license_key,
                "expires_at": expires_at,
                "now": now_iso
            })

        return LicensingService.get_license_state()

    @staticmethod
    def is_operational() -> bool:
        """Check if server operations and remote uploads are permitted."""
        state = LicensingService.get_license_state()
        return state.get("status") in ("active", "trial")

licensing_service = LicensingService()
