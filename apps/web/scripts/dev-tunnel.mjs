/**
 * dev-tunnel.mjs
 * Usa cloudflared (sem página de senha) para expor o Next.js publicamente.
 * Uso: npm run dev:tunnel
 */
import { readFileSync, writeFileSync } from 'fs';
import { spawn } from 'child_process';
import { createServer } from 'net';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = join(__dirname, '..', '.env');

function patchEnv(file, key, value) {
  const regex = new RegExp(`^${key}=.*`, 'm');
  const line  = `${key}="${value}"`;
  return regex.test(file) ? file.replace(regex, line) : file + `\n${line}`;
}

function findFreePort(start = 3001) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(start, '0.0.0.0', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', () => findFreePort(start + 1).then(resolve).catch(reject));
  });
}

function waitForTunnelUrl(proc) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout aguardando URL do tunnel')), 30000);
    proc.stderr.on('data', (data) => {
      const text = data.toString();
      // cloudflared imprime a URL em stderr
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[0]);
      }
    });
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[0]);
      }
    });
  });
}

function restore() {
  try {
    const current  = readFileSync(envPath, 'utf-8');
    const restored = patchEnv(current, 'APP_URL', 'http://localhost:3001');
    writeFileSync(envPath, restored);
    console.log('\n🔄  APP_URL restaurado para http://localhost:3001');
  } catch { /* ignorado */ }
}

function killPort(port) {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32'
      ? `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port} ^| findstr LISTENING') do taskkill /PID %a /F`
      : `lsof -ti:${port} | xargs kill -9`;
    const proc = spawn('cmd', ['/c', cmd], { shell: false, stdio: 'ignore' });
    proc.on('close', () => resolve());
    proc.on('error', () => resolve());
    setTimeout(resolve, 2000);
  });
}

async function main() {
  console.log(`\n🧹  Liberando porta 3001...`);
  await killPort(3001);

  const port = await findFreePort(3001);
  if (port !== 3001) console.log(`\n⚠️  Porta 3001 ainda ocupada — usando porta ${port}`);

  console.log(`\n☁️  Iniciando Cloudflare Tunnel na porta ${port}...`);

  // Inicia cloudflared
  const tunnel = spawn('npx', ['cloudflared', 'tunnel', '--url', `http://localhost:${port}`], {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  tunnel.on('error', (err) => {
    console.error('❌ Erro ao iniciar cloudflared:', err.message);
    console.error('   Certifique-se que cloudflared está instalado: npm install cloudflared');
    process.exit(1);
  });

  let tunnelUrl;
  try {
    tunnelUrl = await waitForTunnelUrl(tunnel);
  } catch (err) {
    console.error('❌', err.message);
    tunnel.kill();
    process.exit(1);
  }

  console.log(`\n✅  Tunnel ativo:  ${tunnelUrl}`);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋  COPIE ESSES DADOS NO META FOR DEVELOPERS:`);
  console.log(`\n    URL de callback:`);
  console.log(`    ${tunnelUrl}/api/webhooks/whatsapp`);
  console.log(`\n    Token de verificação:`);
  console.log(`    local-webhook-token`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Atualiza .env
  const originalEnv = readFileSync(envPath, 'utf-8');
  writeFileSync(envPath, patchEnv(originalEnv, 'APP_URL', tunnelUrl));
  console.log(`📝  .env → APP_URL = ${tunnelUrl}\n`);

  // Inicia Next.js
  console.log(`🚀  Iniciando Next.js na porta ${port}...\n`);
  const next = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PORT: String(port), APP_URL: tunnelUrl, NEXTAUTH_URL: `http://localhost:${port}` },
  });

  tunnel.on('close', () => { console.log('\n⚠️  Tunnel fechado.'); restore(); next.kill(); process.exit(0); });
  process.on('SIGINT',  () => { tunnel.kill(); next.kill(); restore(); process.exit(0); });
  process.on('SIGTERM', () => { tunnel.kill(); next.kill(); restore(); process.exit(0); });
  next.on('exit', (code) => { tunnel.kill(); restore(); process.exit(code ?? 0); });
}

main().catch(err => { console.error('Erro fatal:', err); process.exit(1); });
