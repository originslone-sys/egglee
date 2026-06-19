#!/usr/bin/env bash
# ============================================================
# Cria as tabelas da egglee no MySQL usando as credenciais do .env.
#
# Uso:
#   bash database/setup.sh
#
# Na Hostinger: o banco e o usuário já existem (criados no hPanel).
# Este script só importa o schema (CREATE TABLE ...).
#
# Conexão remota (de fora da Hostinger): no hPanel ative "Remote MySQL"
# e use o host remoto que ele mostrar em DB_HOST. Rodando DENTRO da
# Hostinger (SSH), DB_HOST=localhost.
# ============================================================
set -euo pipefail

# carrega .env
if [ -f .env ]; then
  set -a; . ./.env; set +a
else
  echo "Erro: .env não encontrado. Copie de .env.example e preencha." >&2
  exit 1
fi

: "${DB_HOST:?defina DB_HOST no .env}"
: "${DB_NAME:?defina DB_NAME no .env}"
: "${DB_USER:?defina DB_USER no .env}"
: "${DB_PASS:?defina DB_PASS no .env}"

echo "Importando schema em ${DB_NAME} @ ${DB_HOST}..."
mysql --host="${DB_HOST}" --port="${DB_PORT:-3306}" \
      --user="${DB_USER}" --password="${DB_PASS}" \
      --default-character-set=utf8mb4 \
      "${DB_NAME}" < database/schema.sql

echo "✓ Tabelas criadas. Próximo: criar o usuário admin (veja database/create-admin.md)."
