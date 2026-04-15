# Setup Windows: Google Docs + Claude Integration

## 📋 O que é diferente no Windows?

Basicamente nada! O Google Apps Script e o Google Docs são os mesmos. A única diferença é como rodamos os scripts.

## ✅ Checklist Rápido

- [ ] Google Docs compartilhado com a conta do Claude (Windows)
- [ ] `.env.local` criado na raiz do projeto
- [ ] Testado o envio para o Google Docs

## 🚀 Setup Passo a Passo

### 1️⃣ Compartilhar o Google Docs

O Google Docs já existe (criado no Mac):
https://docs.google.com/document/d/1_AE1N6MVghahkNKFkePbjbpGAKE7oIkr65h_HEa6o8E/edit

**Certifique-se que está compartilhado com a conta Claude do Windows:**
1. Clique em **Compartilhar** (canto superior direito)
2. Adicione o email da conta Claude/Google do Windows
3. Dê permissão de **Editar**

### 2️⃣ Crie `.env.local` no Windows

Na raiz do projeto (`meu-concierge/`), crie um arquivo `.env.local`:

```env
GOOGLE_DOCS_WEBHOOK=https://script.google.com/macros/s/AKfycbyEekvL0bKarL_Q8E9usDThUT38frjC5Z7C-A_1eY2XnJH9Q1CHdXpwUgFbhtRQkhKQ/exec
GOOGLE_DOCS_TOKEN=meu-concierge-brainstorm-2026
```

**Como criar:**
- Abra Notepad
- Cole o conteúdo acima
- Salve como `.env.local` (arquivo sem extensão)
- Coloque na raiz do projeto

### 3️⃣ Teste a Integração

**Opção A: PowerShell (Recomendado)**

```powershell
.\brainstorm\add-to-docs.ps1 -Section "Teste Windows" -Content "Funcionando no Windows!"
```

**Opção B: Batch (cmd.exe)**

```batch
brainstorm\add-to-docs.bat "Teste Windows" "Funcionando no Windows!"
```

**Opção C: cURL direto (Terminal/PowerShell)**

```powershell
$body = @{
    section = "Teste"
    content = "Teste do Windows"
    token = "meu-concierge-brainstorm-2026"
    author = "Claude Windows"
} | ConvertTo-Json

$webhook = "https://script.google.com/macros/s/AKfycbyEekvL0bKarL_Q8E9usDThUT38frjC5Z7C-A_1eY2XnJH9Q1CHdXpwUgFbhtRQkhKQ/exec"

Invoke-WebRequest -Uri $webhook -Method POST -Body $body -ContentType "application/json"
```

## 📝 Como Usar no Claude Code (Windows)

Simplesmente digite no chat:

```
Claude, adiciona ao brainstorm docs:
- Nova ideia para feature X
- Prioridade: Alta
- Status: Análise
```

E Claude vai automaticamente enviar para o Google Docs!

## 🔧 Troubleshooting

### PowerShell: "não é permitido executar scripts"

Se receber erro de permissão ao rodar `.ps1`, execute no PowerShell como Admin:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Depois tente novamente.

### cURL não encontrado

Se receber "curl não é reconhecido":
1. Windows 10/11 já tem curl built-in
2. Tente no PowerShell em vez de cmd.exe
3. Ou instale via Chocolatey: `choco install curl`

### Erro "Token inválido"

Verifique se `.env.local` tem o token correto:
```env
GOOGLE_DOCS_TOKEN=meu-concierge-brainstorm-2026
```

### Erro "Conteúdo não adicionado"

Verifique:
1. Se o Google Docs está compartilhado
2. Se a conta Google do Windows tem permissão
3. Veja os logs no Google Apps Script (Extensions > Apps Script > Executions)

## 💡 Dicas

- **Mantenha o mesmo `.env.local`** em ambos os PCs (Mac e Windows)
- **Ambas as contas devem ter acesso ao Google Docs** 
- **O webhook é o mesmo** para as duas máquinas
- **O token também é o mesmo** (é compartilhado)

## 📞 Se tiver problemas

1. Teste manualmente com PowerShell primeiro
2. Verifique os Logs no Google Apps Script
3. Confirme que o Google Docs está compartilhado
4. Verifique que `.env.local` tem os valores corretos
