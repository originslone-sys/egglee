#!/usr/bin/env python3
"""
Galeria visual para revisar o dataset de treino numa Pod RunPod.
Mostra as imagens em grade; cada uma tem botão "deletar".

Uso (na pod):
  export WORKSPACE=/workspace
  wget -qO /tmp/review.py https://raw.githubusercontent.com/originslone-sys/egglee/claude/inspiring-ramanujan-j5qm8z/training/review.py
  python3 /tmp/review.py
Depois abra: Connect -> HTTP Service [Port 8189]
Só usa a biblioteca padrão do Python (sem instalar nada).
"""
import os
import html
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

WORKSPACE = os.environ.get("WORKSPACE", "/workspace")
FOLDER = os.environ.get("DATASET_DIR", f"{WORKSPACE}/egglee-train/img/10_eg1woman")
PORT = int(os.environ.get("PORT", 8189))
EXTS = (".png", ".jpg", ".jpeg")


def list_images():
    if not os.path.isdir(FOLDER):
        return []
    return sorted(f for f in os.listdir(FOLDER) if f.lower().endswith(EXTS))


PAGE = """<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Revisar dataset</title><style>
body{{background:#0d1117;color:#e6edf3;font-family:sans-serif;margin:0;padding:20px}}
h1{{font-size:18px}} .info{{color:#8b949e;margin-bottom:16px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}}
.cell{{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:8px;text-align:center}}
.cell img{{width:100%;border-radius:5px}}
.del{{display:inline-block;margin-top:6px;padding:5px 10px;background:#21262d;color:#f85149;
border:1px solid #30363d;border-radius:6px;text-decoration:none;font-size:13px}}
.del:hover{{border-color:#f85149}}
</style></head><body>
<h1>Revisar dataset — {n} imagens</h1>
<div class="info">Pasta: {folder}<br>Apague as imagens em que o rosto ficou diferente do âncora. Quando terminar, feche e rode o treino.</div>
<div class="grid">{cells}</div>
</body></html>"""


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, ctype, body):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)

        if parsed.path == "/img":
            name = os.path.basename(qs.get("name", [""])[0])
            path = os.path.join(FOLDER, name)
            if os.path.isfile(path):
                with open(path, "rb") as fh:
                    self._send(200, "image/png", fh.read())
            else:
                self._send(404, "text/plain", b"not found")
            return

        if parsed.path == "/delete":
            name = os.path.basename(qs.get("name", [""])[0])
            path = os.path.join(FOLDER, name)
            if os.path.isfile(path) and path.lower().endswith(EXTS):
                os.remove(path)
            self.send_response(303)
            self.send_header("Location", "/")
            self.end_headers()
            return

        # index
        imgs = list_images()
        cells = ""
        for f in imgs:
            e = html.escape(f)
            q = urllib.parse.quote(f)
            cells += (f'<div class="cell"><img src="/img?name={q}" loading="lazy">'
                      f'<a class="del" href="/delete?name={q}">🗑 deletar</a>'
                      f'<div style="font-size:11px;color:#8b949e">{e}</div></div>')
        page = PAGE.format(n=len(imgs), folder=html.escape(FOLDER), cells=cells)
        self._send(200, "text/html; charset=utf-8", page.encode())

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"Pasta: {FOLDER}")
    print(f"Galeria em http://0.0.0.0:{PORT}  (Connect -> HTTP Port {PORT})")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
