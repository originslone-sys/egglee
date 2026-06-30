#!/usr/bin/env python3
"""Editor web das legendas — revise no navegador antes de treinar.

Roda na pod (depois do caption.py):
  export WORKSPACE=/workspace
  pip install -q flask
  python caption_editor.py
Abra a porta 7860 da pod (botão Connect da RunPod) no navegador.
"""
import os
import glob
from flask import Flask, request, jsonify, send_file

WORKSPACE = os.environ.get("WORKSPACE", "/workspace")
OUT = f"{WORKSPACE}/egglee-train/captioned"
IMG_EXT = (".png", ".jpg", ".jpeg", ".webp")

app = Flask(__name__)


def images():
    return sorted(os.path.basename(f) for f in glob.glob(f"{OUT}/*") if f.lower().endswith(IMG_EXT))


def txt_path(name):
    return os.path.join(OUT, os.path.splitext(name)[0] + ".txt")


PAGE = """<!DOCTYPE html><html lang=pt-BR><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1"><title>Legendas</title>
<style>
 body{margin:0;background:#0b0d12;color:#e8ebf5;font-family:system-ui,sans-serif}
 header{position:sticky;top:0;background:#11141d;border-bottom:1px solid #242838;padding:14px 18px;display:flex;gap:14px;align-items:center;z-index:5}
 header b{font-size:16px}.muted{color:#888fa6;font-size:13px}
 .save{margin-left:auto;background:linear-gradient(135deg,#8b5cff,#ec4899);border:none;color:#fff;padding:10px 16px;border-radius:9px;font-weight:600;cursor:pointer}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;padding:18px}
 .card{background:#12141d;border:1px solid #242838;border-radius:12px;overflow:hidden}
 .card img{width:100%;aspect-ratio:3/4;object-fit:cover;display:block}
 .card .n{font-size:11px;color:#888fa6;padding:6px 10px 0}
 textarea{width:100%;border:none;border-top:1px solid #242838;background:#0b0d12;color:#e8ebf5;padding:10px;font-size:12.5px;min-height:74px;resize:vertical;font-family:inherit;outline:none}
 textarea:focus{background:#0e1017}
 .tip{padding:0 18px;color:#888fa6;font-size:13px}
 .ok{color:#2fd07a}
</style></head><body>
<header><b>🏷️ Revisar legendas</b><span class=muted id=count></span>
<button class=save onclick=saveAll()>💾 Salvar tudo</button><span class=ok id=msg></span></header>
<div class=tip>Confira que celular/espelho/selfie/roupa/pose estão descritos. O <b>eg1woman</b> deve ficar sempre no começo. Edite e salve.</div>
<div class=grid id=grid></div>
<script>
let data=[];
fetch('/list').then(r=>r.json()).then(d=>{
  data=d.items; document.getElementById('count').textContent=data.length+' fotos';
  document.getElementById('grid').innerHTML=data.map((it,i)=>`
   <div class=card><img src="/img/${encodeURIComponent(it.name)}" loading=lazy>
   <div class=n>${it.name}</div>
   <textarea data-i="${i}">${it.caption.replace(/</g,'&lt;')}</textarea></div>`).join('');
});
async function saveAll(){
  const tas=document.querySelectorAll('textarea');
  const items=[...tas].map(t=>({name:data[t.dataset.i].name, caption:t.value}));
  document.getElementById('msg').textContent='salvando…';
  await fetch('/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})});
  document.getElementById('msg').textContent='✓ salvo';
  setTimeout(()=>document.getElementById('msg').textContent='',2500);
}
</script></body></html>"""


@app.route("/")
def index():
    return PAGE


@app.route("/list")
def lst():
    items = []
    for name in images():
        cap = ""
        if os.path.exists(txt_path(name)):
            cap = open(txt_path(name)).read().strip()
        items.append({"name": name, "caption": cap})
    return jsonify({"items": items})


@app.route("/img/<path:name>")
def img(name):
    p = os.path.join(OUT, name)
    if not os.path.abspath(p).startswith(os.path.abspath(OUT)) or not os.path.exists(p):
        return ("not found", 404)
    return send_file(p)


@app.route("/save", methods=["POST"])
def save():
    for it in request.get_json(force=True).get("items", []):
        name = it.get("name", "")
        if name in images():
            with open(txt_path(name), "w") as f:
                f.write((it.get("caption") or "").strip())
    return jsonify({"ok": True})


if __name__ == "__main__":
    print(f"Servindo legendas de {OUT} em http://0.0.0.0:7860")
    app.run(host="0.0.0.0", port=7860)
