"""
Painel web para gerar imagens/vídeos no endpoint serverless do RunPod.

Hospedado no Railway. Converte ações da interface em chamadas à API do RunPod
e devolve o resultado (imagem/vídeo em base64) para exibição no navegador.

Variáveis de ambiente (configurar no Railway):
  RUNPOD_ENDPOINT_ID   ID do endpoint serverless (ex: 8aq27v70vu8qap)
  RUNPOD_API_KEY       API key do RunPod
  APP_PASSWORD         (opcional) senha para proteger o painel
"""
import os
import requests
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

ENDPOINT_ID = os.environ.get("RUNPOD_ENDPOINT_ID", "")
API_KEY = os.environ.get("RUNPOD_API_KEY", "")
APP_PASSWORD = os.environ.get("APP_PASSWORD", "")

BASE_URL = f"https://api.runpod.io/v2/{ENDPOINT_ID}"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}


def _auth_ok() -> bool:
    if not APP_PASSWORD:
        return True
    return request.headers.get("X-App-Password", "") == APP_PASSWORD


def _build_input(body: dict) -> dict:
    inputs = {}

    if body.get("prompt"):
        inputs["positive_prompt"] = body["prompt"]
    if body.get("negative_prompt"):
        inputs["negative_prompt"] = body["negative_prompt"]

    seed = body.get("seed")
    inputs["seed"] = int(seed) if str(seed).lstrip("-").isdigit() else -1

    if body.get("face_image_b64"):
        inputs["face_image_b64"] = body["face_image_b64"]
    if body.get("input_image_b64"):
        inputs["input_image_b64"] = body["input_image_b64"]

    payload = {"workflow_name": body["workflow_name"], "inputs": inputs}
    if body.get("character"):
        payload["character"] = body["character"]
    # Vídeos demoram mais; dá folga no timeout do worker.
    if "video" in body["workflow_name"]:
        payload["timeout"] = 1200
    return payload


@app.route("/")
def index():
    return render_template("index.html", needs_password=bool(APP_PASSWORD))


@app.route("/api/config")
def config():
    return jsonify({
        "configured": bool(ENDPOINT_ID and API_KEY),
        "endpoint_id": ENDPOINT_ID[:4] + "…" if ENDPOINT_ID else "",
    })


@app.route("/api/generate", methods=["POST"])
def generate():
    if not _auth_ok():
        return jsonify({"error": "unauthorized"}), 401
    if not (ENDPOINT_ID and API_KEY):
        return jsonify({"error": "RUNPOD_ENDPOINT_ID/RUNPOD_API_KEY não configurados"}), 500

    body = request.get_json(force=True)
    if not body.get("workflow_name"):
        return jsonify({"error": "workflow_name é obrigatório"}), 400

    try:
        r = requests.post(f"{BASE_URL}/run",
                          headers=HEADERS,
                          json={"input": _build_input(body)},
                          timeout=30)
        return jsonify(r.json()), r.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/status/<job_id>")
def status(job_id):
    if not _auth_ok():
        return jsonify({"error": "unauthorized"}), 401
    try:
        r = requests.get(f"{BASE_URL}/status/{job_id}", headers=HEADERS, timeout=30)
        return jsonify(r.json()), r.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port)
