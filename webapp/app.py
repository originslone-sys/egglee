"""
Painel web para gerar imagens/vídeos no endpoint serverless do RunPod.

Hospedado no Railway. Converte ações da interface em chamadas à API do RunPod
e devolve o resultado (imagem/vídeo em base64) para exibição no navegador.

Variáveis de ambiente (configurar no Railway):
  RUNPOD_ENDPOINT_ID   ID do endpoint serverless (ex: 8aq27v70vu8qap)
  RUNPOD_API_KEY       API key do RunPod
"""
import os
import requests
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

# .strip() evita 404/401 por espaço ou quebra de linha colados sem querer.
ENDPOINT_ID = os.environ.get("RUNPOD_ENDPOINT_ID", "").strip()
API_KEY = os.environ.get("RUNPOD_API_KEY", "").strip()

BASE_URL = f"https://api.runpod.ai/v2/{ENDPOINT_ID}"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}


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

    if body.get("face_image_b64"):
        inputs["face_image_b64"] = body["face_image_b64"]
    if body.get("input_image_b64"):
        inputs["input_image_b64"] = body["input_image_b64"]

    payload = {"workflow_name": body["workflow_name"], "inputs": inputs}
    if body.get("character"):
        payload["character"] = body["character"]
    if "video" in body["workflow_name"]:
        payload["timeout"] = 1200
    return payload


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/config")
def config():
    return jsonify({
        "configured": bool(ENDPOINT_ID and API_KEY),
        "has_endpoint": bool(ENDPOINT_ID),
        "has_key": bool(API_KEY),
    })


@app.route("/api/generate", methods=["POST"])
def generate():
    if not (ENDPOINT_ID and API_KEY):
        return jsonify({"error": "Configure RUNPOD_ENDPOINT_ID e RUNPOD_API_KEY no Railway."}), 500

    body = request.get_json(force=True)
    if not body.get("workflow_name"):
        return jsonify({"error": "workflow_name é obrigatório"}), 400

    try:
        r = requests.post(f"{BASE_URL}/run",
                          headers=HEADERS,
                          json={"input": _build_input(body)},
                          timeout=30)
    except requests.RequestException as e:
        return jsonify({"error": f"Falha de rede ao chamar o RunPod: {e}"}), 502

    if r.status_code == 404:
        return jsonify({"error": f"RunPod retornou 404 — verifique o RUNPOD_ENDPOINT_ID "
                                 f"(atual: '{ENDPOINT_ID}'). Confira na página do endpoint."}), 502
    if r.status_code == 401:
        return jsonify({"error": "RunPod retornou 401 — RUNPOD_API_KEY inválida."}), 502
    try:
        return jsonify(r.json()), (200 if r.ok else 502)
    except ValueError:
        return jsonify({"error": f"Resposta inesperada do RunPod ({r.status_code}): {r.text[:300]}"}), 502


@app.route("/api/status/<job_id>")
def status(job_id):
    try:
        r = requests.get(f"{BASE_URL}/status/{job_id}", headers=HEADERS, timeout=30)
        return jsonify(r.json()), (200 if r.ok else 502)
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
