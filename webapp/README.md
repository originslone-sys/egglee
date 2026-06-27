# Painel Web (Railway)

Interface para gerar imagens/vídeos no endpoint serverless do RunPod:
enviar prompts livres, subir foto base para consistência de rosto e ver o resultado.

## Deploy no Railway

O Railway usa **este mesmo repositório**. Como a raiz do repo é o worker do RunPod,
é preciso apontar o serviço do Railway para a pasta `webapp/`:

1. No serviço do Railway → **Settings → Build**
2. Defina **Root Directory** = `webapp`
3. O Railway detecta Python (`requirements.txt`) e usa o `Procfile` automaticamente.

## Variáveis de ambiente (Railway → Variables)

| Variável | Valor |
|---|---|
| `RUNPOD_ENDPOINT_ID` | ID do endpoint serverless (ex: `8aq27v70vu8qap`) |
| `RUNPOD_API_KEY` | sua API key do RunPod |
| `APP_PASSWORD` | (opcional) senha para proteger o painel |

Depois do deploy, abra a URL pública do Railway e use o painel.

## Local (teste)

```bash
cd webapp
pip install -r requirements.txt
export RUNPOD_ENDPOINT_ID=xxxx RUNPOD_API_KEY=yyyy
python app.py   # http://localhost:8000
```
