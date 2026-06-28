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
        c.commit()


def insert(r2_key, type="image", prompt="", seed=None, workflow="", folder="Geral"):
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO media (r2_key, type, prompt, seed, workflow, folder) "
                "VALUES (%s, %s, %s, %s, %s, %s) RETURNING *",
                (r2_key, type, prompt, seed, workflow, folder),
            )
            row = cur.fetchone()
        c.commit()
        return row


def list_media(limit=400, offset=0, folder=None, favorite=False, q=None):
    clauses, params = [], []
    if folder:
        clauses.append("folder = %s"); params.append(folder)
    if favorite:
        clauses.append("favorite = TRUE")
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


def folders():
    with _conn() as c:
        with c.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT folder, COUNT(*) AS n FROM media GROUP BY folder ORDER BY folder"
            )
            return cur.fetchall()


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
