# Setup: Google Docs + Claude Integration

## 🎯 Objetivo
Integrar o Google Docs do brainstorm com Claude, permitindo que ideias sejam automaticamente adicionadas ao documento.

## 📋 Passo a Passo

### 1️⃣ Criar o Apps Script

1. Abra seu documento Google Docs: https://docs.google.com/document/d/1_AE1N6MVghahkNKFkePbjbpGAKE7oIkr65h_HEa6o8E/edit
2. Clique em **Extensions > Apps Script** (menu superior)
3. Copie todo o conteúdo de `google-apps-script.gs` deste repositório
4. Cole no editor do Apps Script (substitua o código padrão)
5. Salve com Ctrl+S (ou Cmd+S)

### 2️⃣ Deploy como Web App

1. No editor Apps Script, clique em **Deploy > New Deployment**
2. Selecione type: **Web app**
3. Configure:
   - Execute as: **Seu email** (login Google)
   - Who has access: **Anyone**
4. Clique em **Deploy**
5. Copie a URL do Web App gerada (algo como `https://script.google.com/macros/d/...`)

### 3️⃣ Salve a URL no projeto

Crie um arquivo `.env.local` na raiz do projeto:

```env
GOOGLE_DOCS_WEBHOOK=https://script.google.com/macros/s/AKfycbxhwWewXXwPw9V06Cs-nWeqfAytVKqsi7POAIQ8VgqHsjRRDW4CXCnVqSAR9ZiXloRl/exec
GOOGLE_DOCS_TOKEN=meu-concierge-brainstorm-2026
```

## 🚀 Como Usar

### Via Claude Code

No terminal ou chat do Claude Code, você pode fazer:

```bash
# Exemplo: Adicionar uma ideia
curl -X POST "${GOOGLE_DOCS_WEBHOOK}" \
  -d "section=Ideias&content=Nova funcionalidade de dashboard&token=${GOOGLE_DOCS_TOKEN}&author=Claude"
```

### Via Mensagem para Claude

Você pode simplesmente digitar no chat:
```
Claude, adiciona isso ao brainstorm docs:
- Nova feature: autenticação OAuth
- Prioridade: Alta
- Status: Em análise
```

E Claude automaticamente enviará para o Google Docs.

## 🔐 Segurança

- **Token**: `meu-concierge-brainstorm-2026` (mude para algo mais seguro)
- O Web App requer o token para funcionionar
- Apenas requisições com token válido conseguem escrever

## 📝 Estrutura do Documento

O script organiza automaticamente em seções:
- **Ideias** - Novas ideias do projeto
- **Implementações em Progresso** - O que está sendo desenvolvido
- **Arquitetura** - Decisões arquiteturais
- **Bugs/Correções** - Problemas encontrados
- Outras seções conforme necessário

## ✅ Checklist de Setup

- [ ] Apps Script criado no Google Docs
- [ ] Código colado e salvo
- [ ] Web App deployado
- [ ] URL do webhook copiada
- [ ] `.env.local` criado com webhook e token
- [ ] Teste feito (enviar uma ideia de teste)

## 🧪 Teste Rápido

Abra o terminal e rode:

```bash
TOKEN="meu-concierge-brainstorm-2026"
WEBHOOK="[sua-url-aqui]"

curl -X POST "${WEBHOOK}" \
  -d "section=Teste&content=Mensagem de teste do Claude&token=${TOKEN}&author=Test"
```

Se funcionar, você verá a mensagem aparecer no Google Docs em segundos!

## 📞 Suporte

Se tiver problemas:
1. Verifique se o Apps Script foi salvo
2. Confirme se o Web App está deployado (tem uma URL pública)
3. Teste manualmente no editor Apps Script: `testAddContent()`
4. Verifique os logs: **Executions** na sidebar do Apps Script
