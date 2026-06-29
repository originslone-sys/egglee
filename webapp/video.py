"""Cliente de geração de vídeo via OpenRouter (Image-to-Video).

Fluxo assíncrono:
  POST /api/v1/videos            -> 202 { id, polling_url, status }
  GET  <polling_url>             -> { status, unsigned_urls, error, ... }
  GET  <unsigned_urls[0]>        -> bytes do MP4

A API key fica só no backend. Os IDs dos modelos são descobertos em runtime
(GET /api/v1/videos/models) pra não depender de valores chumbados.
"""
import os
import requests

API_KEY = os.environ.get("OPENROUTER_API_KEY", "").strip()
BASE = "https://openrouter.ai/api/v1"


def enabled() -> bool:
    return bool(API_KEY)


def _headers() -> dict:
    return {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}


def list_models() -> list:
    """Lista os modelos de vídeo disponíveis (normalizado)."""
    r = requests.get(f"{BASE}/videos/models", headers=_headers(), timeout=30)
    r.raise_for_status()
    data = r.json()
    raw = data.get("data") or data.get("models") or (data if isinstance(data, list) else [])
    out = []
    for m in raw:
        if not isinstance(m, dict):
            continue
        out.append({
            "id": m.get("id") or m.get("slug") or m.get("model"),
            "name": m.get("name") or m.get("id"),
            "durations": m.get("durations") or m.get("supported_durations") or [],
            "resolutions": m.get("resolutions") or m.get("supported_resolutions") or [],
            "aspect_ratios": m.get("aspect_ratios") or m.get("supported_aspect_ratios") or [],
            "frame_types": m.get("frame_types") or m.get("supported_frame_types") or [],
        })
    return [m for m in out if m["id"]]


def create(model, prompt, first_frame_url, duration=None, resolution=None,
           aspect_ratio=None, last_frame_url=None) -> dict:
    """Cria um job de Image-to-Video. Devolve { id, polling_url, status }."""
    frames = [{
        "type": "image_url",
        "image_url": {"url": first_frame_url},
        "frame_type": "first_frame",
    }]
    if last_frame_url:
        frames.append({
            "type": "image_url",
            "image_url": {"url": last_frame_url},
            "frame_type": "last_frame",
        })
    payload = {"model": model, "prompt": prompt or "", "frame_images": frames}
    if duration:
        try:
            payload["duration"] = int(duration)
        except (TypeError, ValueError):
            pass
    if resolution:
        payload["resolution"] = resolution
    if aspect_ratio:
        payload["aspect_ratio"] = aspect_ratio

    r = requests.post(f"{BASE}/videos", headers=_headers(), json=payload, timeout=60)
    if not r.ok:
        try:
            detail = r.json()
        except ValueError:
            detail = r.text[:400]
        raise RuntimeError(f"OpenRouter {r.status_code}: {detail}")
    return r.json()


def poll(polling_url: str) -> dict:
    """Consulta o status do job. polling_url deve ser do domínio openrouter.ai."""
    if not polling_url.startswith("https://openrouter.ai/"):
        raise ValueError("polling_url inválida")
    r = requests.get(polling_url, headers=_headers(), timeout=30)
    r.raise_for_status()
    return r.json()


def download(url: str) -> bytes:
    """Baixa os bytes do MP4 (precisa do header de auth)."""
    if not url.startswith("https://openrouter.ai/"):
        raise ValueError("url de download inválida")
    r = requests.get(url, headers={"Authorization": f"Bearer {API_KEY}"}, timeout=120)
    r.raise_for_status()
    return r.content
