import io
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any

from server.app.core.database import get_db, row_to_dict

# Global model state
_clip_model = None
_clip_processor = None
_model_lock = threading.Lock()
_model_failed = False

def is_ai_available() -> bool:
    try:
        import torch
        import transformers
        return True
    except ImportError:
        return False

def get_clip():
    """Lazy load CLIP model on CPU with torch.no_grad."""
    global _clip_model, _clip_processor, _model_failed
    if _clip_model is not None:
        return _clip_model, _clip_processor
    if _model_failed:
        return None, None

    with _model_lock:
        if _clip_model is not None:
            return _clip_model, _clip_processor
        try:
            from transformers import CLIPProcessor, CLIPModel
            import torch
            
            model_name = "openai/clip-vit-base-patch32"
            print(f"[AI Search] Loading offline CLIP model '{model_name}' on CPU...")
            _clip_processor = CLIPProcessor.from_pretrained(model_name)
            _clip_model = CLIPModel.from_pretrained(model_name)
            _clip_model.eval()
            print("[AI Search] CLIP model loaded successfully.")
            return _clip_model, _clip_processor
        except Exception as e:
            print(f"[AI Search] Could not load CLIP model: {e}")
            _model_failed = True
            return None, None

class AISearchService:
    @staticmethod
    def embed_image(image_path: Path) -> Optional[bytes]:
        """Generate 512-dim normalized embedding bytes from image file."""
        model, processor = get_clip()
        if not model or not processor:
            return None

        try:
            import torch
            from PIL import Image
            
            with Image.open(image_path) as img:
                rgb_img = img.convert("RGB")
                inputs = processor(images=rgb_img, return_tensors="pt")
                with torch.no_grad():
                    image_features = model.get_image_features(**inputs)
                    # Normalize vector
                    image_features = image_features / image_features.norm(dim=-1, keepdim=True)
                    embedding_np = image_features.cpu().numpy()[0]
                    return embedding_np.tobytes()
        except Exception as e:
            print(f"[AI Search] Error embedding image {image_path}: {e}")
            return None

    @staticmethod
    def embed_text(text: str) -> Optional[Any]:
        """Generate 512-dim normalized embedding array from query text."""
        model, processor = get_clip()
        if not model or not processor:
            return None

        try:
            import torch
            inputs = processor(text=[text], return_tensors="pt", padding=True)
            with torch.no_grad():
                text_features = model.get_text_features(**inputs)
                text_features = text_features / text_features.norm(dim=-1, keepdim=True)
                return text_features.cpu().numpy()[0]
        except Exception as e:
            print(f"[AI Search] Error embedding query '{text}': {e}")
            return None

    @staticmethod
    def index_photo(photo_id: str, image_path: Path):
        """Index photo embedding into database."""
        emb_bytes = AISearchService.embed_image(image_path)
        if not emb_bytes:
            return False

        now_iso = datetime.now(timezone.utc).isoformat()
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT OR REPLACE INTO photo_embeddings (photo_id, embedding, created_at)
            VALUES (?, ?, ?);
            """, (photo_id, emb_bytes, now_iso))
        return True

    @staticmethod
    def search(query: str, threshold: float = 0.20, limit: int = 50) -> List[str]:
        """
        Semantic Search:
        Computes cosine similarity of query against all stored photo vectors.
        Returns list of matching photo IDs sorted by relevance.
        """
        query_vec = AISearchService.embed_text(query)
        if query_vec is None:
            return []

        try:
            import numpy as np
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT photo_id, embedding FROM photo_embeddings;")
                rows = cursor.fetchall()

            if not rows:
                return []

            matched = []
            for r in rows:
                pid = r["photo_id"]
                emb = np.frombuffer(r["embedding"], dtype=np.float32)
                sim = float(np.dot(query_vec, emb))
                if sim >= threshold:
                    matched.append((pid, sim))

            # Sort by similarity descending
            matched.sort(key=lambda x: x[1], reverse=True)
            return [pid for pid, _ in matched[:limit]]
        except Exception as e:
            print(f"[AI Search] Search execution error: {e}")
            return []

ai_search_service = AISearchService()
