"""Cliente PIX ZettPay — só cash-in (depósito pra ativar o plano Pro).

Env:
  ZETTPAY_BASE_URL     (default https://api.zettpay.io/api)
  ZETTPAY_AUTH_URL     (default https://api.zettpay.io/api/oauth/token)
  ZETTPAY_CLIENT_ID
  ZETTPAY_CLIENT_SECRET
"""
import os
import time
import threading
import requests

BASE = os.environ.get("ZETTPAY_BASE_URL", "https://api.zettpay.io/api").rstrip("/")
AUTH = os.environ.get("ZETTPAY_AUTH_URL", "https://api.zettpay.io/api/oauth/token").strip()
CLIENT_ID = os.environ.get("ZETTPAY_CLIENT_ID", "").strip()
CLIENT_SECRET = os.environ.get("ZETTPAY_CLIENT_SECRET", "").strip()

_token = None
_token_exp = 0.0
_lock = threading.Lock()


def enabled() -> bool:
    return bool(CLIENT_ID and CLIENT_SECRET)


def _get_token():
    global _token, _token_exp
    with _lock:
        if _token and time.time() < _token_exp - 300:   # margem de 5 min
            return _token
        r = requests.post(AUTH, json={"client_id": CLIENT_ID, "client_secret": CLIENT_SECRET},
                          timeout=30)
        r.raise_for_status()
        d = r.json()
        _token = d["access_token"]
        _token_exp = time.time() + int(d.get("expires_in", 3600))
        return _token


def _req(method, endpoint, body=None, idem=None):
    headers = {"Authorization": f"Bearer {_get_token()}", "Content-Type": "application/json"}
    if idem:
        headers["Idempotency-Key"] = idem
    r = requests.request(method, BASE + endpoint, headers=headers, json=body, timeout=40)
    try:
        data = r.json()
    except ValueError:
        data = {}
    return {"ok": r.ok, "data": data, "status": r.status_code}


def create_deposit(amount, external_id, description, payer_name, payer_email, payer_document):
    """Cria a cobrança PIX (cash-in). Devolve {ok, data{id, qr_code, expires_at, status}}."""
    body = {
        "amount": round(float(amount), 2),
        "description": description,
        "external_id": external_id,
        "payer_name": (payer_name or "Cliente")[:120],
        "payer_email": payer_email or "",
        "payer_document": payer_document or "",
        "additional_fields": {"external_id": external_id},
    }
    return _req("POST", "/transactions", body, idem=external_id)


def lookup_deposit(external_id):
    """Consulta a cobrança na ZettPay (verificação dupla antes de creditar)."""
    return _req("GET", f"/transactions/lookup?external_id={external_id}")
