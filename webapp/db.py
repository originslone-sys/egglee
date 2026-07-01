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
            # Pastas como entidade própria (podem existir vazias)
            cur.execute(
                "CREATE TABLE IF NOT EXISTS folders ("
                "id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, "
                "created_at TIMESTAMP DEFAULT NOW())"
            )
            cur.execute("INSERT INTO folders(name) VALUES ('Geral') ON CONFLICT DO NOTHING")
            cur.execute(
                "INSERT INTO folders(name) SELECT DISTINCT folder FROM media "
                "WHERE folder IS NOT NULL ON CONFLICT DO NOTHING"
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
        c.commit()


def insert(r2_key, type="image", prompt="", seed=None, workflow="", folder="Geral", size=0):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO media (r2_key, type, prompt, seed, workflow, folder, size) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *",
                (r2_key, type, prompt, seed, workflow, folder, size),
            )
            row = cur.fetchone()
        c.commit()
        return row


def list_media(limit=400, offset=0, folder=None, favorite=False, q=None, type=None):
    clauses, params = [], []
    if folder:
        clauses.append("folder = %s"); params.append(folder)
    if favorite:
        clauses.append("favorite = TRUE")
    if type:
        clauses.append("type = %s"); params.append(type)
    if q:
        clauses.append("(prompt ILIKE %s OR tags ILIKE %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    params.extend([limit, offset])
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"SELECT * FROM media{where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
                params,
            )
            return cur.fetchall()


def list_folders():
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT f.name AS folder,
                       COALESCE(m.n, 0) AS n
                FROM folders f
                LEFT JOIN (SELECT folder, COUNT(*) n FROM media GROUP BY folder) m
                       ON m.folder = f.name
                ORDER BY (f.name = 'Geral') DESC, f.name
                """
            )
            return cur.fetchall()


def create_folder(name):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("INSERT INTO folders(name) VALUES (%s) ON CONFLICT DO NOTHING", (name,))
        c.commit()


def rename_folder(old, new):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE folders SET name = %s WHERE name = %s", (new, old))
            cur.execute("UPDATE media SET folder = %s WHERE folder = %s", (new, old))
        c.commit()


def delete_folder(name):
    if name == "Geral":
        return
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE media SET folder = 'Geral' WHERE folder = %s", (name,))
            cur.execute("DELETE FROM folders WHERE name = %s", (name,))
        c.commit()


def get(media_id):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM media WHERE id = %s", (media_id,))
            return cur.fetchone()


def keys_for(ids):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("SELECT r2_key FROM media WHERE id = ANY(%s)", (list(ids),))
            return [r[0] for r in cur.fetchall()]


def set_favorite(media_id, value):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE media SET favorite = %s WHERE id = %s", (bool(value), media_id))
        c.commit()


def set_folder(ids, folder):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE media SET folder = %s WHERE id = ANY(%s)", (folder, list(ids)))
        c.commit()


def set_tags(media_id, tags):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE media SET tags = %s WHERE id = %s", (tags, media_id))
        c.commit()


def delete(media_id):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("DELETE FROM media WHERE id = %s", (media_id,))
        c.commit()


def delete_many(ids):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("DELETE FROM media WHERE id = ANY(%s)", (list(ids),))
        c.commit()


# ── Presets de prompt ─────────────────────────────────────────────────────────

def list_presets():
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, name, prompt FROM prompt_presets ORDER BY name")
            return cur.fetchall()


def create_preset(name, prompt):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO prompt_presets(name, prompt) VALUES (%s, %s) RETURNING id",
                (name, prompt),
            )
            row = cur.fetchone()
        c.commit()
        return row


def delete_preset(preset_id):
    with _conn() as c:
        with c.cursor() as cur:
            cur.execute("DELETE FROM prompt_presets WHERE id = %s", (preset_id,))
        c.commit()


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


def stats():
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT COUNT(*) AS total, "
                "COUNT(*) FILTER (WHERE type='image') AS images, "
                "COUNT(*) FILTER (WHERE type='video') AS videos, "
                "COUNT(*) FILTER (WHERE favorite) AS favorites, "
                "COALESCE(SUM(size),0) AS bytes FROM media"
            )
            m = cur.fetchone()
            cur.execute("SELECT COUNT(*) AS n FROM folders")
            f = cur.fetchone()
            cur.execute("SELECT COUNT(*) AS n FROM prompt_presets")
            p = cur.fetchone()
            return {**m, "folders": f["n"], "presets": p["n"]}
