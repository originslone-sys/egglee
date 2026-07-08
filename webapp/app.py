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
import threading
import hashlib
import re
from datetime import datetime, timedelta
from functools import wraps

import requests
from flask import (Flask, request, jsonify, render_template,
                   session, redirect, url_for, Response)
from werkzeug.security import generate_password_hash, check_password_hash

import storage
import db
import video
import persona
import pix

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "egglee-dev-secret-change-me")

ENDPOINT_ID = os.environ.get("RUNPOD_ENDPOINT_ID", "").strip()
API_KEY = os.environ.get("RUNPOD_API_KEY", "").strip()
APP_PASSWORD = os.environ.get("APP_PASSWORD", "").strip()
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").strip().lower()
# Domínio público (pra montar as URLs da página de chat do cliente).
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "https://egglee.com").rstrip("/")
_RESERVED_SLUGS = {"admin", "api", "chat", "home", "premium", "login", "signup",
                   "studio", "logout", "u", "static", "webhook", "conta", "usuarios",
                   "modelos", "generate", "library", "persona", "leads", "www"}
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()

BASE_URL = f"https://api.runpod.ai/v2/{ENDPOINT_ID}"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

# Bias de movimento para a geração de vídeo via API (trava de "movimento natural").
# Trava fixa de vídeo (segurança/qualidade): manda a IA LER a imagem e apenas
# animar a mesma pessoa/cena com movimento humano realista e sutil — sem trocar
# rosto/identidade, sem morphing. Aplicada nos dois caminhos (API e Wan local).
VIDEO_MOTION_LOCK = (
    "animate the provided image: keep the exact same person, face, identity, hair, "
    "body, skin and clothing as in the image; keep the same background, scene, "
    "lighting and framing. Add only subtle, natural, human motion — gentle "
    "breathing, soft body sway, natural eye blinking, slight head and hand "
    "movement, hair and fabric moving softly; realistic lifelike movement, stable "
    "camera, smooth photorealistic result"
)
VIDEO_MOTION_NEG = (
    "morphing, face morphing, changing identity, different face, face swap, "
    "deformed face, distorted face, warping, melting, flickering, extra limbs, "
    "extra fingers, duplicate person, teleporting, sudden jerky movement, "
    "unnatural motion, camera shake, glitch, artifacts"
)
# alias legado
NATURAL_MOTION = VIDEO_MOTION_LOCK

# LoRA stack (Power Lora Loader). O da personagem é sempre ativo (identidade).
CHARACTER_LORA = "egglee_character.safetensors"
DEFAULT_STACK_LORAS = ["skin_detail_xl.safetensors", "detail_tweaker_xl.safetensors",
                       "mobile_photography.safetensors", "hand_fix_xl.safetensors"]
STACK_DEFAULT_WEIGHTS = {
    CHARACTER_LORA: 0.8, "skin_detail_xl.safetensors": 0.4,
    "detail_tweaker_xl.safetensors": 0.3, "mobile_photography.safetensors": 0.4,
    "hand_fix_xl.safetensors": 0.5,
}

# ── Fila de geração (Fase 4) ──────────────────────────────────────────────────
# Regras por plano do cliente. -1 = ilimitado. 'conc' = máx. de requisições na
# fila ao mesmo tempo, 'batch' = máx. de imagens por requisição, 'period' define
# como a cota de img/vid é contada: Free = VITALÍCIO (trial), Pro = por DIA.
# Os tetos de img/vid são editáveis no admin (settings) — ver _plan_limits().
PLAN_RULES = {
    "free":      {"img": 20,  "vid": 3,  "conc": 3,   "batch": 1, "period": "lifetime"},
    "pro":       {"img": 100, "vid": 10, "conc": 10,  "batch": 8, "period": "daily"},
    "unlimited": {"img": -1,  "vid": -1, "conc": 999, "batch": 8, "period": "lifetime"},
}
# Defaults dos tetos (usados quando o admin ainda não definiu nada nas settings).
_LIMIT_DEFAULTS = {"free_img": 20, "free_vid": 3, "pro_img": 100, "pro_vid": 10}
# Quantos jobs de cliente ficam "no RunPod" ao mesmo tempo. Baixo = o admin
# (que gera direto) fura a fila com folga. Ajustável por env.
DISPATCH_LIMIT = int(os.environ.get("DISPATCH_LIMIT", "3"))


def _plan_limits():
    """Tetos de img/vid configuráveis no admin (settings), com fallback nos defaults."""
    def _int(key, dflt):
        try:
            v = db.get_setting("limit_" + key)
            return int(v) if v is not None and str(v).strip() != "" else dflt
        except Exception:
            return dflt
    return {k: _int(k, d) for k, d in _LIMIT_DEFAULTS.items()}


def plan_rules(user):
    plan = (user or {}).get("plan") or "free"
    base = dict(PLAN_RULES.get(plan, PLAN_RULES["free"]))
    if plan in ("free", "pro"):
        lims = _plan_limits()
        base["img"] = lims[f"{plan}_img"]
        base["vid"] = lims[f"{plan}_vid"]
    return base


def _day_start_utc():
    """Meia-noite no horário de Brasília (UTC-3), em UTC — reset diário da cota Pro."""
    now_br = datetime.utcnow() - timedelta(hours=3)
    start_br = now_br.replace(hour=0, minute=0, second=0, microsecond=0)
    return start_br + timedelta(hours=3)


def _lora_stackable(name):
    nl = name.lower()
    if name == CHARACTER_LORA:
        return False
    return not any(x in nl for x in ("ip-adapter", "ipadapter", "sd15", "_v1", "-0000"))

try:
    db.init()
except Exception as e:
    print("DB init falhou:", e, flush=True)


def bootstrap_admin():
    """Garante que exista uma conta admin (o dono). Usa ADMIN_EMAIL + a senha
    (ADMIN_PASSWORD ou o APP_PASSWORD legado). Roda uma vez, se não houver admin."""
    if not db.enabled():
        return
    try:
        if db.count_admins() > 0:
            return
        pw = os.environ.get("ADMIN_PASSWORD", "").strip() or APP_PASSWORD
        email = ADMIN_EMAIL or "admin@egglee.com"
        if pw:
            row = db.create_user(email, generate_password_hash(pw),
                                 name="Admin", role="admin", plan="unlimited")
            if row:
                print(f"[bootstrap] conta admin criada: {email}", flush=True)
    except Exception as e:
        print("bootstrap_admin falhou:", e, flush=True)


bootstrap_admin()

try:
    if db.enabled():
        db.backfill_owner(db.first_admin_id())
        db.backfill_slugs()
except Exception as e:
    print("backfill Fase 2/3 falhou:", e, flush=True)

# id do dono (admin principal) — a persona/página/galeria PÚBLICA é a dele.
_OWNER_UID = None


def owner_uid():
    global _OWNER_UID
    if _OWNER_UID is None and db.enabled():
        _OWNER_UID = db.first_admin_id()
    return _OWNER_UID


def uid():
    """id do usuário logado (dono dos dados que ele acessa)."""
    return session.get("uid")


def tenant_uid_from(slug):
    """Resolve o dono da persona pública a partir do slug (/u/<slug>).
    Sem slug (ou inválido) → o admin/dono (a página /chat padrão)."""
    slug = (slug or "").strip()
    if slug and db.enabled():
        u = db.get_user_by_slug(slug)
        if u and u.get("status") == "active":
            return u["id"]
    return owner_uid()

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

def current_user():
    """Devolve a row do usuário logado (ou None). Cacheia no request."""
    uid = session.get("uid")
    if not uid:
        return None
    if not db.enabled():
        return None
    u = db.get_user(uid)
    if not u or u.get("status") != "active":
        return None
    # Pro vencido → rebaixa pra free (assinatura por tempo)
    if u.get("plan") == "pro" and u.get("plan_expires_at") and u["plan_expires_at"] < datetime.utcnow():
        try:
            db.expire_pro_if_needed(u["id"])
        except Exception:
            pass
        u["plan"] = "free"
    return u


def is_admin():
    return session.get("role") == "admin"


def login_required(f):
    """Exige uma sessão válida (qualquer usuário ativo)."""
    @wraps(f)
    def wrap(*a, **k):
        if "uid" not in session:
            if request.path.startswith("/api/"):
                return jsonify({"error": "unauthorized"}), 401
            return redirect(url_for("login"))
        return f(*a, **k)
    return wrap


def admin_required(f):
    """Exige sessão de admin (o dono/agência)."""
    @wraps(f)
    def wrap(*a, **k):
        if "uid" not in session:
            if request.path.startswith("/api/"):
                return jsonify({"error": "unauthorized"}), 401
            return redirect(url_for("login"))
        if session.get("role") != "admin":
            if request.path.startswith("/api/"):
                return jsonify({"error": "forbidden"}), 403
            return redirect(url_for("studio"))
        return f(*a, **k)
    return wrap


# Fase 3A: o cliente acessa o estúdio dele (biblioteca + persona, isolados).
# Geração/treino/modelos/leads/premium continuam SÓ admin (fora desta lista).
_USER_ALLOWED_PREFIXES = (
    "/studio", "/conta", "/logout", "/library", "/persona",
    "/api/account", "/api/library", "/api/stats", "/api/thumb", "/api/media",
    "/api/folders", "/api/presets",
    "/api/admin/persona", "/api/admin/page", "/api/admin/gallery",
    "/api/admin/prompt_preview", "/api/admin/reality_phrases",
    # Fase 3B/4: gerador do cliente + fila de jobs
    "/api/client/", "/api/generate", "/api/status", "/api/video",
    "/api/caption", "/api/jobs",
    # Fase 5: pagamento/assinatura Pro
    "/api/pay",
    "/static", "/favicon", "/u/", "/chat", "/premium", "/home",
    "/api/chat", "/api/pub", "/api/premium", "/api/waitlist", "/api/public",
)


@app.before_request
def _role_gate():
    if "uid" not in session:
        return  # anônimo: rotas cuidam do próprio login
    if session.get("role") == "admin":
        return  # admin: acesso total
    path = request.path
    if path == "/" or not any(path.startswith(p) for p in _USER_ALLOWED_PREFIXES):
        if path.startswith("/api/"):
            return jsonify({"error": "forbidden"}), 403
        return redirect(url_for("studio"))


def _start_session(user):
    session.clear()
    session["uid"] = user["id"]
    session["role"] = user.get("role", "user")
    session["email"] = user.get("email", "")


@app.route("/favicon.ico")
def favicon():
    return redirect("/static/favicon.svg", code=301)


@app.route("/login", methods=["GET", "POST"])
def login():
    if "uid" in session:
        return redirect(url_for("index" if is_admin() else "studio"))
    if request.method == "POST":
        email = (request.form.get("email") or "").strip().lower()
        password = request.form.get("password") or ""
        # Legado: sem e-mail + senha == APP_PASSWORD → entra como admin (não trava o dono).
        if not email and APP_PASSWORD and password == APP_PASSWORD:
            admin = db.get_user_by_email(ADMIN_EMAIL or "admin@egglee.com") if db.enabled() else None
            if admin:
                _start_session(admin)
            else:
                session.clear(); session["uid"] = 0; session["role"] = "admin"; session["email"] = "admin"
            return redirect(url_for("index"))
        user = db.get_user_by_email(email) if (db.enabled() and email) else None
        if user and user.get("status") == "active" and check_password_hash(user["password_hash"], password):
            _start_session(user)
            return redirect(url_for("index" if user.get("role") == "admin" else "studio"))
        return render_template("login.html", error="E-mail ou senha incorretos")
    return render_template("login.html", error=None)


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if "uid" in session:
        return redirect(url_for("index" if is_admin() else "studio"))
    if request.method == "POST":
        if not db.enabled():
            return render_template("signup.html", error="Cadastro indisponível no momento.")
        name = (request.form.get("name") or "").strip()[:120]
        email = (request.form.get("email") or "").strip().lower()
        password = request.form.get("password") or ""
        if "@" not in email or "." not in email.split("@")[-1]:
            return render_template("signup.html", error="E-mail inválido.")
        if len(password) < 6:
            return render_template("signup.html", error="A senha precisa de pelo menos 6 caracteres.")
        if db.get_user_by_email(email):
            return render_template("signup.html", error="Já existe uma conta com esse e-mail.")
        row = db.create_user(email, generate_password_hash(password), name=name, role="user")
        if not row:
            return render_template("signup.html", error="Não foi possível criar a conta.")
        _start_session(row)
        return redirect(url_for("studio"))
    return render_template("signup.html", error=None)


@app.route("/conta")
@login_required
def conta():
    u = current_user()
    return render_template("conta.html", user=u or {})


@app.route("/studio")
@login_required
def studio():
    """Home do estúdio do cliente."""
    if is_admin():
        return redirect(url_for("index"))
    u = current_user()
    return render_template("studio.html", user=u or {}, public_base=PUBLIC_BASE_URL)


@app.route("/studio/gerar")
@login_required
def studio_gerar():
    """Gerador do cliente (só modelos liberados)."""
    if is_admin():
        return redirect(url_for("generate_page"))
    u = current_user() or {}
    return render_template("studio_gerar.html", role="user", slug=u.get("slug", ""))


@app.route("/studio/fila")
@login_required
def studio_fila():
    """Área de requisições do cliente (pendentes/processando/concluídas)."""
    if is_admin():
        return redirect(url_for("index"))
    u = current_user() or {}
    return render_template("studio_fila.html", role="user", slug=u.get("slug", ""))


@app.route("/studio/pro")
@login_required
def studio_pro():
    """Página de assinatura do plano Pro (PIX)."""
    if is_admin():
        return redirect(url_for("index"))
    u = current_user() or {}
    return render_template("studio_pro.html", role="user", slug=u.get("slug", ""))


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ── Conta do cliente (self) ───────────────────────────────────────────────────

@app.route("/api/account")
@login_required
def api_account():
    u = current_user()
    if not u:
        return jsonify({"error": "unauthorized"}), 401
    return jsonify({"id": u["id"], "email": u["email"], "name": u.get("name") or "",
                    "role": u.get("role"), "plan": u.get("plan"), "status": u.get("status"),
                    "slug": u.get("slug") or ""})


@app.route("/api/account/slug", methods=["POST"])
@login_required
def account_slug():
    """Cliente escolhe o nome do próprio link (/u/<slug>)."""
    u = current_user() or {}
    if not u.get("id"):
        return jsonify({"error": "unauthorized"}), 401
    raw = (request.get_json(force=True).get("slug") or "").strip().lower()
    slug = re.sub(r"[^a-z0-9-]+", "-", raw).strip("-")
    if not (3 <= len(slug) <= 32) or not re.match(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", slug):
        return jsonify({"error": "Use 3–32 caracteres: letras, números e hífen."}), 400
    if slug in _RESERVED_SLUGS:
        return jsonify({"error": "Esse nome é reservado, escolha outro."}), 400
    if not db.enabled() or not db.update_user_slug(u["id"], slug):
        return jsonify({"error": "Esse nome já está em uso."}), 409
    return jsonify({"ok": True, "slug": slug, "url": f"{PUBLIC_BASE_URL}/u/{slug}"})


# ── Admin: gestão de usuários ─────────────────────────────────────────────────

@app.route("/usuarios")
@admin_required
def usuarios_page():
    return render_template("usuarios.html")


def _user_public(u):
    return {"id": u["id"], "email": u["email"], "name": u.get("name") or "",
            "role": u.get("role"), "status": u.get("status"), "plan": u.get("plan"),
            "created_at": u["created_at"].isoformat() if u.get("created_at") else ""}


@app.route("/api/admin/users")
@admin_required
def admin_users_list():
    if not db.enabled():
        return jsonify({"users": []})
    return jsonify({"users": [_user_public(u) for u in db.list_users()]})


@app.route("/api/admin/users", methods=["POST"])
@admin_required
def admin_users_create():
    if not db.enabled():
        return jsonify({"ok": False, "reason": "banco não configurado"}), 500
    b = request.get_json(force=True)
    email = (b.get("email") or "").strip().lower()
    password = b.get("password") or ""
    name = (b.get("name") or "").strip()[:120]
    role = "admin" if b.get("role") == "admin" else "user"
    plan = (b.get("plan") or "free").strip()[:40]
    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({"ok": False, "reason": "e-mail inválido"}), 400
    if len(password) < 6:
        return jsonify({"ok": False, "reason": "senha muito curta (mín. 6)"}), 400
    if db.get_user_by_email(email):
        return jsonify({"ok": False, "reason": "e-mail já cadastrado"}), 409
    row = db.create_user(email, generate_password_hash(password), name=name, role=role, plan=plan)
    if not row:
        return jsonify({"ok": False, "reason": "falha ao criar"}), 500
    return jsonify({"ok": True, "user": _user_public(row)})


@app.route("/api/admin/users/update", methods=["POST"])
@admin_required
def admin_users_update():
    b = request.get_json(force=True)
    uid = int(b.get("id"))
    target = db.get_user(uid)
    if not target:
        return jsonify({"ok": False, "reason": "usuário não encontrado"}), 404
    # trava de segurança: não deixar rebaixar/desativar o último admin
    if target.get("role") == "admin" and (b.get("role") == "user" or b.get("status") == "disabled"):
        if db.count_admins() <= 1:
            return jsonify({"ok": False, "reason": "não dá pra remover o último admin"}), 400
    if "status" in b:
        db.set_user_status(uid, "disabled" if b["status"] == "disabled" else "active")
    if "role" in b:
        db.set_user_role(uid, "admin" if b["role"] == "admin" else "user")
    if "plan" in b:
        db.set_user_plan(uid, (b["plan"] or "free").strip()[:40])
    if b.get("password"):
        if len(b["password"]) < 6:
            return jsonify({"ok": False, "reason": "senha muito curta"}), 400
        db.update_user_password(uid, generate_password_hash(b["password"]))
    return jsonify({"ok": True})


@app.route("/api/admin/users/delete", methods=["POST"])
@admin_required
def admin_users_delete():
    uid = int((request.get_json(force=True) or {}).get("id"))
    target = db.get_user(uid)
    if target and target.get("role") == "admin" and db.count_admins() <= 1:
        return jsonify({"ok": False, "reason": "não dá pra excluir o último admin"}), 400
    if uid == session.get("uid"):
        return jsonify({"ok": False, "reason": "não dá pra excluir você mesmo"}), 400
    db.delete_user(uid)
    return jsonify({"ok": True})


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
    # Dança (Fun-Control): URL presigned do vídeo-guia (o worker baixa e corta 5s).
    if body.get("control_video_url"):
        inputs["control_video_url"] = body["control_video_url"]

    # Vídeo self-host (Wan 2.2 TI2V-5B): traduz resolução/proporção em dimensões.
    # O 5B é nativo 720p @ 24fps; dimensões múltiplas de 32 (exigência do node).
    if "video" in body["workflow_name"]:
        _DIMS = {
            "480p": {"9:16": (480, 832), "16:9": (832, 480), "1:1": (640, 640)},
            "720p": {"9:16": (704, 1280), "16:9": (1280, 704), "1:1": (960, 960)},
        }
        res = body.get("resolution", "720p")
        ar = body.get("aspect_ratio", "9:16")
        w, h = _DIMS.get(res, _DIMS["720p"]).get(ar, (704, 1280))
        try:
            dur = int(float(body.get("duration", 5)))
        except (TypeError, ValueError):
            dur = 5
        video_segments = max(1, min(3, dur // 5))   # 5s=1, 10s=2, 15s=3
        inputs["width"] = w
        inputs["height"] = h
        inputs["length"] = 121                # 5s por trecho @ 24fps (frames 4n+1)
        inputs["frame_rate"] = 24
        inputs["steps"] = 30                  # 5B é single-pass; 30 passos (ajustável)

        # Prompt livre: usa o prompt/negativo do usuário direto (sem trava fixa).
        inputs["positive_prompt"] = (body.get("prompt") or "").strip()
        inputs["negative_prompt"] = (body.get("negative_prompt") or "").strip()

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


@app.before_request
def public_domain_home():
    """Num domínio customizado (egglee.com), a raiz é a HOMEPAGE do produto.
    Pelo domínio .up.railway.app, a raiz segue sendo o admin (Dashboard)."""
    if request.path == "/":
        host = request.host.split(":")[0].lower()
        if not (host.endswith("up.railway.app") or host.startswith(("localhost", "127."))):
            return render_template("home.html")


@app.route("/home")
def home_page():
    return render_template("home.html")


@app.route("/api/public/pricing")
def public_pricing():
    """Preço/planos públicos pra homepage (sem login)."""
    lims = _plan_limits()
    return jsonify({
        "pro_price_brl": _pro_price(), "pro_days": _pro_days(),
        "pay_enabled": pix.enabled() and _pro_price() > 0,
        "free_img": lims["free_img"], "free_vid": lims["free_vid"],
        "pro_img": lims["pro_img"], "pro_vid": lims["pro_vid"],
    })


@app.route("/")
@login_required
def index():
    return render_template("dashboard.html")


@app.route("/generate")
@admin_required
def generate_page():
    return render_template("index.html")


@app.route("/persona")
@login_required
def persona_admin_page():
    u = current_user() or {}
    return render_template("persona_admin.html",
                           role=session.get("role", "user"), slug=u.get("slug", ""))


@app.route("/modelos")
@admin_required
def models_page():
    return render_template("models.html")


@app.route("/library")
@login_required
def library_page():
    u = current_user() or {}
    return render_template("library.html",
                           role=session.get("role", "user"), slug=u.get("slug", ""))


@app.route("/leads")
@admin_required
def leads_page():
    return render_template("leads.html")


# ── Página premium (pública) + captação de lista de espera ────────────────────

@app.route("/premium")
def premium_page():
    """Landing premium pública (lista de espera). Sem login."""
    return render_template("premium.html")


# rate-limit simples em memória por IP pra não spammar a lista
_WAITLIST_HITS = {}


def _valid_email(e):
    e = (e or "").strip()
    return "@" in e and "." in e.split("@")[-1] and len(e) <= 200


@app.route("/api/waitlist", methods=["POST"])
def waitlist_join():
    if not db.enabled():
        return jsonify({"ok": False, "error": "indisponível no momento"}), 503
    # rate-limit leve: máx 5 envios / 10 min por IP
    ip = (request.headers.get("X-Forwarded-For", request.remote_addr or "") or "").split(",")[0].strip()
    now = time.time()
    hits = [t for t in _WAITLIST_HITS.get(ip, []) if now - t < 600]
    if len(hits) >= 5:
        return jsonify({"ok": False, "error": "muitas tentativas, tente mais tarde"}), 429
    hits.append(now)
    _WAITLIST_HITS[ip] = hits

    b = request.get_json(force=True, silent=True) or {}
    name = (b.get("name") or "").strip()[:120]
    email = (b.get("email") or "").strip()[:200]
    whatsapp = (b.get("whatsapp") or "").strip()[:40]
    note = (b.get("note") or "").strip()[:500]
    if not _valid_email(email) and not whatsapp:
        return jsonify({"ok": False, "error": "Informe um e-mail ou WhatsApp válido."}), 400
    if email and not _valid_email(email):
        return jsonify({"ok": False, "error": "E-mail inválido."}), 400
    try:
        _row, is_new = db.insert_lead(name=name, email=email, whatsapp=whatsapp,
                                      source=b.get("source", "premium"), note=note)
    except Exception as e:
        print("WAITLIST ERROR:", e, flush=True)
        return jsonify({"ok": False, "error": "não foi possível salvar, tente de novo"}), 500
    return jsonify({"ok": True, "new": is_new})


@app.route("/api/admin/leads")
@admin_required
def admin_leads():
    if not db.enabled():
        return jsonify({"leads": [], "total": 0})
    rows = db.list_leads()
    leads = [{
        "id": r["id"], "name": r.get("name") or "", "email": r.get("email") or "",
        "whatsapp": r.get("whatsapp") or "", "source": r.get("source") or "",
        "note": r.get("note") or "",
        "created_at": r["created_at"].isoformat() if r.get("created_at") else "",
    } for r in rows]
    return jsonify({"leads": leads, "total": len(leads)})


@app.route("/api/admin/leads/delete", methods=["POST"])
@admin_required
def admin_leads_delete():
    lead_id = (request.get_json(force=True) or {}).get("id")
    if lead_id is not None:
        db.delete_lead(int(lead_id))
    return jsonify({"ok": True})


@app.route("/api/admin/leads.csv")
@admin_required
def admin_leads_csv():
    rows = db.list_leads() if db.enabled() else []
    out = io.StringIO()
    out.write("nome,email,whatsapp,origem,observacao,data\n")
    for r in rows:
        def esc(v):
            v = str(v or "").replace('"', '""')
            return f'"{v}"'
        dt = r["created_at"].strftime("%Y-%m-%d %H:%M") if r.get("created_at") else ""
        out.write(",".join([esc(r.get("name")), esc(r.get("email")), esc(r.get("whatsapp")),
                            esc(r.get("source")), esc(r.get("note")), esc(dt)]) + "\n")
    return Response(out.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=leads_egglee.csv"})


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


def _upload_control_video(b64: str) -> str:
    """Sobe o vídeo-guia da dança no R2 e devolve uma URL presigned (o worker
    baixa por ela — evita o limite de payload do RunPod)."""
    raw = base64.b64decode((b64 or "").split(",", 1)[-1])
    if not raw:
        raise ValueError("vídeo vazio")
    if len(raw) > 60 * 1024 * 1024:
        raise ValueError("vídeo-guia muito grande (máx 60MB)")
    if not storage.enabled():
        raise ValueError("armazenamento (R2) não configurado")
    key = f"_control/{uuid.uuid4().hex}.mp4"
    storage.upload_bytes(key, raw, "video/mp4")
    return storage.presigned_url(key, expires=3600)


@app.route("/api/generate", methods=["POST"])
@login_required
def generate():
    if not (ENDPOINT_ID and API_KEY):
        return jsonify({"error": "Configure RUNPOD_ENDPOINT_ID e RUNPOD_API_KEY no Railway."}), 500

    body = request.get_json(force=True)
    if not body.get("workflow_name"):
        return jsonify({"error": "workflow_name é obrigatório"}), 400

    # Dança: o vídeo-guia vai pro R2 e só a URL segue pro worker (admin-only).
    if body.get("workflow_name") == "video_dance" and body.get("control_video_b64"):
        if not is_admin():
            return jsonify({"error": "recurso disponível só no painel admin"}), 403
        try:
            body["control_video_url"] = _upload_control_video(body.pop("control_video_b64"))
        except Exception as e:
            return jsonify({"error": f"vídeo-guia inválido: {e}"}), 400

    if is_admin():
        payload = _build_input(body)
        # dono: a personagem principal é sempre forçada (identidade), como antes.
        payload["character_lora"] = CHARACTER_LORA
    else:
        # cliente: só pode usar modelos LIBERADOS; nunca herda o personagem do dono.
        wf = body.get("workflow_name", "")
        if wf not in ("txt2img", "img2img", "video_i2v", "upscale"):
            return jsonify({"error": "workflow não permitido"}), 403
        allowed_ck = set(_client_checkpoints())
        allowed_lr = set(_client_loras())
        if not allowed_ck:
            return jsonify({"error": "Nenhum modelo liberado ainda. Fale com o suporte."}), 403
        ck = body.get("checkpoint")
        if not ck or ck not in allowed_ck:
            ck = next(iter(allowed_ck))
        loras = [l for l in (body.get("loras") or [])
                 if isinstance(l, dict) and l.get("name") in allowed_lr]
        safe = {
            "workflow_name": wf,
            "prompt": body.get("prompt", ""),
            "negative_prompt": body.get("negative_prompt", ""),
            "seed": body.get("seed", "-1"),
            "batch_size": body.get("batch_size", 1),
            "steps": body.get("steps"),
            "checkpoint": ck,
            "loras": loras,
            "input_image_b64": body.get("input_image_b64"),
            "resolution": body.get("resolution"),
            "aspect_ratio": body.get("aspect_ratio"),
            "duration": body.get("duration"),
        }
        payload = _build_input(safe)   # sem 'character' nem 'character_lora' → não herda o dono

    try:
        r = requests.post(f"{BASE_URL}/run", headers=HEADERS,
                          json={"input": payload}, timeout=30)
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
    row = db.get(media_id, uid())
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
    # Prompt livre: usa o prompt do usuário direto (sem trava fixa).
    full_prompt = b.get("prompt", "").strip()
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
        row = db.insert(uid(), key, type="video", prompt=b.get("prompt", ""),
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
        row = db.insert(uid(), key, type=mtype, prompt=body.get("prompt", ""),
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
            uid(),
            limit=int(request.args.get("limit", 400)),
            folder=request.args.get("folder") or None,
            favorite=request.args.get("favorite") == "1",
            q=request.args.get("q") or None,
            type=request.args.get("type") or None,
        )
        folders = db.list_folders(uid())
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
        return jsonify({"presets": db.list_presets(uid())})
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
    row = db.create_preset(uid(), name, prompt)
    return jsonify({"ok": True, "id": row["id"]})


@app.route("/api/presets/<int:preset_id>", methods=["DELETE"])
@login_required
def presets_delete(preset_id):
    if db.enabled():
        db.delete_preset(preset_id, uid())
    return jsonify({"ok": True})


@app.route("/api/folders", methods=["POST"])
@login_required
def folder_create():
    name = (request.get_json(force=True).get("name") or "").strip()
    if not name:
        return jsonify({"ok": False, "reason": "nome vazio"}), 400
    db.create_folder(uid(), name)
    return jsonify({"ok": True})


@app.route("/api/folders/rename", methods=["POST"])
@login_required
def folder_rename():
    b = request.get_json(force=True)
    old, new = (b.get("old") or "").strip(), (b.get("new") or "").strip()
    if not old or not new or old == "Geral":
        return jsonify({"ok": False, "reason": "inválido"}), 400
    db.rename_folder(uid(), old, new)
    return jsonify({"ok": True})


@app.route("/api/folders/delete", methods=["POST"])
@login_required
def folder_delete():
    name = (request.get_json(force=True).get("name") or "").strip()
    if not name or name == "Geral":
        return jsonify({"ok": False, "reason": "inválido"}), 400
    db.delete_folder(uid(), name)
    return jsonify({"ok": True})


@app.route("/api/stats")
@login_required
def stats():
    if not db.enabled():
        return jsonify({})
    try:
        return jsonify(db.stats(uid()))
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
    row = db.get(media_id, uid())
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
    row = db.get(media_id, uid())
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
    db.set_favorite(b["id"], b.get("value", True), uid())
    return jsonify({"ok": True})


@app.route("/api/library/move", methods=["POST"])
@login_required
def library_move():
    b = request.get_json(force=True)
    folder = (b.get("folder") or "Geral").strip() or "Geral"
    db.set_folder(b.get("ids", []), folder, uid())
    return jsonify({"ok": True})


@app.route("/api/library/tags", methods=["POST"])
@login_required
def library_tags():
    b = request.get_json(force=True)
    db.set_tags(b["id"], (b.get("tags") or "").strip(), uid())
    return jsonify({"ok": True})


@app.route("/api/library/delete", methods=["POST"])
@login_required
def library_delete_many():
    ids = request.get_json(force=True).get("ids", [])
    if not ids:
        return jsonify({"ok": False, "reason": "sem ids"}), 400
    try:
        for key in db.keys_for(ids, uid()):
            try:
                storage.delete_key(key)
                storage.delete_key(_thumb_key(key))
            except Exception as e:
                print("DELETE R2 ERROR:", e, flush=True)
        db.delete_many(ids, uid())
    except Exception as e:
        print("BULK DELETE ERROR:", e, flush=True)
        return jsonify({"ok": False, "reason": str(e)}), 500
    return jsonify({"ok": True})


@app.route("/api/library/<int:media_id>", methods=["DELETE"])
@login_required
def library_delete(media_id):
    row = db.get(media_id, uid())
    if not row:
        return jsonify({"ok": False}), 404
    try:
        storage.delete_key(row["r2_key"])
        storage.delete_key(_thumb_key(row["r2_key"]))
    except Exception as e:
        print("LIBRARY DELETE R2 ERROR:", e, flush=True)
    db.delete(media_id, uid())
    return jsonify({"ok": True})


# ── Persona / Front público ─────────────────────────────────────────────────

@app.route("/chat")
def chat_page():
    # /chat = persona do dono (admin). Compat: sem slug.
    return render_template("chat.html", tenant_slug="")


@app.route("/u/<slug>")
def tenant_chat(slug):
    """Página de chat pública de um cliente (persona dele)."""
    if db.enabled():
        u = db.get_user_by_slug(slug)
        if not u or u.get("status") != "active":
            return ("página não encontrada", 404)
    return render_template("chat.html", tenant_slug=slug)


@app.route("/chat/galeria")
def chat_gallery_page():
    return render_template("gallery.html", tenant_slug=(request.args.get("u") or "").strip())


@app.route("/api/chat/persona")
def chat_persona():
    """Dados públicos da persona pra montar a página /chat (sem login)."""
    slug = (request.args.get("u") or "").strip()
    ow = tenant_uid_from(slug)
    q = f"&u={slug}" if slug else ""
    qf = f"?u={slug}" if slug else ""
    p = persona.get_persona(ow)
    pg = persona.get_page(ow)
    gal = persona.get_gallery(ow)
    avatar = f"/api/pub/media/{p['avatar_id']}?t=1{q}" if p.get("avatar_id") else None
    gallery = [{"id": i, "thumb": f"/api/pub/media/{i}?t=1{q}",
                "full": f"/api/pub/media/{i}{qf}"} for i in gal]
    return jsonify({
        "name": p.get("name"), "status": p.get("status"), "bio": p.get("bio"),
        "greeting": p.get("greeting"), "avatar": avatar,
        "banner": pg.get("banner"), "ads": pg.get("ads"), "disclaimer": pg.get("disclaimer"),
        "gallery": gallery,
    })


@app.route("/api/premium/showcase")
def premium_showcase():
    """Mídias de demonstração da página premium (público, sem login)."""
    ow = owner_uid()
    ids = persona.get_showcase(ow)
    items = []
    for i in ids:
        row = db.get(i, ow) if db.enabled() else None
        if not row:
            continue
        items.append({
            "id": i,
            "type": row.get("type", "image"),
            "thumb": f"/api/pub/media/{i}?t=1",
            "full": f"/api/pub/media/{i}",
        })
    return jsonify({"items": items})


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
        tenant = tenant_uid_from(b.get("slug"))
        bubbles = persona.chat_reply(tenant, b.get("history") or [], msg)
    except Exception as e:
        print("CHAT ERROR:", e, flush=True)
        bubbles = ["opa, me perdi aqui 🙈 tenta de novo?"]
    return jsonify({"bubbles": bubbles})


@app.route("/api/pub/media/<int:media_id>")
def pub_media(media_id):
    """Serve só as imagens liberadas (avatar + galeria da persona) — sem login."""
    ow = tenant_uid_from(request.args.get("u"))
    allowed = set(persona.get_gallery(ow)) | set(persona.get_showcase(ow))
    av = persona.get_persona(ow).get("avatar_id")
    if av:
        allowed.add(av)
    if media_id not in allowed:
        return ("forbidden", 403)
    row = db.get(media_id, ow)
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
    # miniatura (?t=1) muda pouco → cache longo (carrega instantâneo em revisitas)
    resp.headers["Cache-Control"] = ("public, max-age=604800, immutable"
                                     if request.args.get("t") == "1" else "public, max-age=3600")
    return resp


# ── Admin: configuração da persona / página ─────────────────────────────────

@app.route("/api/admin/persona", methods=["GET"])
@login_required
def admin_persona_get():
    return jsonify({"persona": persona.get_persona(uid()),
                    "page": persona.get_page(uid()),
                    "gallery": persona.get_gallery(uid())})


@app.route("/api/admin/persona", methods=["POST"])
@login_required
def admin_persona_save():
    if not db.enabled():
        return jsonify({"ok": False, "reason": "banco não configurado"}), 500
    persona.save_persona(uid(), request.get_json(force=True))
    return jsonify({"ok": True})


@app.route("/api/admin/page", methods=["POST"])
@login_required
def admin_page_save():
    if not db.enabled():
        return jsonify({"ok": False, "reason": "banco não configurado"}), 500
    persona.save_page(uid(), request.get_json(force=True))
    return jsonify({"ok": True})


@app.route("/api/admin/prompt_preview")
@login_required
def admin_prompt_preview():
    """Prompt automático montado pelos campos (sem os limites fixos), pra editar."""
    return jsonify({"prompt": persona.build_auto_prompt(persona.get_persona(uid()))})


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


# ── Disponibilidade de modelos pro cliente (Fase 3B) ──────────────────────────

def _client_loras():
    try:
        return json.loads(db.get_setting("client_loras") or "[]")
    except Exception:
        return []


def _client_checkpoints():
    try:
        return json.loads(db.get_setting("client_checkpoints") or "[]")
    except Exception:
        return []


@app.route("/api/admin/client_models", methods=["GET"])
@admin_required
def admin_client_models_get():
    return jsonify({"loras": _client_loras(), "checkpoints": _client_checkpoints()})


@app.route("/api/admin/client_models", methods=["POST"])
@admin_required
def admin_client_models_save():
    if not db.enabled():
        return jsonify({"ok": False, "reason": "banco não configurado"}), 500
    b = request.get_json(force=True)
    db.set_setting("client_loras", json.dumps([str(x) for x in (b.get("loras") or [])]))
    db.set_setting("client_checkpoints", json.dumps([str(x) for x in (b.get("checkpoints") or [])]))
    return jsonify({"ok": True})


@app.route("/api/client/models", methods=["GET"])
@login_required
def client_models():
    """Modelos liberados pro cliente montar o gerador dele."""
    return jsonify({"checkpoints": _client_checkpoints(), "loras": _client_loras(),
                    "defaults": STACK_DEFAULT_WEIGHTS})


# ── Fila de jobs (Fase 4): dispatcher em background + API ──────────────────────

def _client_safe_payload(body):
    """Monta o payload do RunPod pro cliente: só modelos liberados, sem herdar
    o personagem do dono. Devolve (payload, kind, batch) ou levanta ValueError."""
    wf = body.get("workflow_name", "")
    if wf not in ("txt2img", "img2img", "video_i2v", "upscale"):
        raise ValueError("workflow não permitido")
    allowed_ck = set(_client_checkpoints())
    allowed_lr = set(_client_loras())
    if not allowed_ck:
        raise ValueError("Nenhum modelo liberado ainda. Fale com o suporte.")
    ck = body.get("checkpoint")
    if not ck or ck not in allowed_ck:
        ck = next(iter(allowed_ck))
    loras = [l for l in (body.get("loras") or [])
             if isinstance(l, dict) and l.get("name") in allowed_lr]
    kind = "video" if "video" in wf else "image"
    safe = {
        "workflow_name": wf, "prompt": body.get("prompt", ""),
        "negative_prompt": body.get("negative_prompt", ""),
        "seed": body.get("seed", "-1"), "batch_size": body.get("batch_size", 1),
        "steps": body.get("steps"), "checkpoint": ck, "loras": loras,
        "input_image_b64": body.get("input_image_b64"),
        "resolution": body.get("resolution"), "aspect_ratio": body.get("aspect_ratio"),
        "duration": body.get("duration"),
    }
    payload = _build_input(safe)
    batch = payload.get("inputs", {}).get("batch_size", 1) if kind == "image" else 1
    return payload, kind, batch


def _job_public(j):
    try:
        res = json.loads(j.get("result") or "null")
    except Exception:
        res = None
    return {"id": j["id"], "kind": j.get("kind"), "workflow": j.get("workflow"),
            "status": j.get("status"), "prompt": j.get("prompt") or "",
            "batch": j.get("batch"), "media": (res or {}).get("media") if res else [],
            "error": j.get("error"),
            "created_at": j["created_at"].isoformat() if j.get("created_at") else ""}


@app.route("/api/jobs", methods=["POST"])
@login_required
def jobs_create():
    if not (ENDPOINT_ID and API_KEY):
        return jsonify({"error": "geração indisponível no momento"}), 503
    if not db.enabled():
        return jsonify({"error": "banco não configurado"}), 500
    u = current_user() or {}
    if not u.get("id"):
        return jsonify({"error": "unauthorized"}), 401
    b = request.get_json(force=True)
    try:
        payload, kind, batch = _client_safe_payload(b)
    except ValueError as e:
        return jsonify({"error": str(e)}), 403

    rules = plan_rules(u)
    # concorrência (Pro = 10 na fila; Free = 3)
    if db.active_job_count(u["id"]) >= rules["conc"]:
        return jsonify({"error": f"Você já tem {rules['conc']} requisições na fila. "
                        "Aguarde uma terminar pra enviar outra.", "limited": "conc"}), 429
    # batch por plano (Free = 1 imagem por requisição)
    if kind == "image" and rules["batch"] == 1:
        payload.setdefault("inputs", {})["batch_size"] = 1
        batch = 1
    # cota de gerações: Free = vitalícia (trial); Pro = por dia.
    daily = rules.get("period") == "daily"
    limit = rules["img"] if kind == "image" else rules["vid"]
    if limit != -1:
        used = db.kind_used_count(u["id"], kind, since=_day_start_utc() if daily else None)
        if used >= limit:
            nome = "imagens" if kind == "image" else "vídeos"
            if daily:
                msg = (f"Você atingiu o limite diário de {limit} {nome} do Pro. "
                       "A cota renova amanhã.")
            else:
                msg = (f"Você usou suas {limit} gerações de {nome} do plano gratuito. "
                       "Faça upgrade pra continuar.")
            return jsonify({"error": msg, "limited": "quota"}), 403

    priority = 10 if u.get("role") == "admin" else 0
    job = db.create_job(u["id"], kind, b.get("workflow_name", ""), json.dumps(payload),
                        prompt=b.get("prompt", ""), batch=batch, priority=priority)
    return jsonify({"ok": True, "job": _job_public(job)})


@app.route("/api/jobs", methods=["GET"])
@login_required
def jobs_list():
    if not db.enabled():
        return jsonify({"jobs": []})
    return jsonify({"jobs": [_job_public(j) for j in db.list_jobs(uid())]})


@app.route("/api/jobs/<int:job_id>", methods=["GET"])
@login_required
def jobs_get(job_id):
    j = db.get_job(job_id, uid()) if db.enabled() else None
    if not j:
        return jsonify({"error": "não encontrado"}), 404
    return jsonify(_job_public(j))


@app.route("/api/jobs/<int:job_id>/cancel", methods=["POST"])
@login_required
def jobs_cancel(job_id):
    j = db.get_job(job_id, uid()) if db.enabled() else None
    if not j:
        return jsonify({"error": "não encontrado"}), 404
    if j.get("status") == "queued":     # só dá pra cancelar antes de despachar
        db.update_job(job_id, status="canceled")
    return jsonify({"ok": True})


@app.route("/api/client/quota", methods=["GET"])
@login_required
def client_quota():
    u = current_user() or {}
    if not u.get("id"):
        lims = _plan_limits()
        return jsonify({"plan": "free", "img_used": 0, "img_limit": lims["free_img"],
                        "vid_used": 0, "vid_limit": lims["free_vid"], "conc_used": 0,
                        "conc_limit": PLAN_RULES["free"]["conc"], "period": "lifetime"})
    r = plan_rules(u)
    since = _day_start_utc() if r.get("period") == "daily" else None
    return jsonify({
        "plan": u.get("plan") or "free",
        "period": r.get("period", "lifetime"),
        "img_used": db.kind_used_count(u["id"], "image", since=since) if db.enabled() else 0,
        "img_limit": r["img"],
        "vid_used": db.kind_used_count(u["id"], "video", since=since) if db.enabled() else 0,
        "vid_limit": r["vid"],
        "conc_used": db.active_job_count(u["id"]) if db.enabled() else 0,
        "conc_limit": r["conc"],
    })


# ── Pagamento PIX / assinatura Pro (Fase 5) ───────────────────────────────────

def _pro_price():
    try:
        return round(float(db.get_setting("pro_price_brl") or 0), 2)
    except Exception:
        return 0.0


def _pro_days():
    try:
        return max(1, int(db.get_setting("pro_days") or 30))
    except Exception:
        return 30


def _digits(s):
    return "".join(ch for ch in (s or "") if ch.isdigit())


def _qr_data_uri(text):
    """Gera o QR do código PIX como data URI PNG (renderizado no servidor)."""
    if not text:
        return None
    try:
        import qrcode
        img = qrcode.make(text)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        print("QR ERROR:", e, flush=True)
        return None


def _confirm_and_activate(external_id):
    """Idempotente: confirma o pagamento (só a 1ª vez) e ativa/estende o Pro."""
    row = db.confirm_payment_atomic(external_id)
    if not row:
        return False
    db.activate_pro(row["user_id"], row["plan_days"])
    print(f"[pix] Pro ativado: user {row['user_id']} +{row['plan_days']}d ({external_id})", flush=True)
    return True


@app.route("/api/pay/config")
@login_required
def pay_config():
    u = current_user() or {}
    return jsonify({
        "enabled": pix.enabled() and db.enabled() and _pro_price() > 0,
        "price_brl": _pro_price(), "days": _pro_days(),
        "plan": u.get("plan") or "free",
        "plan_expires_at": u["plan_expires_at"].isoformat() if u.get("plan_expires_at") else None,
    })


@app.route("/api/pay/pro", methods=["POST"])
@login_required
def pay_pro():
    if not (pix.enabled() and db.enabled()):
        return jsonify({"error": "pagamento indisponível no momento"}), 503
    price = _pro_price()
    if price <= 0:
        return jsonify({"error": "preço do Pro não configurado"}), 503
    u = current_user() or {}
    if not u.get("id"):
        return jsonify({"error": "unauthorized"}), 401
    b = request.get_json(force=True)
    cpf = _digits(b.get("cpf"))
    if len(cpf) != 11:
        return jsonify({"error": "CPF inválido (precisa de 11 dígitos)"}), 400
    days = _pro_days()
    external_id = f"PRO-{u['id']}-{int(time.time())}-{uuid.uuid4().hex[:8]}"
    try:
        db.create_payment(u["id"], external_id, price, days)
    except Exception as e:
        print("PAY CREATE DB ERROR:", e, flush=True)
        return jsonify({"error": "falha ao iniciar o pagamento"}), 500
    res = pix.create_deposit(price, external_id, f"Egglee Pro {days} dias",
                             payer_name=u.get("name") or u.get("email"),
                             payer_email=u.get("email"), payer_document=cpf)
    if not res["ok"]:
        db.update_payment(external_id, status="failed")
        print("ZETTPAY DEPOSIT ERROR:", res.get("status"), res.get("data"), flush=True)
        return jsonify({"error": "não foi possível gerar o PIX. Tente de novo."}), 502
    d = res["data"] or {}
    qr = d.get("qr_code") or d.get("pix_copy_paste") or ""
    db.update_payment(external_id, zettpay_id=d.get("id"), qr_code=qr)
    return jsonify({"external_id": external_id, "amount_brl": price,
                    "pix_copy_paste": qr, "qr_image": _qr_data_uri(qr),
                    "expires_at": d.get("expires_at")})


@app.route("/api/pay/status")
@login_required
def pay_status():
    external_id = (request.args.get("external_id") or "").strip()
    p = db.get_payment(external_id, uid()) if (db.enabled() and external_id) else None
    if not p:
        return jsonify({"error": "não encontrado"}), 404
    status = p.get("status")
    if status == "pending" and pix.enabled():
        res = pix.lookup_deposit(external_id)     # verificação dupla
        st = str((res.get("data") or {}).get("status", "")).upper()
        if st in ("PAID", "COMPLETED", "APPROVED"):
            _confirm_and_activate(external_id)
            status = "confirmed"
        elif st in ("EXPIRED", "FAILED", "CANCELED"):
            db.update_payment(external_id, status="expired")
            status = "expired"
    u = current_user() or {}
    return jsonify({"status": status, "plan": u.get("plan") or "free",
                    "confirmed": status == "confirmed",
                    "plan_expires_at": u["plan_expires_at"].isoformat() if u.get("plan_expires_at") else None})


@app.route("/webhook/zettpay", methods=["POST"])
def zettpay_webhook():
    """Recebe notificações da ZettPay (público). Anti-replay + verificação dupla."""
    raw = request.get_data() or b""
    fp = hashlib.md5(raw).hexdigest()
    try:
        body = json.loads(raw.decode() or "{}")
    except Exception:
        body = {}
    data = body.get("data") or {}
    external_id = data.get("external_id") or ""
    event = body.get("event") or ""
    if not db.enabled():
        return jsonify({"received": True})
    if not db.webhook_seen(fp, external_id, event):   # replay → ignora
        return jsonify({"received": True})
    st = str(data.get("status", "")).upper()
    if external_id.startswith("PRO-") and st in ("PAID", "COMPLETED", "APPROVED"):
        # NUNCA confiar só no webhook: confirma na fonte antes de ativar.
        if pix.enabled():
            res = pix.lookup_deposit(external_id)
            vst = str((res.get("data") or {}).get("status", "")).upper()
            if vst not in ("PAID", "COMPLETED", "APPROVED"):
                print("WEBHOOK VERIFY MISMATCH — bloqueado:", external_id, flush=True)
                return jsonify({"received": True})
        try:
            db.update_payment(external_id, webhook_payload=raw.decode(errors="ignore")[:4000])
        except Exception:
            pass
        _confirm_and_activate(external_id)
    return jsonify({"received": True})


@app.route("/api/admin/billing", methods=["GET"])
@admin_required
def admin_billing_get():
    lims = _plan_limits()
    return jsonify({"price_brl": _pro_price(), "days": _pro_days(), "gateway": pix.enabled(),
                    "limits": lims})


@app.route("/api/admin/billing", methods=["POST"])
@admin_required
def admin_billing_save():
    if not db.enabled():
        return jsonify({"ok": False, "reason": "banco não configurado"}), 500
    b = request.get_json(force=True)
    try:
        price = max(0.0, round(float(b.get("price_brl") or 0), 2))
    except (TypeError, ValueError):
        price = 0.0
    try:
        days = max(1, int(b.get("days") or 30))
    except (TypeError, ValueError):
        days = 30
    db.set_setting("pro_price_brl", str(price))
    db.set_setting("pro_days", str(days))
    # Tetos de geração por plano (img/vid). -1 = ilimitado.
    for key in _LIMIT_DEFAULTS:
        if key in (b.get("limits") or {}):
            try:
                v = int(b["limits"][key])
                db.set_setting("limit_" + key, str(v if v >= 0 else -1))
            except (TypeError, ValueError):
                pass
    return jsonify({"ok": True})


# ── Dispatcher (thread em background) ─────────────────────────────────────────

def _job_finish_completed(job, output):
    """Salva os outputs de um job concluído na biblioteca do dono."""
    outs = (output or {}).get("outputs") or []
    if output and output.get("error"):
        db.update_job(job["id"], status="failed", error=str(output["error"])[:500])
        return
    media = []
    for o in outs:
        try:
            raw = base64.b64decode(o["data"])
            is_vid = (o.get("type") == "video")
            ext, ctype = ("mp4", "video/mp4") if is_vid else ("png", "image/png")
            key = f"{o.get('type','image')}/{uuid.uuid4().hex}.{ext}"
            storage.upload_bytes(key, raw, ctype)
            make_and_store_thumb(key, raw, is_video=is_vid)
            row = db.insert(job["user_id"], key, type=o.get("type", "image"),
                            prompt=job.get("prompt", ""), workflow=job.get("workflow", ""), size=len(raw))
            media.append(row["id"])
        except Exception as e:
            print("JOB SAVE ERROR:", e, flush=True)
    db.update_job(job["id"], status="done", result=json.dumps({"media": media}))


def _advance_active_jobs():
    for job in db.jobs_by_status("processing"):
        rid = job.get("runpod_id")
        if not rid:
            continue
        try:
            r = requests.get(f"{BASE_URL}/status/{rid}", headers=HEADERS, timeout=30)
            d = r.json()
        except Exception:
            continue
        st = (d.get("status") or "").upper()
        if st == "COMPLETED":
            _job_finish_completed(job, d.get("output") or {})
        elif st == "FAILED":
            db.update_job(job["id"], status="failed",
                          error=(json.dumps(d.get("output") or d.get("error") or "")[:500]))


def _dispatch_queued_jobs():
    guard = 0
    while db.count_processing_global() < DISPATCH_LIMIT and guard < DISPATCH_LIMIT + 2:
        guard += 1
        job = db.next_queued_job()
        if not job:
            break
        try:
            r = requests.post(f"{BASE_URL}/run", headers=HEADERS,
                              json={"input": json.loads(job["payload"])}, timeout=30)
            rid = (r.json() or {}).get("id") if r.ok else None
            if rid:
                db.update_job(job["id"], status="processing", runpod_id=rid)
            else:
                db.update_job(job["id"], status="failed", error=f"RunPod {r.status_code}")
        except Exception as e:
            db.update_job(job["id"], status="failed", error=str(e)[:300])


def _dispatch_loop():
    while True:
        try:
            if db.enabled():
                _advance_active_jobs()
                _dispatch_queued_jobs()
        except Exception as e:
            print("DISPATCH LOOP ERROR:", e, flush=True)
        time.sleep(3)


_DISPATCH_STARTED = False


def start_dispatcher():
    global _DISPATCH_STARTED
    if _DISPATCH_STARTED or not (ENDPOINT_ID and API_KEY and db.enabled()):
        return
    _DISPATCH_STARTED = True
    threading.Thread(target=_dispatch_loop, daemon=True, name="job-dispatcher").start()
    print("[dispatcher] fila de jobs iniciada", flush=True)


@app.route("/api/admin/gallery", methods=["POST"])
@login_required
def admin_gallery_save():
    if not db.enabled():
        return jsonify({"ok": False, "reason": "banco não configurado"}), 500
    ids = request.get_json(force=True).get("ids", [])
    persona.save_gallery(uid(), [int(i) for i in ids])
    return jsonify({"ok": True})


@app.route("/api/admin/showcase", methods=["GET"])
@admin_required
def admin_showcase_get():
    return jsonify({"ids": persona.get_showcase(owner_uid())})


@app.route("/api/admin/showcase", methods=["POST"])
@admin_required
def admin_showcase_save():
    if not db.enabled():
        return jsonify({"ok": False, "reason": "banco não configurado"}), 500
    ids = request.get_json(force=True).get("ids", [])
    persona.save_showcase(owner_uid(), [int(i) for i in ids])
    return jsonify({"ok": True})


# inicia o dispatcher da fila (thread única; roda com gunicorn --workers 1)
start_dispatcher()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
