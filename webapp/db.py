"""Banco Postgres para metadados da biblioteca de mídia."""
import os
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = (os.environ.get("DATABASE_URL", "").strip()
                or os.environ.get("DATABASE_PUBLIC_URL", "").strip())


def enabled() -> bool:
    return bool(DATABASE_URL)


def _conn():
    return psycopg2.connect(DATABASE_URL)


def init():
    if not enabled():
        return
    with _conn() as c, c.cursor() as cur:
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
                created_at TIMESTAMP DEFAULT NOW()
            )
            """
        )
        c.commit()


def insert(r2_key, type="image", prompt="", seed=None, workflow="", folder="Geral"):
    with _conn() as c, c.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "INSERT INTO media (r2_key, type, prompt, seed, workflow, folder) "
            "VALUES (%s, %s, %s, %s, %s, %s) RETURNING *",
            (r2_key, type, prompt, seed, workflow, folder),
        )
        row = cur.fetchone()
        c.commit()
        return row


def list_media(limit=200, offset=0):
    with _conn() as c, c.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT * FROM media ORDER BY created_at DESC LIMIT %s OFFSET %s",
            (limit, offset),
        )
        return cur.fetchall()


def get(media_id):
    with _conn() as c, c.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT * FROM media WHERE id = %s", (media_id,))
        return cur.fetchone()


def delete(media_id):
    with _conn() as c, c.cursor() as cur:
        cur.execute("DELETE FROM media WHERE id = %s", (media_id,))
        c.commit()
