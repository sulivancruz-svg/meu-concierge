/**
 * Script para criar um admin da plataforma.
 * Pode ser executado várias vezes para criar múltiplos admins.
 * Uso: npm run setup:admin
 */

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local');
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    console.error('Não foi possível ler .env.local. Certifica-te de estar na pasta apps/web.');
    process.exit(1);
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PLATFORM_OWNER_AGENCY_SLUG = (process.env.PLATFORM_OWNER_AGENCY_SLUG ?? 'sulivan-cruz').trim().toLowerCase();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Preenche NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local primeiro.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const prisma = new PrismaClient();

async function main() {
  const rl = readline.createInterface({ input, output });

  console.log('\n========================================');
  console.log('  Criar Admin da Plataforma');
  console.log('========================================\n');

  const name = await rl.question('Nome: ');
  const email = await rl.question('Email: ');
  const password = await rl.question('Senha (min. 8 caracteres): ');
  rl.close();

  if (!name.trim() || !email.trim() || password.length < 8) {
    console.error('\nErro: nome, email e senha (min 8 caracteres) são obrigatórios.');
    process.exit(1);
  }

  console.log('\nConfigurando...\n');

  // 1. Garantir que a agência da plataforma existe
  let agency = await prisma.agency.findFirst({ where: { slug: PLATFORM_OWNER_AGENCY_SLUG } });

  if (!agency) {
    console.log(`→ Criando agência da plataforma (slug: ${PLATFORM_OWNER_AGENCY_SLUG})...`);
    agency = await prisma.agency.create({
      data: { name: 'Plataforma', slug: PLATFORM_OWNER_AGENCY_SLUG, plan: 'ENTERPRISE', status: 'ACTIVE' },
    });
    console.log('  ✓ Agência criada.');
  } else {
    console.log(`→ Agência da plataforma encontrada (${agency.name}).`);
  }

  // 2. Criar ou atualizar utilizador no Supabase Auth
  console.log('→ Configurando utilizador no Supabase Auth...');
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());

  let authUserId: string;

  if (existing) {
    console.log('  Utilizador já existe. Atualizando senha...');
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password });
    if (error) throw new Error(`Erro ao atualizar senha: ${error.message}`);
    authUserId = existing.id;
    console.log('  ✓ Senha atualizada.');
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`Erro ao criar utilizador: ${error?.message}`);
    authUserId = data.user.id;
    console.log('  ✓ Utilizador criado.');
  }

  // 3. Criar ou atualizar AgencyUser
  console.log('→ Configurando registo na base de dados...');
  const existingAgencyUser = await prisma.agencyUser.findFirst({
    where: { agencyId: agency.id, email: email.trim().toLowerCase() },
  });

  if (existingAgencyUser) {
    await prisma.agencyUser.update({
      where: { id: existingAgencyUser.id },
      data: { name: name.trim(), authUserId, role: 'OWNER', status: 'ACTIVE', deletedAt: null },
    });
    console.log('  ✓ Registo atualizado.');
  } else {
    await prisma.agencyUser.create({
      data: {
        agencyId: agency.id,
        authUserId,
        role: 'OWNER',
        name: name.trim(),
        email: email.trim().toLowerCase(),
        status: 'ACTIVE',
      },
    });
    console.log('  ✓ Registo criado.');
  }

  console.log('\n========================================');
  console.log('  Admin criado com sucesso!');
  console.log(`  Nome:  ${name.trim()}`);
  console.log(`  Email: ${email.trim().toLowerCase()}`);
  console.log(`  Acesso: /admin/login`);
  console.log('  (podes correr este script novamente para criar mais admins)');
  console.log('========================================\n');
}

main()
  .catch(e => { console.error('\nErro:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
