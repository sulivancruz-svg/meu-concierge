# INSTRUÇÕES PARA CLAUDE: Como Adicionar Conteúdo ao Google Docs do Brainstorm

**LEIA ISSO ANTES DE FAZER QUALQUER REQUISIÇÃO AO GOOGLE DOCS DO BRAINSTORM.**

Este arquivo contém instruções DETALHADAS para qualquer conversa Claude que precise adicionar, atualizar ou registrar conteúdo no Google Docs compartilhado de brainstorm do projeto meu-concierge.

---

## 🎯 O QUE VOCÊ ESTÁ FAZENDO

Você está enviando informações para um **Google Docs remoto** que é compartilhado entre Guilherme (Mac) e seu supervisor. O documento armazena:
- Ideias de novas features
- Status de implementações em progresso
- Decisões arquiteturais
- Bugs encontrados
- Qualquer outra informação importante do projeto

---

## 📍 INFORMAÇÕES CRÍTICAS

### URL do Webhook Google Apps Script
```
https://script.google.com/macros/s/AKfycbxhwWewXXwPw9V06Cs-nWeqfAytVKqsi7POAIQ8VgqHsjRRDW4CXCnVqSAR9ZiXloRl/exec
```
**ESTA URL NÃO MUDA. USE SEMPRE ESSA.**

### Token de Segurança
```
meu-concierge-brainstorm-2026
```
**ESTE TOKEN NÃO MUDA. USE SEMPRE ESSE.**

### ID do Google Docs
```
1_AE1N6MVghahkNKFkePbjbpGAKE7oIkr65h_HEa6o8E
```

### Variáveis de Ambiente Locais
Se existir um arquivo `.env.local` na raiz do projeto, ele conterá:
```env
GOOGLE_DOCS_WEBHOOK=https://script.google.com/macros/s/AKfycbxhwWewXXwPw9V06Cs-nWeqfAytVKqsi7POAIQ8VgqHsjRRDW4CXCnVqSAR9ZiXloRl/exec
GOOGLE_DOCS_TOKEN=meu-concierge-brainstorm-2026
```

---

## 🔧 COMO ENVIAR CONTEÚDO

### Método 1: cURL via Bash (RECOMENDADO)

```bash
curl -X POST "https://script.google.com/macros/s/AKfycbxhwWewXXwPw9V06Cs-nWeqfAytVKqsi7POAIQ8VgqHsjRRDW4CXCnVqSAR9ZiXloRl/exec" \
  -d "section=Ideias&content=Sua+ideia+aqui&token=meu-concierge-brainstorm-2026&author=Claude"
```

**Quebra do comando:**
- `-X POST`: Método HTTP POST
- URL: O webhook exato do Google Apps Script
- `-d "..."`: Dados a enviar (form-encoded)
  - `section=...`: A seção onde adicionar (ex: "Ideias", "Bugs", "Implementações")
  - `content=...`: O conteúdo real a adicionar
  - `token=...`: SEMPRE use `meu-concierge-brainstorm-2026`
  - `author=...`: Quem está adicionando (ex: "Claude", seu nome, etc)

### Método 2: PowerShell via Windows

```powershell
.\brainstorm\add-to-docs.ps1 -Section "Ideias" -Content "Sua ideia aqui" -Author "Claude"
```

### Método 3: Bash Script via Mac/Linux

```bash
./brainstorm/add-to-docs.sh "Ideias" "Sua ideia aqui" "Claude"
```

---

## 📝 ESTRUTURA DO CONTEÚDO

Quando você adicionar conteúdo, use este formato para máxima clareza:

```
[CATEGORIA] Título da ideia/problema
Descrição detalhada do que é
Impacto: Alto/Médio/Baixo
Status: Análise/Em progresso/Bloqueado/Concluído
Próximos passos: O que fazer depois
```

### Exemplo Real:
```
[FEATURE] Dashboard com Métricas de Agências
O supervisor solicitou um dashboard que mostre métricas agregadas de todas as agências.
Impacto: Alto - Melhora visibilidade operacional
Status: Em análise
Próximos passos: Entender requisitos de permissão e fonte de dados
```

---

## 🚨 VALIDAÇÃO ANTES DE ENVIAR

ANTES de fazer o POST, verifique:

- [ ] A URL do webhook está exata: `https://script.google.com/macros/s/AKfycbxhwWewXXwPw9V06Cs-nWeqfAytVKqsi7POAIQ8VgqHsjRRDW4CXCnVqSAR9ZiXloRl/exec`
- [ ] O token é exato: `meu-concierge-brainstorm-2026`
- [ ] O `section` (seção) faz sentido (Ideias, Bugs, Implementações, etc)
- [ ] O `content` tem informação útil e estruturada
- [ ] O `author` está preenchido
- [ ] Você está no diretório raiz do projeto ou usando caminhos absolutos

---

## ✅ RESPOSTA ESPERADA

Se tudo funcionou corretamente, você receberá uma resposta JSON assim:

```json
{"success":true,"message":"Conteúdo adicionado à seção \"Ideias\""}
```

Se FALHAR, receberá:

```json
{"success":false,"error":"Descrição do erro"}
```

### Erros Comuns:

| Erro | Causa | Solução |
|------|-------|--------|
| `Token inválido` | Token diferente de `meu-concierge-brainstorm-2026` | Copie o token exato |
| `Conteúdo não fornecido` | Campo `content` vazio ou ausente | Adicione `content=...` no curl |
| `Cannot read properties of undefined` | Google Apps Script desatualizado | Peça a Guilherme para atualizar |
| Connection refused | Webhook errado ou servidor down | Verifique a URL exata |

---

## 🔄 FLUXO COMPLETO DE EXEMPLO

Cenário: Você (Claude) recebe uma ideia nova e quer adicioná-la ao brainstorm.

```bash
# 1. Preparar a ideia em formato estruturado
IDEIA="[FEATURE] Sistema de Notificações
Implementar sistema de notificações em tempo real para agências.
Impacto: Alto - Melhora engajamento dos usuários
Status: Backlog - Aguardando priorização
Próximos passos: Revisar requisitos de escopo"

# 2. Converter espaços em +
# (curl automaticamente converte quando usa -d)

# 3. Executar o curl
curl -X POST "https://script.google.com/macros/s/AKfycbxhwWewXXwPw9V06Cs-nWeqfAytVKqsi7POAIQ8VgqHsjRRDW4CXCnVqSAR9ZiXloRl/exec" \
  -d "section=Ideias&content=${IDEIA}&token=meu-concierge-brainstorm-2026&author=Claude"

# 4. Você receberá resposta
# {"success":true,"message":"Conteúdo adicionado à seção \"Ideias\""}

# 5. Confirmar ao usuário que foi adicionado
```

---

## 🎓 QUANDO ADICIONAR AO BRAINSTORM

Adicione ao Google Docs quando:

✅ Uma ideia nova é sugerida pelo usuário
✅ Um problema/bug é identificado
✅ Uma decisão arquitetural é tomada
✅ Um status importante muda
✅ Há análise que precisa ser registrada

❌ NÃO adicione logs de depuração
❌ NÃO adicione dados sensíveis (senhas, tokens)
❌ NÃO adicione spam ou testes

---

## 📞 TROUBLESHOOTING AVANÇADO

Se o curl retorna erro, tente:

```bash
# 1. Testar se a URL está acessível
curl -I "https://script.google.com/macros/s/AKfycbxhwWewXXwPw9V06Cs-nWeqfAytVKqsi7POAIQ8VgqHsjRRDW4CXCnVqSAR9ZiXloRl/exec"

# 2. Fazer POST vazio com verbose para debug
curl -v "https://script.google.com/macros/s/AKfycbxhwWewXXwPw9V06Cs-nWeqfAytVKqsi7POAIQ8VgqHsjRRDW4CXCnVqSAR9ZiXloRl/exec" \
  -d "token=meu-concierge-brainstorm-2026"

# 3. Verificar se Google Apps Script está online
# (Peça a Guilherme para verificar Extensions > Apps Script > Executions)
```

---

## 📚 REFERÊNCIAS

- **Google Docs**: https://docs.google.com/document/d/1_AE1N6MVghahkNKFkePbjbpGAKE7oIkr65h_HEa6o8E/edit
- **Arquivo setup no projeto**: `/brainstorm/SETUP.md`
- **Setup Windows**: `/brainstorm/SETUP-WINDOWS.md`
- **Script Python alternativo**: `/brainstorm/add-to-docs.sh` (Mac/Linux)
- **Script PowerShell alternativo**: `/brainstorm/add-to-docs.ps1` (Windows)

---

## 🚀 RESUMO RÁPIDO

Se você só quer o comando para copiar/colar:

```bash
curl -X POST "https://script.google.com/macros/s/AKfycbxhwWewXXwPw9V06Cs-nWeqfAytVKqsi7POAIQ8VgqHsjRRDW4CXCnVqSAR9ZiXloRl/exec" \
  -d "section=Ideias&content=DESCREVA_SUA_IDEIA_AQUI&token=meu-concierge-brainstorm-2026&author=Claude"
```

Substitua `DESCREVA_SUA_IDEIA_AQUI` pelo conteúdo real.

---

**Última atualização**: 2026-04-15
**Válido para**: Todas as conversas futuras neste projeto
