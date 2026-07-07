"""Banco Postgres para metadados da biblioteca de mídia."""
import os
from contextlib import closing
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = (os.environ.get("DATABASE_URL", "").strip()
                or os.environ.get("DATABASE_PUBLIC_URL", "").strip())


def enabled() -> bool:
    return bool(DATABASE_URL)


def _conn():
    return closing(psycopg2.connect(DATABASE_URL))


def init():
    if not enabled():
        return
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS media (
                    id SERIAL PRIMARY KEY,
                    r2_key TEXT NOT NULL,
                    type TEXT DEFAULT 'image',
                    prompt TEXT,
                    seed BIGINT,
                    workflow TEXT,
                    folder TEXT DEFAULT 'Geral',
                    favorite BOOLEAN DEFAULT FALSE,
                    tags TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT NOW()
                )
                """
            )
            # Migração: garante a coluna tags se a tabela já existia
            cur.execute("ALTER TABLE media ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT ''")
            cur.execute("ALTER TABLE media ADD COLUMN IF NOT EXISTS size BIGINT DEFAULT 0")
            # Pastas como entidade própria (por usuário — ver migração abaixo)
            cur.execute(
                "CREATE TABLE IF NOT EXISTS folders ("
                "id SERIAL PRIMARY KEY, name TEXT NOT NULL, "
                "created_at TIMESTAMP DEFAULT NOW())"
            )
            # Presets de prompt (cenas/roupas salvas)
            cur.execute(
                "CREATE TABLE IF NOT EXISTS prompt_presets ("
                "id SERIAL PRIMARY KEY, name TEXT NOT NULL, prompt TEXT NOT NULL, "
                "created_at TIMESTAMP DEFAULT NOW())"
            )
            # Configurações chave/valor (ex: marca d'água)
            cur.execute(
                "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)"
            )
            # Lista de espera / captação de leads da página premium
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS leads (
                    id SERIAL PRIMARY KEY,
                    name TEXT DEFAULT '',
                    email TEXT DEFAULT '',
                    whatsapp TEXT DEFAULT '',
                    source TEXT DEFAULT 'premium',
                    note TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT NOW()
                )
                """
            )
            # Contas de usuário (SaaS multi-tenant — Fase 1)
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    name TEXT DEFAULT '',
                    role TEXT DEFAULT 'user',
                    status TEXT DEFAULT 'active',
                    plan TEXT DEFAULT 'free',
                    created_at TIMESTAMP DEFAULT NOW()
                )
                """
            )
            # slug público (endereço do chat do cliente: /u/<slug>) — Fase 3
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS slug TEXT")
            cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_slug "
                        "ON users(slug) WHERE slug IS NOT NULL")
            # ── Multi-tenant (Fase 2): user_id em tudo + settings por usuário ──
            cur.execute("ALTER TABLE media ADD COLUMN IF NOT EXISTS user_id INTEGER")
            cur.execute("ALTER TABLE folders ADD COLUMN IF NOT EXISTS user_id INTEGER")
            cur.execute("ALTER TABLE prompt_presets ADD COLUMN IF NOT EXISTS user_id INTEGER")
            # remove a unicidade GLOBAL antiga de nome de pasta (agora é por usuário)
            cur.execute("ALTER TABLE folders DROP CONSTRAINT IF EXISTS folders_name_key")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_media_user ON media(user_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_presets_user ON prompt_presets(user_id)")
            # Configurações POR USUÁRIO (persona, página, galeria, vitrine).
            cur.execute(
                "CREATE TABLE IF NOT EXISTS user_settings ("
                "user_id INTEGER NOT NULL, key TEXT NOT NULL, value TEXT, "
                "PRIMARY KEY (user_id, key))"
            )
            # Fila de geração (Fase 4) — cada requisição vira um job persistido.
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    kind TEXT DEFAULT 'image',
                    workflow TEXT DEFAULT '',
                    status TEXT DEFAULT 'queued',
                    priority INTEGER DEFAULT 0,
                    payload TEXT,
                    runpod_id TEXT,
                    prompt TEXT DEFAULT '',
                    batch INTEGER DEFAULT 1,
                    result TEXT,
                    error TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
                """
            )
            cur.execute("CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)")
            # Pagamentos PIX (Fase 5) — só cash-in (ativa o plano Pro)
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS payments (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    external_id TEXT NOT NULL UNIQUE,
                    zettpay_id TEXT,
                    amount_brl NUMERIC(10,2) NOT NULL,
                    plan_days INTEGER DEFAULT 30,
                    status TEXT DEFAULT 'pending',
                    qr_code TEXT,
                    expires_at TIMESTAMP,
                    webhook_payload TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    confirmed_at TIMESTAMP
                )
                """
            )
            cur.execute("CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id)")
            # Anti-replay de webhooks (fingerprint do corpo)
            cur.execute(
                "CREATE TABLE IF NOT EXISTS webhook_log ("
                "fingerprint TEXT PRIMARY KEY, external_id TEXT, event TEXT, "
                "created_at TIMESTAMP DEFAULT NOW())"
            )
            # validade do plano Pro (assinatura por tempo)
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP")
        c.commit()


# ── Mídia / biblioteca (por usuário) ──────────────────────────────────────────

def insert(user_id, r2_key, type="image", prompt="", seed=None, workflow="", folder="Geral", size=0):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO media (user_id, r2_key, type, prompt, seed, workflow, folder, size) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING *",
                (user_id, r2_key, type, prompt, seed, workflow, folder, size),
            )
            row = cur.fetchone()
        c.commit()
        return row


def list_media(user_id, limit=400, offset=0, folder=None, favorite=False, q=None, type=None):
    clauses, params = ["user_id = %s"], [user_id]
    if folder:
        clauses.append("folder = %s"); params.append(folder)
    if favorite:
        clauses.append("favorite = TRUE")
    if type:
        clauses.append("type = %s"); params.append(type)
    if q:
        clauses.append("(prompt ILIKE %s OR tags ILIKE %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    where = " WHERE " + " AND ".join(clauses)
    params.extend([limit, offset])
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"SELECT * FROM media{where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
                params,
            )
            return cur.fetchall()


def ensure_geral(user_id):
    """Garante que o usuário tenha a pasta 'Geral'."""
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(
                "INSERT INTO folders(user_id, name) SELECT %s, 'Geral' "
                "WHERE NOT EXISTS (SELECT 1 FROM folders WHERE user_id = %s AND name = 'Geral')",
                (user_id, user_id),
            )
        c.commit()


def list_folders(user_id):
    ensure_geral(user_id)
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT f.name AS folder, COALESCE(m.n, 0) AS n
                FROM folders f
                LEFT JOIN (SELECT folder, COUNT(*) n FROM media
                           WHERE user_id = %s GROUP BY folder) m
                       ON m.folder = f.name
                WHERE f.user_id = %s
                ORDER BY (f.name = 'Geral') DESC, f.name
                """,
                (user_id, user_id),
            )
            return cur.fetchall()


def create_folder(user_id, name):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(
                "INSERT INTO folders(user_id, name) SELECT %s, %s "
                "WHERE NOT EXISTS (SELECT 1 FROM folders WHERE user_id = %s AND name = %s)",
                (user_id, name, user_id, name),
            )
        c.commit()


def rename_folder(user_id, old, new):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE folders SET name = %s WHERE user_id = %s AND name = %s",
                        (new, user_id, old))
            cur.execute("UPDATE media SET folder = %s WHERE user_id = %s AND folder = %s",
                        (new, user_id, old))
        c.commit()


def delete_folder(user_id, name):
    if name == "Geral":
        return
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE media SET folder = 'Geral' WHERE user_id = %s AND folder = %s",
                        (user_id, name))
            cur.execute("DELETE FROM folders WHERE user_id = %s AND name = %s", (user_id, name))
        c.commit()


def get(media_id, user_id=None):
    """Busca uma mídia. Se user_id for passado, só devolve se pertencer a ele."""
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            if user_id is None:
                cur.execute("SELECT * FROM media WHERE id = %s", (media_id,))
            else:
                cur.execute("SELECT * FROM media WHERE id = %s AND user_id = %s",
                            (media_id, user_id))
            return cur.fetchone()


def keys_for(ids, user_id):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("SELECT r2_key FROM media WHERE id = ANY(%s) AND user_id = %s",
                        (list(ids), user_id))
            return [r[0] for r in cur.fetchall()]


def set_favorite(media_id, value, user_id):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE media SET favorite = %s WHERE id = %s AND user_id = %s",
                        (bool(value), media_id, user_id))
        c.commit()


def set_folder(ids, folder, user_id):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE media SET folder = %s WHERE id = ANY(%s) AND user_id = %s",
                        (folder, list(ids), user_id))
        c.commit()


def set_tags(media_id, tags, user_id):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE media SET tags = %s WHERE id = %s AND user_id = %s",
                        (tags, media_id, user_id))
        c.commit()


def delete(media_id, user_id):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("DELETE FROM media WHERE id = %s AND user_id = %s", (media_id, user_id))
        c.commit()


def delete_many(ids, user_id):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("DELETE FROM media WHERE id = ANY(%s) AND user_id = %s",
                        (list(ids), user_id))
        c.commit()


# ── Presets de prompt (por usuário) ───────────────────────────────────────────

def list_presets(user_id):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, name, prompt FROM prompt_presets "
                        "WHERE user_id = %s ORDER BY name", (user_id,))
            return cur.fetchall()


def create_preset(user_id, name, prompt):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO prompt_presets(user_id, name, prompt) VALUES (%s, %s, %s) RETURNING id",
                (user_id, name, prompt),
            )
            row = cur.fetchone()
        c.commit()
        return row


def delete_preset(preset_id, user_id):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("DELETE FROM prompt_presets WHERE id = %s AND user_id = %s",
                        (preset_id, user_id))
        c.commit()


# ── Settings GLOBAIS (infra: token civitai, caches, checkpoint ativo…) ────────

def get_setting(key, default=None):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("SELECT value FROM settings WHERE key = %s", (key,))
            row = cur.fetchone()
            return row[0] if row else default


def set_setting(key, value):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(
                "INSERT INTO settings(key, value) VALUES (%s, %s) "
                "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                (key, value),
            )
        c.commit()


# ── Settings POR USUÁRIO (persona, página, galeria, vitrine) ──────────────────

def get_user_setting(user_id, key, default=None):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("SELECT value FROM user_settings WHERE user_id = %s AND key = %s",
                        (user_id, key))
            row = cur.fetchone()
            return row[0] if row else default


def set_user_setting(user_id, key, value):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(
                "INSERT INTO user_settings(user_id, key, value) VALUES (%s, %s, %s) "
                "ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value",
                (user_id, key, value),
            )
        c.commit()


# ── Lista de espera (leads) ───────────────────────────────────────────────────

def insert_lead(name="", email="", whatsapp="", source="premium", note=""):
    """Insere um lead. Faz dedupe leve: se já existe o mesmo email OU whatsapp,
    atualiza os dados em vez de criar duplicado. Devolve (row, is_new)."""
    email = (email or "").strip().lower()
    whatsapp = (whatsapp or "").strip()
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            existing = None
            if email or whatsapp:
                cur.execute(
                    "SELECT * FROM leads WHERE (email <> '' AND email = %s) "
                    "OR (whatsapp <> '' AND whatsapp = %s) ORDER BY id LIMIT 1",
                    (email, whatsapp),
                )
                existing = cur.fetchone()
            if existing:
                cur.execute(
                    "UPDATE leads SET name = COALESCE(NULLIF(%s,''), name), "
                    "email = COALESCE(NULLIF(%s,''), email), "
                    "whatsapp = COALESCE(NULLIF(%s,''), whatsapp), "
                    "note = COALESCE(NULLIF(%s,''), note) WHERE id = %s RETURNING *",
                    (name.strip(), email, whatsapp, (note or "").strip(), existing["id"]),
                )
                row = cur.fetchone()
                c.commit()
                return row, False
            cur.execute(
                "INSERT INTO leads (name, email, whatsapp, source, note) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING *",
                (name.strip(), email, whatsapp, source, (note or "").strip()),
            )
            row = cur.fetchone()
        c.commit()
        return row, True


def list_leads(limit=1000):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM leads ORDER BY created_at DESC LIMIT %s", (limit,))
            return cur.fetchall()


def count_leads():
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM leads")
            return cur.fetchone()[0]


def delete_lead(lead_id):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("DELETE FROM leads WHERE id = %s", (lead_id,))
        c.commit()


# ── Usuários (contas / auth) ──────────────────────────────────────────────────

def _norm_email(e):
    return (e or "").strip().lower()


def _slugify(text):
    import re as _re, unicodedata as _ud
    text = _ud.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    text = _re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return text[:32] or "user"


def _unique_slug(cur, base):
    slug = base
    n = 1
    while True:
        cur.execute("SELECT 1 FROM users WHERE slug = %s", (slug,))
        if not cur.fetchone():
            return slug
        n += 1
        slug = f"{base}-{n}"


def create_user(email, password_hash, name="", role="user", plan="free"):
    """Cria um usuário (com slug único). Devolve a row, ou None se o e-mail já existe."""
    email = _norm_email(email)
    base = _slugify(name) if name else _slugify(email.split("@")[0])
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            slug = _unique_slug(cur, base)
            cur.execute(
                "INSERT INTO users (email, password_hash, name, role, plan, slug) "
                "VALUES (%s, %s, %s, %s, %s, %s) "
                "ON CONFLICT (email) DO NOTHING RETURNING *",
                (email, password_hash, (name or "").strip(), role, plan, slug),
            )
            row = cur.fetchone()
        c.commit()
        return row


def get_user_by_slug(slug):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM users WHERE slug = %s", (slug,))
            return cur.fetchone()


def update_user_slug(user_id, slug):
    """Troca o slug do usuário. Devolve True se ok, False se já está em uso."""
    slug = (slug or "").strip().lower()
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("SELECT 1 FROM users WHERE slug = %s AND id <> %s", (slug, user_id))
            if cur.fetchone():
                return False
            cur.execute("UPDATE users SET slug = %s WHERE id = %s", (slug, user_id))
        c.commit()
        return True


def backfill_slugs():
    """Dá slug pros usuários que ainda não têm (ex.: admin criado antes da Fase 3)."""
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, name, email FROM users WHERE slug IS NULL OR slug = ''")
            for u in cur.fetchall():
                base = _slugify(u["name"]) if u["name"] else _slugify((u["email"] or "").split("@")[0])
                slug = _unique_slug(cur, base)
                cur.execute("UPDATE users SET slug = %s WHERE id = %s", (slug, u["id"]))
        c.commit()


def get_user_by_email(email):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM users WHERE email = %s", (_norm_email(email),))
            return cur.fetchone()


def get_user(uid):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM users WHERE id = %s", (uid,))
            return cur.fetchone()


def list_users(limit=1000):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM users ORDER BY created_at DESC LIMIT %s", (limit,))
            return cur.fetchall()


def count_admins():
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
            return cur.fetchone()[0]


def set_user_status(uid, status):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE users SET status = %s WHERE id = %s", (status, uid))
        c.commit()


def set_user_role(uid, role):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE users SET role = %s WHERE id = %s", (role, uid))
        c.commit()


def set_user_plan(uid, plan):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE users SET plan = %s WHERE id = %s", (plan, uid))
        c.commit()


def update_user_password(uid, password_hash):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (password_hash, uid))
        c.commit()


def delete_user(uid):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("DELETE FROM users WHERE id = %s", (uid,))
        c.commit()


def first_admin_id():
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")
            row = cur.fetchone()
            return row[0] if row else None


def backfill_owner(owner_id):
    """Fase 2: atribui ao dono (admin) todos os dados órfãos (user_id NULL) e
    migra as settings globais dele (persona/página/galeria/vitrine) pro per-user.
    Idempotente."""
    if not owner_id:
        return
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE media SET user_id = %s WHERE user_id IS NULL", (owner_id,))
            cur.execute("UPDATE folders SET user_id = %s WHERE user_id IS NULL", (owner_id,))
            cur.execute("UPDATE prompt_presets SET user_id = %s WHERE user_id IS NULL", (owner_id,))
            # migra as chaves per-user do dono do 'settings' global -> 'user_settings'
            for key in ("persona", "page", "gallery", "premium_showcase"):
                cur.execute("SELECT value FROM settings WHERE key = %s", (key,))
                row = cur.fetchone()
                if row:
                    cur.execute(
                        "INSERT INTO user_settings(user_id, key, value) VALUES (%s, %s, %s) "
                        "ON CONFLICT (user_id, key) DO NOTHING",
                        (owner_id, key, row[0]),
                    )
                    cur.execute("DELETE FROM settings WHERE key = %s", (key,))
        c.commit()


# ── Fila de jobs (Fase 4) ─────────────────────────────────────────────────────

def create_job(user_id, kind, workflow, payload, prompt="", batch=1, priority=0):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO jobs (user_id, kind, workflow, payload, prompt, batch, priority) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *",
                (user_id, kind, workflow, payload, prompt[:500], batch, priority),
            )
            row = cur.fetchone()
        c.commit()
        return row


def get_job(job_id, user_id=None):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            if user_id is None:
                cur.execute("SELECT * FROM jobs WHERE id = %s", (job_id,))
            else:
                cur.execute("SELECT * FROM jobs WHERE id = %s AND user_id = %s", (job_id, user_id))
            return cur.fetchone()


def list_jobs(user_id, limit=60):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM jobs WHERE user_id = %s ORDER BY id DESC LIMIT %s",
                        (user_id, limit))
            return cur.fetchall()


def jobs_by_status(status, limit=100):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM jobs WHERE status = %s ORDER BY id LIMIT %s", (status, limit))
            return cur.fetchall()


def active_job_count(user_id):
    """Jobs na fila ou processando (pro limite de concorrência do Pro)."""
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM jobs WHERE user_id = %s "
                        "AND status IN ('queued','processing')", (user_id,))
            return cur.fetchone()[0]


def kind_used_count(user_id, kind, since=None):
    """Já usado de um tipo — ignora falhas. Se 'since' (datetime) for passado,
    conta só a partir dele (cota diária do Pro); senão é o total (vitalício Free)."""
    q = ("SELECT COUNT(*) FROM jobs WHERE user_id = %s AND kind = %s "
         "AND status IN ('queued','processing','done')")
    params = [user_id, kind]
    if since is not None:
        q += " AND created_at >= %s"
        params.append(since)
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(q, params)
            return cur.fetchone()[0]


def count_processing_global():
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM jobs WHERE status = 'processing'")
            return cur.fetchone()[0]


def next_queued_job():
    """Próximo job a despachar: prioridade DESC, mais antigo primeiro."""
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM jobs WHERE status = 'queued' "
                        "ORDER BY priority DESC, id ASC LIMIT 1")
            return cur.fetchone()


def update_job(job_id, **fields):
    if not fields:
        return
    fields["updated_at"] = None  # marca pra usar NOW()
    sets, params = [], []
    for k, v in fields.items():
        if k == "updated_at":
            sets.append("updated_at = NOW()")
        else:
            sets.append(f"{k} = %s"); params.append(v)
    params.append(job_id)
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(f"UPDATE jobs SET {', '.join(sets)} WHERE id = %s", params)
        c.commit()


# ── Pagamentos PIX / plano Pro (Fase 5) ───────────────────────────────────────

def create_payment(user_id, external_id, amount_brl, plan_days):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO payments (user_id, external_id, amount_brl, plan_days) "
                "VALUES (%s, %s, %s, %s) RETURNING *",
                (user_id, external_id, amount_brl, plan_days),
            )
            row = cur.fetchone()
        c.commit()
        return row


def update_payment(external_id, **fields):
    if not fields:
        return
    sets, params = [], []
    for k, v in fields.items():
        sets.append(f"{k} = %s"); params.append(v)
    params.append(external_id)
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(f"UPDATE payments SET {', '.join(sets)} WHERE external_id = %s", params)
        c.commit()


def get_payment(external_id, user_id=None):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            if user_id is None:
                cur.execute("SELECT * FROM payments WHERE external_id = %s", (external_id,))
            else:
                cur.execute("SELECT * FROM payments WHERE external_id = %s AND user_id = %s",
                            (external_id, user_id))
            return cur.fetchone()


def confirm_payment_atomic(external_id):
    """Confirma o pagamento de forma ATÔMICA (só a primeira vez). Devolve a row
    (user_id, plan_days) se confirmou agora, ou None se já estava confirmado."""
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "UPDATE payments SET status = 'confirmed', confirmed_at = NOW() "
                "WHERE external_id = %s AND status = 'pending' "
                "RETURNING user_id, plan_days",
                (external_id,),
            )
            row = cur.fetchone()
        c.commit()
        return row


def activate_pro(user_id, plan_days):
    """Ativa/estende o Pro. Se ainda estiver Pro válido, ESTENDE a partir do fim."""
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(
                "UPDATE users SET plan = 'pro', plan_expires_at = "
                "GREATEST(COALESCE(plan_expires_at, NOW()), NOW()) + (%s || ' days')::interval "
                "WHERE id = %s RETURNING plan_expires_at",
                (int(plan_days), user_id),
            )
            row = cur.fetchone()
        c.commit()
        return row[0] if row else None


def expire_pro_if_needed(user_id):
    """Rebaixa pra free se o Pro venceu. Devolve o plano efetivo."""
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(
                "UPDATE users SET plan = 'free' WHERE id = %s AND plan = 'pro' "
                "AND plan_expires_at IS NOT NULL AND plan_expires_at < NOW()",
                (user_id,),
            )
        c.commit()


def webhook_seen(fingerprint, external_id, event):
    """True se é NOVO (registrou), False se já foi processado (replay)."""
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute(
                "INSERT INTO webhook_log (fingerprint, external_id, event) VALUES (%s, %s, %s) "
                "ON CONFLICT (fingerprint) DO NOTHING",
                (fingerprint, external_id, event),
            )
            new = cur.rowcount > 0
        c.commit()
        return new


def list_payments(user_id, limit=30):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM payments WHERE user_id = %s ORDER BY id DESC LIMIT %s",
                        (user_id, limit))
            return cur.fetchall()


def stats(user_id):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT COUNT(*) AS total, "
                "COUNT(*) FILTER (WHERE type='image') AS images, "
                "COUNT(*) FILTER (WHERE type='video') AS videos, "
                "COUNT(*) FILTER (WHERE favorite) AS favorites, "
                "COALESCE(SUM(size),0) AS bytes FROM media WHERE user_id = %s",
                (user_id,),
            )
            m = cur.fetchone()
            cur.execute("SELECT COUNT(*) AS n FROM folders WHERE user_id = %s", (user_id,))
            f = cur.fetchone()
            cur.execute("SELECT COUNT(*) AS n FROM prompt_presets WHERE user_id = %s", (user_id,))
            p = cur.fetchone()
            return {**m, "folders": f["n"], "presets": p["n"]}
