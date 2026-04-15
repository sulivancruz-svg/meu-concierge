#!/bin/bash

# Script para adicionar conteúdo ao Google Docs do brainstorm
# Uso: ./add-to-docs.sh "Seção" "Conteúdo" [author]

set -e

# Carregar variáveis de ambiente
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '#' | xargs)
fi

# Validar variáveis
if [ -z "$GOOGLE_DOCS_WEBHOOK" ]; then
  echo "❌ ERRO: GOOGLE_DOCS_WEBHOOK não configurado em .env.local"
  exit 1
fi

if [ -z "$GOOGLE_DOCS_TOKEN" ]; then
  echo "❌ ERRO: GOOGLE_DOCS_TOKEN não configurado em .env.local"
  exit 1
fi

# Parâmetros
SECTION="${1:-Ideias Gerais}"
CONTENT="${2:-}"
AUTHOR="${3:-Claude}"

# Validar conteúdo
if [ -z "$CONTENT" ]; then
  echo "❌ ERRO: Conteúdo não fornecido"
  echo "Uso: $0 \"Seção\" \"Conteúdo\" [author]"
  exit 1
fi

# Enviar para Google Docs
echo "📝 Adicionando à seção '$SECTION'..."

RESPONSE=$(curl -s -X POST "$GOOGLE_DOCS_WEBHOOK" \
  --data-urlencode "section=$SECTION" \
  --data-urlencode "content=$CONTENT" \
  --data-urlencode "token=$GOOGLE_DOCS_TOKEN" \
  --data-urlencode "author=$AUTHOR")

# Verificar resposta
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Conteúdo adicionado com sucesso!"
else
  echo "❌ ERRO ao adicionar conteúdo:"
  echo "$RESPONSE"
  exit 1
fi
