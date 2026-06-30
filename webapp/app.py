"""
Painel de geração + biblioteca de mídia (Fase 1).

Variáveis de ambiente (Railway):
  RUNPOD_ENDPOINT_ID, RUNPOD_API_KEY   — endpoint serverless
  APP_PASSWORD                         — senha do painel (login)
  SECRET_KEY                           — chave de sessão (qualquer string longa)
  R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET — armazenamento R2
  DATABASE_URL                         — Postgres (Railway preenche sozinho)
  DEEPSEEK_API_KEY                     — legendas (opcional)
  OPENROUTER_API_KEY                   — geração de vídeo I2V (opcional)
"""
import os
import io
import json
import time
import base64
import uuid
import random
from functools import wraps

import requests
from flask import (Flask, request, jsonify, render_template,
                   session, redirect, url_for, Response)

import storage
import db
import video
import persona

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "egglee-dev-secret-change-me")

ENDPOINT_ID = os.environ.get("RUNPOD_ENDPOINT_ID", "").strip()
API_KEY = os.environ.get("RUNPOD_API_KEY", "").strip()
APP_PASSWORD = os.environ.get("APP_PASSWORD", "").strip()
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()

BASE_URL = f"https://api.runpod.ai/v2/{ENDPOINT_ID}"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

# Bias de movimento para a geração de vídeo via API (trava de "movimento natural").
NATURAL_MOTION = ("subtle natural movement, gentle realistic motion, "
                  "stable camera, smooth, lifelike")

# LoRA stack (Power Lora Loader). O da personagem é sempre ativo (identidade).
CHARACTER_LORA = "egglee_character.safetensors"
DEFAULT_STACK_LORAS = ["skin_detail_xl.safetensors", "detail_tweaker_xl.safetensors",
                       "mobile_photography.safetensors", "hand_fix_xl.safetensors"]
STACK_DEFAULT_WEIGHTS = {
    CHARACTER_LORA: 0.8, "skin_detail_xl.safetensors": 0.4,
    "detail_tweaker_xl.safetensors": 0.3, "mobile_photography.safetensors": 0.4,
    "hand_fix_xl.safetensors": 0.5,
}


def _lora_stackable(name):
    nl = name.lower()
    if name == CHARACTER_LORA:
        return False
    return not any(x in nl for x in ("ip-adapter", "ipadapter", "sd15", "_v1", "-0000"))

try:
    db.init()
except Exception as e:
    print("DB init falhou:", e, flush=True)

try:
    from PIL import Image, ImageDraw, ImageFont
    _PIL_OK = True
except Exception:
    _PIL_OK = False


def _watermark_config():
    try:
        raw = db.get_setting("watermark")
        return json.loads(raw) if raw else {}
    except Exception:
        return {}


def apply_watermark(img_bytes: bytes, cfg: dict) -> bytes:
    text = (cfg.get("text") or "").strip()
    if not (_PIL_OK and text):
        return img_bytes
    try:
        img = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
        W, H = img.size
        size = max(12, int(W * float(cfg.get("size", 4)) / 100))
        try:
            font = ImageFont.load_default(size=size)
        except TypeError:
            font = ImageFont.load_default()
        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(overlay)
        bb = d.textbbox((0, 0), text, font=font)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        m = int(W * 0.025)
        pos = cfg.get("position", "br")
        x = m if "l" in pos else W - tw - m
        y = m if "t" in pos else H - th - m
        alpha = int(255 * float(cfg.get("opacity", 35)) / 100)
        d.text((x + 1, y + 1), text, font=font, fill=(0, 0, 0, int(alpha * 0.6)))
        d.text((x, y), text, font=font, fill=(255, 255, 255, alpha))
        out = Image.alpha_composite(img, overlay).convert("RGB")
        buf = io.BytesIO()
        out.save(buf, format="PNG")
        return buf.getvalue()
    except Exception as e:
        print("WATERMARK ERROR:", e, flush=True)
        return img_bytes


# ── Auth ──────────────────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def wrap(*a, **k):
        if APP_PASSWORD and not session.get("authed"):
            if request.path.startswith("/api/"):
                return jsonify({"error": "unauthorized"}), 401
            return redirect(url_for("login"))
        return f(*a, **k)
    return wrap


@app.route("/login", methods=["GET", "POST"])
def login():
    if not APP_PASSWORD:
        return redirect(url_for("index"))
    if request.method == "POST":
        if request.form.get("password", "") == APP_PASSWORD:
            session["authed"] = True
            return redirect(url_for("index"))
        return render_template("login.html", error="Senha incorreta")
    return render_template("login.html", error=None)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ── RunPod ────────────────────────────────────────────────────────────────────

def _build_input(body: dict) -> dict:
    inputs = {}
    if body.get("prompt"):
        inputs["positive_prompt"] = body["prompt"]
    if body.get("negative_prompt"):
        inputs["negative_prompt"] = body["negative_prompt"]

    seed = str(body.get("seed", "-1"))
    inputs["seed"] = int(seed) if seed.lstrip("-").isdigit() else -1

    try:
        inputs["batch_size"] = max(1, min(8, int(body.get("batch_size", 1))))
    except (TypeError, ValueError):
        inputs["batch_size"] = 1

    if body.get("steps"):
        try:
            inputs["steps"] = max(10, min(60, int(body["steps"])))
        except (TypeError, ValueError):
            pass

    if body.get("checkpoint"):
        inputs["checkpoint"] = body["checkpoint"]
    if body.get("face_image_b64"):
        inputs["face_image_b64"] = body["face_image_b64"]
    if body.get("input_image_b64"):
        inputs["input_image_b64"] = body["input_image_b64"]

    # Vídeo self-host (Wan): traduz resolução/proporção/duração em dimensões.
    if "video" in body["workflow_name"]:
        _DIMS = {
            "480p": {"9:16": (480, 832), "16:9": (832, 480), "1:1": (640, 640)},
            "720p": {"9:16": (720, 1280), "16:9": (1280, 720), "1:1": (960, 960)},
        }
        res = body.get("resolution", "480p")
        ar = body.get("aspect_ratio", "9:16")
        w, h = _DIMS.get(res, _DIMS["480p"]).get(ar, (480, 832))
        try:
            dur = int(float(body.get("duration", 5)))
        except (TypeError, ValueError):
            dur = 5
        video_segments = max(1, min(3, dur // 5))   # 5s=1, 10s=2, 15s=3
        inputs["width"] = w
        inputs["height"] = h
        inputs["length"] = 81                 # 5s por trecho (frames 4n+1)
        inputs["frame_rate"] = 16
        inputs["steps"] = 20
        inputs["split_step"] = 10

    payload = {"workflow_name": body["workflow_name"], "inputs": inputs}
    if body.get("character"):
        payload["character"] = body["character"]
    if body.get("no_grain"):
        payload["no_grain"] = True
    if body.get("loras"):
        payload["loras"] = body["loras"]
    if "video" in body["workflow_name"]:
        payload["timeout"] = 1200
        payload["segments"] = video_segments
    return payload


@app.route("/")
@login_required
def index():
    return render_template("dashboard.html")


@app.route("/generate")
@login_required
def generate_page():
    return render_template("index.html")


@app.route("/persona")
@login_required
def persona_admin_page():
    return render_template("persona_admin.html")


@app.route("/modelos")
@login_required
def models_page():
    return render_template("models.html")


@app.route("/library")
@login_required
def library_page():
    return render_template("library.html")


@app.route("/api/config")
@login_required
def config():
    return jsonify({
        "configured": bool(ENDPOINT_ID and API_KEY),
        "library": db.enabled() and storage.enabled(),
        "has_db": db.enabled(),
        "has_r2": storage.enabled(),
        "r2_missing": [k for k in ("R2_ENDPOINT", "R2_ACCESS_KEY", "R2_SECRET_KEY", "R2_BUCKET")
                       if not os.environ.get(k, "").strip()],
        "has_video": video.enabled(),
    })


@app.route("/api/generate", methods=["POST"])
@login_required
def generate():
    if not (ENDPOINT_ID and API_KEY):
        return jsonify({"error": "Configure RUNPOD_ENDPOINT_ID e RUNPOD_API_KEY no Railway."}), 500

    body = request.get_json(force=True)
    if not body.get("workflow_name"):
        return jsonify({"error": "workflow_name é obrigatório"}), 400

    try:
        r = requests.post(f"{BASE_URL}/run", headers=HEADERS,
                          json={"input": _build_input(body)}, timeout=30)
    except requests.RequestException as e:
        return jsonify({"error": f"Falha de rede ao chamar o RunPod: {e}"}), 502

    if not r.ok:
        try:
            detail = json.dumps(r.json())[:400]
        except ValueError:
            detail = (r.text or "")[:400]
        msg = f"RunPod respondeu {r.status_code}: {detail}"
        print("GENERATE ERROR:", msg, flush=True)
        return jsonify({"error": msg}), 502
    try:
        return jsonify(r.json()), 200
    except ValueError:
        return jsonify({"error": f"Resposta não-JSON do RunPod ({r.status_code}): {r.text[:300]}"}), 502


@app.route("/api/status/<job_id>")
@login_required
def status(job_id):
    try:
        r = requests.get(f"{BASE_URL}/status/{job_id}", headers=HEADERS, timeout=30)
        return jsonify(r.json()), (200 if r.ok else 502)
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502


# ── Vídeo (OpenRouter Image-to-Video) ──────────────────────────────────────────

def _image_data_url(media_id=None, image_b64=None):
    """Devolve uma data URL (base64) da imagem de origem pro frame_images."""
    if image_b64:
        b64 = image_b64.split(",", 1)[-1]  # aceita data URL ou b64 puro
        return f"data:image/png;base64,{b64}"
    row = db.get(media_id)
    if not row:
        raise ValueError("imagem não encontrada na biblioteca")
    raw = storage.get_bytes(row["r2_key"])
    ext = "jpeg" if row["r2_key"].lower().endswith((".jpg", ".jpeg")) else "png"
    return "data:image/%s;base64,%s" % (ext, base64.b64encode(raw).decode())


@app.route("/api/video/models")
@login_required
def video_models():
    if not video.enabled():
        return jsonify({"models": [], "configured": False})
    try:
        return jsonify({"models": video.list_models(), "configured": True})
    except Exception as e:
        print("VIDEO MODELS ERROR:", e, flush=True)
        return jsonify({"models": [], "configured": True, "error": str(e)})


@app.route("/api/video/generate", methods=["POST"])
@login_required
def video_generate():
    if not video.enabled():
        return jsonify({"error": "Configure OPENROUTER_API_KEY no Railway."}), 500
    b = request.get_json(force=True)
    model = (b.get("model") or "").strip()
    if not model:
        return jsonify({"error": "Escolha um modelo de vídeo."}), 400
    try:
        first_url = _image_data_url(media_id=b.get("media_id"), image_b64=b.get("image_b64"))
    except Exception as e:
        return jsonify({"error": f"Imagem de origem inválida: {e}"}), 400
    # Trava de movimento natural: bias sutil/realista somado ao prompt do usuário.
    motion = b.get("prompt", "").strip()
    full_prompt = NATURAL_MOTION if not motion else f"{NATURAL_MOTION}, {motion}"
    try:
        job = video.create(
            model=model,
            prompt=full_prompt,
            first_frame_url=first_url,
            duration=b.get("duration"),
            resolution=b.get("resolution"),
            aspect_ratio=b.get("aspect_ratio"),
            generate_audio=bool(b.get("audio", False)),  # trava: sem áudio (mais barato)
        )
    except Exception as e:
        print("VIDEO GENERATE ERROR:", e, flush=True)
        return jsonify({"error": str(e)}), 502
    return jsonify({
        "id": job.get("id"),
        "polling_url": job.get("polling_url"),
        "status": job.get("status", "pending"),
    })


@app.route("/api/video/status", methods=["POST"])
@login_required
def video_status():
    b = request.get_json(force=True)
    polling_url = (b.get("polling_url") or "").strip()
    if not polling_url:
        return jsonify({"error": "polling_url ausente"}), 400
    try:
        data = video.poll(polling_url)
    except Exception as e:
        return jsonify({"error": str(e)}), 502

    st = (data.get("status") or "").lower()
    if st != "completed":
        return jsonify({"status": st or "pending", "error": data.get("error")})

    # Completo: baixa o MP4, sobe no R2 e salva na biblioteca (uma vez).
    urls = data.get("unsigned_urls") or []
    if not urls:
        return jsonify({"status": "failed", "error": "sem URL de vídeo na resposta"})
    try:
        mp4 = video.download(urls[0])
        key = f"video/{uuid.uuid4().hex}.mp4"
        storage.upload_bytes(key, mp4, "video/mp4")
        make_and_store_thumb(key, mp4, is_video=True)
        folder = (b.get("folder") or "Geral").strip() or "Geral"
        row = db.insert(key, type="video", prompt=b.get("prompt", ""),
                        workflow="video", folder=folder, size=len(mp4))
        return jsonify({"status": "completed", "media_id": row["id"]})
    except Exception as e:
        print("VIDEO SAVE ERROR:", e, flush=True)
        return jsonify({"status": "failed", "error": f"erro ao salvar vídeo: {e}"})


# ── Biblioteca ────────────────────────────────────────────────────────────────

@app.route("/api/library/save", methods=["POST"])
@login_required
def library_save():
    if not (db.enabled() and storage.enabled()):
        return jsonify({"ok": False, "reason": "storage não configurado"})
    body = request.get_json(force=True)
    data_b64 = body.get("data")
    if not data_b64:
        return jsonify({"ok": False, "reason": "sem data"}), 400

    mtype = body.get("type", "image")
    ext = "mp4" if mtype == "video" else "png"
    key = f"{mtype}/{uuid.uuid4().hex}.{ext}"
    ctype = "video/mp4" if mtype == "video" else "image/png"
    try:
        raw = base64.b64decode(data_b64)
        storage.upload_bytes(key, raw, ctype)
        make_and_store_thumb(key, raw, is_video=(mtype == "video"))
        seed = body.get("seed")
        seed = int(seed) if isinstance(seed, (int, str)) and str(seed).lstrip("-").isdigit() else None
        folder = (body.get("folder") or "Geral").strip() or "Geral"
        row = db.insert(key, type=mtype, prompt=body.get("prompt", ""),
                        seed=seed, workflow=body.get("workflow", ""), folder=folder, size=len(raw))
        return jsonify({"ok": True, "id": row["id"]})
    except Exception as e:
        print("LIBRARY SAVE ERROR:", e, flush=True)
        return jsonify({"ok": False, "reason": str(e)}), 500


@app.route("/api/library")
@login_required
def library_list():
    if not (db.enabled() and storage.enabled()):
        return jsonify({"items": [], "folders": [], "configured": False})
    try:
        rows = db.list_media(
            limit=int(request.args.get("limit", 400)),
            folder=request.args.get("folder") or None,
            favorite=request.args.get("favorite") == "1",
            q=request.args.get("q") or None,
            type=request.args.get("type") or None,
        )
        folders = db.list_folders()
    except Exception as e:
        print("LIBRARY LIST ERROR:", e, flush=True)
        return jsonify({"items": [], "folders": [], "configured": True, "error": str(e)})
    items = []
    for r in rows:
        items.append({
            "id": r["id"],
            "type": r["type"],
            "prompt": r["prompt"],
            "workflow": r["workflow"],
            "folder": r.get("folder"),
            "favorite": r.get("favorite"),
            "tags": r.get("tags") or "",
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "url": storage.presigned_url(r["r2_key"]),
        })
    folders = [{"folder": f["folder"], "n": f["n"]} for f in folders]
    return jsonify({"items": items, "folders": folders, "configured": True})


@app.route("/api/presets", methods=["GET"])
@login_required
def presets_list():
    if not db.enabled():
        return jsonify({"presets": []})
    try:
        return jsonify({"presets": db.list_presets()})
    except Exception as e:
        print("PRESETS LIST ERROR:", e, flush=True)
        return jsonify({"presets": []})


@app.route("/api/presets", methods=["POST"])
@login_required
def presets_create():
    if not db.enabled():
        return jsonify({"ok": False, "reason": "banco não configurado"}), 500
    b = request.get_json(force=True)
    name = (b.get("name") or "").strip()
    prompt = (b.get("prompt") or "").strip()
    if not name or not prompt:
        return jsonify({"ok": False, "reason": "nome e prompt obrigatórios"}), 400
    row = db.create_preset(name, prompt)
    return jsonify({"ok": True, "id": row["id"]})


@app.route("/api/presets/<int:preset_id>", methods=["DELETE"])
@login_required
def presets_delete(preset_id):
    if db.enabled():
        db.delete_preset(preset_id)
    return jsonify({"ok": True})


@app.route("/api/folders", methods=["POST"])
@login_required
def folder_create():
    name = (request.get_json(force=True).get("name") or "").strip()
    if not name:
        return jsonify({"ok": False, "reason": "nome vazio"}), 400
    db.create_folder(name)
    return jsonify({"ok": True})


@app.route("/api/folders/rename", methods=["POST"])
@login_required
def folder_rename():
    b = request.get_json(force=True)
    old, new = (b.get("old") or "").strip(), (b.get("new") or "").strip()
    if not old or not new or old == "Geral":
        return jsonify({"ok": False, "reason": "inválido"}), 400
    db.rename_folder(old, new)
    return jsonify({"ok": True})


@app.route("/api/folders/delete", methods=["POST"])
@login_required
def folder_delete():
    name = (request.get_json(force=True).get("name") or "").strip()
    if not name or name == "Geral":
        return jsonify({"ok": False, "reason": "inválido"}), 400
    db.delete_folder(name)
    return jsonify({"ok": True})


@app.route("/api/stats")
@login_required
def stats():
    if not db.enabled():
        return jsonify({})
    try:
        return jsonify(db.stats())
    except Exception as e:
        print("STATS ERROR:", e, flush=True)
        return jsonify({})


@app.route("/api/caption", methods=["POST"])
@login_required
def caption():
    if not DEEPSEEK_API_KEY:
        return jsonify({"error": "DEEPSEEK_API_KEY não configurada no Railway."}), 500
    b = request.get_json(force=True)
    context = (b.get("context") or b.get("prompt") or "").strip()
    if not context:
        context = "a casual selfie of a young woman"

    lang = (b.get("lang") or "").lower()
    if lang not in ("pt", "en"):
        lang = random.choice(["pt", "en"])
    language = "Brazilian Portuguese" if lang == "pt" else "English"

    sys_msg = (
        "You are a Gen Z girl writing your own Instagram captions. "
        "Voice: short and punchy (1 to 2 short lines max), bold, flirty, confident, "
        "playful, with a tasteful hint of sensuality — Instagram-appropriate, never "
        "explicit. Use natural Gen Z slang and 1-3 well-placed emojis. Then, on a new "
        "line, add 12 to 16 hashtags optimized for reach and Instagram SEO: mix a few "
        "high-volume popular tags with specific niche/keyword tags relevant to the photo "
        "(model, selfie, ootd, the setting, the vibe). Avoid banned, spammy or "
        "shadowban-prone tags."
    )
    user_msg = (
        f"Write ONE Instagram caption in {language} for a photo described as: "
        f"\"{context}\". Keep it short, bold and flirty. Reply with only the caption "
        f"and then the hashtags on a new line."
    )
    try:
        r = requests.post(
            "https://api.deepseek.com/chat/completions",
            headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                     "Content-Type": "application/json"},
            json={"model": "deepseek-chat",
                  "messages": [{"role": "system", "content": sys_msg},
                               {"role": "user", "content": user_msg}],
                  "temperature": 1.3, "max_tokens": 400},
            timeout=60,
        )
        if not r.ok:
            return jsonify({"error": f"DeepSeek {r.status_code}: {r.text[:200]}"}), 502
        text = r.json()["choices"][0]["message"]["content"].strip()
        return jsonify({"caption": text})
    except requests.RequestException as e:
        return jsonify({"error": f"Falha ao chamar o DeepSeek: {e}"}), 502


THUMB_W = 480  # largura das miniaturas


def _thumb_key(r2_key: str) -> str:
    return "thumbs/" + r2_key.rsplit("/", 1)[-1].rsplit(".", 1)[0] + ".jpg"


def _jpeg_from_pil(img) -> bytes:
    img = img.convert("RGB")
    w, h = img.size
    if w > THUMB_W:
        img = img.resize((THUMB_W, int(h * THUMB_W / w)), Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=78, optimize=True)
    return out.getvalue()


def _make_thumb(raw: bytes) -> bytes:
    return _jpeg_from_pil(Image.open(io.BytesIO(raw)))


def _video_poster(mp4_bytes: bytes) -> bytes:
    """Extrai o 1º frame de um MP4 como miniatura JPEG (poster)."""
    import tempfile
    import imageio.v2 as iio
    with tempfile.NamedTemporaryFile(suffix=".mp4") as tf:
        tf.write(mp4_bytes)
        tf.flush()
        rd = iio.get_reader(tf.name, "ffmpeg")
        try:
            frame = rd.get_data(0)
        finally:
            rd.close()
    return _jpeg_from_pil(Image.fromarray(frame))


def make_and_store_thumb(r2_key: str, raw: bytes, is_video: bool):
    """Gera o poster/miniatura e sobe no R2 (chamado ao salvar)."""
    if not _PIL_OK:
        return
    try:
        thumb = _video_poster(raw) if is_video else _make_thumb(raw)
        storage.upload_bytes(_thumb_key(r2_key), thumb, "image/jpeg")
    except Exception as e:
        print("THUMB GEN ERROR:", e, flush=True)


def _ensure_thumb(r2_key: str, is_video: bool = False) -> bytes:
    """Gera (se preciso) e cacheia a miniatura JPEG no R2; devolve os bytes."""
    tkey = _thumb_key(r2_key)
    try:
        return storage.get_bytes(tkey)
    except Exception:
        pass
    raw = storage.get_bytes(r2_key)
    thumb = _video_poster(raw) if is_video else _make_thumb(raw)
    try:
        storage.upload_bytes(tkey, thumb, "image/jpeg")
    except Exception as e:
        print("THUMB UPLOAD ERROR:", e, flush=True)
    return thumb


@app.route("/api/thumb/<int:media_id>")
@login_required
def thumb_proxy(media_id):
    """Miniatura JPEG leve para a grade (gerada e cacheada no R2)."""
    row = db.get(media_id)
    if not row:
        return ("not found", 404)
    if not _PIL_OK:
        return redirect(url_for("media_proxy", media_id=media_id))
    try:
        data = _ensure_thumb(row["r2_key"], is_video=(row["type"] == "video"))
    except Exception as e:
        print("THUMB PROXY ERROR:", e, flush=True)
        return redirect(url_for("media_proxy", media_id=media_id))
    resp = Response(data, mimetype="image/jpeg")
    resp.headers["Cache-Control"] = "public, max-age=604800, immutable"
    return resp


@app.route("/api/media/<int:media_id>")
@login_required
def media_proxy(media_id):
    """Serve a mídia via backend (evita CORS no fetch direto ao R2)."""
    row = db.get(media_id)
    if not row:
        return ("not found", 404)
    try:
        data = storage.get_bytes(row["r2_key"])
    except Exception as e:
        print("MEDIA PROXY ERROR:", e, flush=True)
        return ("erro ao buscar mídia", 502)
    if request.args.get("watermark") == "1" and row["type"] != "video":
        data = apply_watermark(data, _watermark_config())
    ctype = "video/mp4" if row["type"] == "video" else "image/png"
    return Response(data, mimetype=ctype)


@app.route("/api/settings/watermark", methods=["GET", "POST"])
@login_required
def settings_watermark():
    if request.method == "POST":
        if not db.enabled():
            return jsonify({"ok": False, "reason": "banco não configurado"}), 500
        cfg = request.get_json(force=True)
        db.set_setting("watermark", json.dumps({
            "text": (cfg.get("text") or "").strip(),
            "position": cfg.get("position", "br"),
            "opacity": cfg.get("opacity", 35),
            "size": cfg.get("size", 4),
        }))
        return jsonify({"ok": True})
    return jsonify(_watermark_config())


@app.route("/api/library/favorite", methods=["POST"])
@login_required
def library_favorite():
    b = request.get_json(force=True)
    db.set_favorite(b["id"], b.get("value", True))
    return jsonify({"ok": True})


@app.route("/api/library/move", methods=["POST"])
@login_required
def library_move():
    b = request.get_json(force=True)
    folder = (b.get("folder") or "Geral").strip() or "Geral"
    db.set_folder(b.get("ids", []), folder)
    return jsonify({"ok": True})


@app.route("/api/library/tags", methods=["POST"])
@login_required
def library_tags():
    b = request.get_json(force=True)
    db.set_tags(b["id"], (b.get("tags") or "").strip())
    return jsonify({"ok": True})


@app.route("/api/library/delete", methods=["POST"])
@login_required
def library_delete_many():
    ids = request.get_json(force=True).get("ids", [])
    if not ids:
        return jsonify({"ok": False, "reason": "sem ids"}), 400
    try:
        for key in db.keys_for(ids):
            try:
                storage.delete_key(key)
                storage.delete_key(_thumb_key(key))
            except Exception as e:
                print("DELETE R2 ERROR:", e, flush=True)
        db.delete_many(ids)
    except Exception as e:
        print("BULK DELETE ERROR:", e, flush=True)
        return jsonify({"ok": False, "reason": str(e)}), 500
    return jsonify({"ok": True})


@app.route("/api/library/<int:media_id>", methods=["DELETE"])
@login_required
def library_delete(media_id):
    row = db.get(media_id)
    if not row:
        return jsonify({"ok": False}), 404
    try:
        storage.delete_key(row["r2_key"])
        storage.delete_key(_thumb_key(row["r2_key"]))
    except Exception as e:
        print("LIBRARY DELETE R2 ERROR:", e, flush=True)
    db.delete(media_id)
    return jsonify({"ok": True})


# ── Persona / Front público ─────────────────────────────────────────────────

@app.route("/chat")
def chat_page():
    return render_template("chat.html")


@app.route("/chat/galeria")
def chat_gallery_page():
    return render_template("gallery.html")


@app.route("/api/chat/persona")
def chat_persona():
    """Dados públicos da persona pra montar a página /chat (sem login)."""
    p = persona.get_persona()
    pg = persona.get_page()
    gal = persona.get_gallery()
    avatar = f"/api/pub/media/{p['avatar_id']}?t=1" if p.get("avatar_id") else None
    gallery = [{"id": i, "thumb": f"/api/pub/media/{i}?t=1", "full": f"/api/pub/media/{i}"} for i in gal]
    return jsonify({
        "name": p.get("name"), "status": p.get("status"), "bio": p.get("bio"),
        "greeting": p.get("greeting"), "avatar": avatar,
        "banner": pg.get("banner"), "ads": pg.get("ads"), "disclaimer": pg.get("disclaimer"),
        "gallery": gallery,
    })


@app.route("/api/chat", methods=["POST"])
def public_chat():
    """Chat público com a persona (efêmero; limite + cooldown por sessão)."""
    now = time.time()
    rl = session.get("rl") or {"n": 0, "win": now, "last": 0}
    if now - rl.get("win", now) > 3600:
        rl = {"n": 0, "win": now, "last": 0}
    if now - rl.get("last", 0) < 1.0:
        return jsonify({"bubbles": ["calma 😅 deixa eu respirar"], "throttled": True})
    if rl.get("n", 0) >= 60:
        return jsonify({"bubbles": ["acho melhor a gente continuar isso mais tarde 💕"], "limited": True})

    b = request.get_json(force=True)
    msg = (b.get("message") or "").strip()
    if not msg:
        return jsonify({"bubbles": []})
    rl["n"] = rl.get("n", 0) + 1
    rl["last"] = now
    session["rl"] = rl
    try:
        bubbles = persona.chat_reply(b.get("history") or [], msg)
    except Exception as e:
        print("CHAT ERROR:", e, flush=True)
        bubbles = ["opa, me perdi aqui 🙈 tenta de novo?"]
    return jsonify({"bubbles": bubbles})


@app.route("/api/pub/media/<int:media_id>")
def pub_media(media_id):
    """Serve só as imagens liberadas (avatar + galeria da persona) — sem login."""
    allowed = set(persona.get_gallery())
    av = persona.get_persona().get("avatar_id")
    if av:
        allowed.add(av)
    if media_id not in allowed:
        return ("forbidden", 403)
    row = db.get(media_id)
    if not row:
        return ("not found", 404)
    try:
        if request.args.get("t") == "1" and _PIL_OK:
            data = _ensure_thumb(row["r2_key"], is_video=(row["type"] == "video"))
            ctype = "image/jpeg"
        else:
            data = storage.get_bytes(row["r2_key"])
            ctype = "video/mp4" if row["type"] == "video" else "image/png"
    except Exception as e:
        print("PUB MEDIA ERROR:", e, flush=True)
        return ("erro", 502)
    resp = Response(data, mimetype=ctype)
    resp.headers["Cache-Control"] = "public, max-age=3600"
    return resp


# ── Admin: configuração da persona / página ─────────────────────────────────

@app.route("/api/admin/persona", methods=["GET"])
@login_required
def admin_persona_get():
    return jsonify({"persona": persona.get_persona(),
                    "page": persona.get_page(),
                    "gallery": persona.get_gallery()})


@app.route("/api/admin/persona", methods=["POST"])
@login_required
def admin_persona_save():
    if not db.enabled():
        return jsonify({"ok": False, "reason": "banco não configurado"}), 500
    persona.save_persona(request.get_json(force=True))
    return jsonify({"ok": True})


@app.route("/api/admin/page", methods=["POST"])
@login_required
def admin_page_save():
    if not db.enabled():
        return jsonify({"ok": False, "reason": "banco não configurado"}), 500
    persona.save_page(request.get_json(force=True))
    return jsonify({"ok": True})


@app.route("/api/admin/prompt_preview")
@login_required
def admin_prompt_preview():
    """Prompt automático montado pelos campos (sem os limites fixos), pra editar."""
    return jsonify({"prompt": persona.build_auto_prompt(persona.get_persona())})


@app.route("/api/admin/reality_phrases", methods=["POST"])
@login_required
def admin_reality_phrases():
    if not DEEPSEEK_API_KEY:
        return jsonify({"error": "DEEPSEEK_API_KEY não configurada."}), 500
    current = request.get_json(force=True).get("current") or []
    try:
        return jsonify({"phrases": persona.generate_reality_phrases(current, n=4)})
    except Exception as e:
        print("REALITY PHRASES ERROR:", e, flush=True)
        return jsonify({"error": str(e)}), 502


@app.route("/api/models/run", methods=["POST"])
@login_required
def models_run():
    """Encaminha uma ação de modelo (list/download/delete) pro worker."""
    if not (ENDPOINT_ID and API_KEY):
        return jsonify({"error": "RunPod não configurado."}), 500
    body = request.get_json(force=True)
    # Injeta o token do Civitai salvo, se a URL for do Civitai e não tiver token.
    if body.get("action") == "download_model":
        url = body.get("url") or ""
        if "civitai" in url.lower() and "token=" not in url and db.enabled():
            tok = (db.get_setting("civitai_token") or "").strip()
            if tok:
                body["url"] = url + ("&" if "?" in url else "?") + "token=" + tok
    try:
        r = requests.post(f"{BASE_URL}/run", headers=HEADERS, json={"input": body}, timeout=30)
        return jsonify(r.json()), (200 if r.ok else 502)
    except requests.RequestException as e:
        return jsonify({"error": f"Falha ao chamar o RunPod: {e}"}), 502


@app.route("/api/settings/civitai_token", methods=["GET", "POST"])
@login_required
def civitai_token():
    if request.method == "POST":
        if not db.enabled():
            return jsonify({"ok": False, "reason": "banco não configurado"}), 500
        db.set_setting("civitai_token", (request.get_json(force=True).get("token") or "").strip())
        return jsonify({"ok": True})
    tok = (db.get_setting("civitai_token") if db.enabled() else "") or ""
    return jsonify({"token": tok})


@app.route("/api/checkpoints/active", methods=["POST"])
@login_required
def checkpoints_set_active():
    name = (request.get_json(force=True).get("name") or "").strip()
    if db.enabled() and name:
        db.set_setting("active_checkpoint", name)
    return jsonify({"ok": True})


@app.route("/api/loras", methods=["GET"])
@login_required
def loras_list():
    """LoRAs SDXL empilháveis (do cache) + config salva (on/peso)."""
    try:
        raw = db.get_setting("loras_cache")
        names = json.loads(raw) if raw else []
    except Exception:
        names = []
    avail = [n for n in names if _lora_stackable(n)] or list(DEFAULT_STACK_LORAS)
    try:
        cfg = json.loads(db.get_setting("lora_config") or "{}")
    except Exception:
        cfg = {}
    return jsonify({"character": CHARACTER_LORA, "loras": avail,
                    "config": cfg, "defaults": STACK_DEFAULT_WEIGHTS})


@app.route("/api/loras", methods=["POST"])
@login_required
def loras_save():
    if db.enabled():
        db.set_setting("lora_config", json.dumps(request.get_json(force=True).get("config") or {}))
    return jsonify({"ok": True})


@app.route("/api/loras/cache", methods=["POST"])
@login_required
def loras_cache():
    names = request.get_json(force=True).get("loras") or []
    if db.enabled():
        try:
            db.set_setting("loras_cache", json.dumps(names))
        except Exception as e:
            print("LORA CACHE ERROR:", e, flush=True)
    return jsonify({"ok": True})


@app.route("/api/checkpoints", methods=["GET"])
@login_required
def checkpoints_list():
    """Lista de checkpoints (cache do último 'listar' — popula o dropdown sem worker)."""
    default = ["sdxl_checkpoint.safetensors", "realvisxl.safetensors"]
    try:
        raw = db.get_setting("checkpoints_cache")
        names = json.loads(raw) if raw else default
    except Exception:
        names = default
    names = names or default
    active = (db.get_setting("active_checkpoint") if db.enabled() else "") or ""
    if active not in names:
        active = names[0]
    return jsonify({"checkpoints": names, "active": active})


@app.route("/api/checkpoints/cache", methods=["POST"])
@login_required
def checkpoints_cache():
    names = request.get_json(force=True).get("checkpoints") or []
    if db.enabled():
        try:
            db.set_setting("checkpoints_cache", json.dumps(names))
        except Exception as e:
            print("CKPT CACHE ERROR:", e, flush=True)
    return jsonify({"ok": True})


@app.route("/api/admin/gallery", methods=["POST"])
@login_required
def admin_gallery_save():
    if not db.enabled():
        return jsonify({"ok": False, "reason": "banco não configurado"}), 500
    ids = request.get_json(force=True).get("ids", [])
    persona.save_gallery([int(i) for i in ids])
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
