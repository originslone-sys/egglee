"""
Painel de geração + biblioteca de mídia (Fase 1).

Variáveis de ambiente (Railway):
  RUNPOD_ENDPOINT_ID, RUNPOD_API_KEY   — endpoint serverless
  APP_PASSWORD                         — senha do painel (login)
  SECRET_KEY                           — chave de sessão (qualquer string longa)
  R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET — armazenamento R2
  DATABASE_URL                         — Postgres (Railway preenche sozinho)
"""
import os
import io
import json
import base64
import uuid
import random
from functools import wraps

import requests
from flask import (Flask, request, jsonify, render_template,
                   session, redirect, url_for, Response)

import storage
import db

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "egglee-dev-secret-change-me")

ENDPOINT_ID = os.environ.get("RUNPOD_ENDPOINT_ID", "").strip()
API_KEY = os.environ.get("RUNPOD_API_KEY", "").strip()
APP_PASSWORD = os.environ.get("APP_PASSWORD", "").strip()
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()

BASE_URL = f"https://api.runpod.ai/v2/{ENDPOINT_ID}"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

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

    if body.get("face_image_b64"):
        inputs["face_image_b64"] = body["face_image_b64"]
    if body.get("input_image_b64"):
        inputs["input_image_b64"] = body["input_image_b64"]

    payload = {"workflow_name": body["workflow_name"], "inputs": inputs}
    if body.get("character"):
        payload["character"] = body["character"]
    if body.get("no_grain"):
        payload["no_grain"] = True
    if "video" in body["workflow_name"]:
        payload["timeout"] = 1200
    return payload


@app.route("/")
@login_required
def index():
    return render_template("index.html")


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
    except Exception as e:
        print("LIBRARY DELETE R2 ERROR:", e, flush=True)
    db.delete(media_id)
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
