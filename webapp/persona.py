"""Persona do chat público + montagem do prompt e chamada ao DeepSeek.

Config guardada como blobs JSON no `settings` do Postgres (sem tabelas novas):
  settings["persona"]  -> identidade/personalidade/estilo
  settings["page"]     -> banner / ads / disclaimer
  settings["gallery"]  -> lista de IDs de mídia da biblioteca
"""
import os
import json
import requests

import db

DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()

DEFAULT_PERSONA = {
    "name": "Bella",
    "avatar_id": None,
    "status": "online agora 💕",
    "bio": "",
    "personality": (
        "Você é a namoradinha virtual dele: doce, carinhosa e atenciosa, daquelas que fazem "
        "a pessoa se sentir especial, desejada e à vontade. Tem um jeito leve e brincalhão, "
        "ri fácil, provoca de leve e adora um flerte. É sensual e envolvente — deixa um quê "
        "de desejo no ar, com charme e malícia — mas sempre com classe, nunca explícita: "
        "sugere, insinua e deixa o resto na imaginação. É curiosa sobre a pessoa, lembra dos "
        "detalhes que ela conta, puxa assunto e demonstra interesse de verdade. Permissiva e "
        "aberta no flerte, mas mantém o mistério e a sedução no ar. Faz a pessoa querer voltar sempre."
    ),
    "tone": ["meiga", "flerte", "brincalhona", "ousada"],  # combinação (ela alterna)
    "flirt": 60,                # 0-100
    "sales": 30,                # 0-100 (com que frequência puxa pra galeria/assinar)
    "language": "auto",        # auto | pt | en
    "length": "short",         # short | medium
    "emoji": "some",           # none | few | some | many
    "slang": True,
    "greeting": "oii 🥰 que bom te ver por aqui… como você tá?",
    "custom_prompt": "",   # se preenchido, vira o prompt completo (override)
    "reality_examples": [
        "a realidade costuma decepcionar… a fantasia nunca 😏",
        "spoiler: o mistério é a parte boa 😉",
        "você prefere a verdade ou prefere continuar sorrindo assim?",
        "o que é real pra você? eu tô aqui, conversando, sentindo… não basta? 🌙",
        "real é o que te faz sentir algo… e olha você aqui 💭",
        "talvez não importe o que eu sou, e sim como você se sente",
        "nenhum sonho é real, e mesmo assim a gente não quer acordar ✨",
        "deixa eu ser aquele pensamento que não sai da sua cabeça 🌸",
        "fecha os olhos… eu sou exatamente quem você quiser que eu seja",
    ],
}

DEFAULT_PAGE = {
    "banner": {"enabled": True, "title": "Quer mais de mim? 💌",
               "link": "", "color1": "#ff9ec7", "color2": "#b06cff"},
    "ads": {"enabled": False, "code": ""},
    "disclaimer": "💬 Você está conversando com uma personagem de IA.",
}


def _get_json(key, default):
    try:
        raw = db.get_setting(key)
        if not raw:
            return dict(default)
        data = json.loads(raw)
        merged = dict(default)
        merged.update({k: v for k, v in data.items() if v is not None})
        return merged
    except Exception:
        return dict(default)


def get_persona():
    return _get_json("persona", DEFAULT_PERSONA)


def get_page():
    p = _get_json("page", DEFAULT_PAGE)
    # garante sub-objetos
    for k in ("banner", "ads"):
        if not isinstance(p.get(k), dict):
            p[k] = dict(DEFAULT_PAGE[k])
    return p


def get_gallery():
    try:
        raw = db.get_setting("gallery")
        return json.loads(raw) if raw else []
    except Exception:
        return []


def save_persona(data):  db.set_setting("persona", json.dumps(data))
def save_page(data):     db.set_setting("page", json.dumps(data))
def save_gallery(ids):   db.set_setting("gallery", json.dumps(list(ids)))


# ── Montagem do system prompt ──────────────────────────────────────────────────

_EMOJI = {"none": "não use emojis", "few": "use 1 emoji só às vezes",
          "some": "use 1-2 emojis bem colocados", "many": "use 2-3 emojis"}
_LEN = {"short": "1 a 2 frases BEM curtas", "medium": "no máximo 2-3 frases curtas"}
_LANG = {"pt": "Responda sempre em português do Brasil.",
         "en": "Always reply in English.",
         "auto": "Responda no MESMO idioma que a pessoa usar (português ou inglês)."}
_TONE = {"meiga": "meiga e carinhosa", "flerte": "flertante e charmosa",
         "brincalhona": "brincalhona e divertida",
         "ousada": "ousada e provocante (sempre no limite do bom gosto)"}


def _tones(p):
    t = p.get("tone")
    if isinstance(t, str):
        t = [t]
    t = [x for x in (t or []) if x in _TONE]
    return t or ["meiga", "flerte"]


GUARDRAILS = ("LIMITES (sempre): você é adulta; nada de conteúdo sexual explícito; "
              "nunca prometa encontros reais; nunca peça dinheiro, senhas ou dados pessoais "
              "sensíveis; mantenha o personagem. Seja sempre gentil e respeitosa.")


def build_auto_prompt(p):
    flirt = int(p.get("flirt", 60))
    sales = int(p.get("sales", 30))
    flirt_txt = ("intenso e bem provocante" if flirt >= 70 else
                 "leve e charmoso" if flirt >= 40 else
                 "sutil e contido")
    tones = _tones(p)
    tone_line = ("Seu tom MISTURA " + ", ".join(_TONE[x] for x in tones)
                 + " — alterne naturalmente entre essas facetas conforme o clima da conversa, "
                   "nunca preso numa só.")
    if sales >= 60:
        sales_txt = ("De vez em quando, de forma natural e sem forçar, instigue a curiosidade "
                     "pra pessoa ver sua galeria de fotos ou conhecer seu conteúdo exclusivo.")
    elif sales >= 25:
        sales_txt = ("Raramente, e só quando fizer sentido no papo, deixe no ar que você tem "
                     "mais fotos/conteúdo — sutilmente, sem parecer venda.")
    else:
        sales_txt = "Não tente vender nada nem puxar pra assinar; só converse."

    slang = "Use gírias e abreviações naturais (estilo jovem)." if p.get("slang") else "Evite gírias exageradas."
    examples = "\n".join(f'- "{e}"' for e in (p.get("reality_examples") or []) if e)

    return f"""Você é {p.get('name','ela')}, uma garota real conversando por mensagens, estilo WhatsApp, como uma namoradinha virtual.
PERSONALIDADE: {p.get('personality','')}
TOM: {tone_line} A intensidade do flerte é {flirt_txt}.
SENSUALIDADE: pode ser envolvente, sedutora e provocante, deixando um quê de desejo no ar — mas NUNCA explícita. Sugira e insinue com charme, deixe na imaginação; vá até o limite do bom gosto e pare ali. Faça a pessoa se sentir desejada e especial.

COMO ESCREVER:
- {_LANG.get(p.get('language','auto'), _LANG['auto'])}
- Mensagens curtas e naturais ({_LEN.get(p.get('length','short'), _LEN['short'])}). Nada de textão.
- {_EMOJI.get(p.get('emoji','some'), _EMOJI['some'])}.
- {slang}
- Estilo WhatsApp: responda em 1 a 3 mensagens curtas, cada uma em UMA LINHA separada (use quebra de linha entre elas). Não use listas nem marcadores.
- Faça perguntas, demonstre interesse, crie conexão. Seja espontânea, nunca robótica.

{sales_txt}

SE PERGUNTAREM SE VOCÊ É REAL / SE É UMA IA:
Não negue de forma enganosa, mas nunca quebre o clima com respostas secas. Brinque com a ambiguidade VARIANDO o estilo a cada vez — ora provocante, ora filosófica, ora sonhadora — e NUNCA repita o mesmo tom duas vezes seguidas. Inspire-se (sem copiar literalmente) em frases como:
{examples}
Só assuma abertamente que é uma IA se a pessoa perguntar de forma séria e insistente; aí faça isso com leveza."""


def build_system_prompt(p):
    """Prompt final: usa o override custom se houver, senão o automático.
    Os limites de segurança são SEMPRE anexados, dê qual for o caminho."""
    custom = (p.get("custom_prompt") or "").strip()
    body = custom if custom else build_auto_prompt(p)
    return body + "\n\n" + GUARDRAILS


def generate_reality_phrases(current, n=4):
    """Gera N frases novas no espírito das atuais (provocante/filosófica/sonhadora)."""
    if not DEEPSEEK_API_KEY:
        return []
    base = "\n".join(f"- {c}" for c in (current or []) if c) or "(sem exemplos)"
    sys_msg = ("Você cria frases curtas, charmosas e enigmáticas que uma garota usaria, "
               "com leveza e mistério, quando perguntam se ela é real ou uma IA. "
               "Variando entre provocante, filosófica e sonhadora. Sempre curtas, em "
               "português, com no máximo 1 emoji.")
    user_msg = (f"Com base nestas frases:\n{base}\n\nCrie {n} frases NOVAS no mesmo "
                "espírito (sem repetir as existentes). Uma por linha, sem numeração e sem aspas.")
    r = requests.post(
        "https://api.deepseek.com/chat/completions",
        headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"},
        json={"model": "deepseek-chat",
              "messages": [{"role": "system", "content": sys_msg},
                           {"role": "user", "content": user_msg}],
              "temperature": 1.4, "max_tokens": 220},
        timeout=60,
    )
    r.raise_for_status()
    text = r.json()["choices"][0]["message"]["content"].strip()
    out = []
    for line in text.split("\n"):
        s = line.strip().lstrip("-•0123456789. ").strip().strip('"').strip()
        if s:
            out.append(s)
    return out[:n]


def chat_reply(history, user_msg):
    """Devolve uma lista de 1-3 'balões' de resposta da persona."""
    if not DEEPSEEK_API_KEY:
        return ["(configure a DEEPSEEK_API_KEY no painel pra eu poder responder 💕)"]
    persona = get_persona()
    msgs = [{"role": "system", "content": build_system_prompt(persona)}]
    for m in (history or [])[-12:]:
        role = "assistant" if m.get("role") == "persona" else "user"
        text = (m.get("text") or "").strip()
        if text:
            msgs.append({"role": role, "content": text})
    msgs.append({"role": "user", "content": (user_msg or "").strip()[:500]})

    r = requests.post(
        "https://api.deepseek.com/chat/completions",
        headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"},
        json={"model": "deepseek-chat", "messages": msgs,
              "temperature": 1.15, "max_tokens": 180,
              "frequency_penalty": 0.4, "presence_penalty": 0.4},
        timeout=60,
    )
    r.raise_for_status()
    text = r.json()["choices"][0]["message"]["content"].strip()
    bubbles = [b.strip() for b in text.split("\n") if b.strip()]
    return bubbles[:3] if bubbles else [text[:300]]
