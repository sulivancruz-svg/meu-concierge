# Supabase setup

Use esta ordem para aplicar a fundacao de dados no projeto.

1. Preencha o arquivo `.env` com `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
2. Aponte `DATABASE_URL` e `DIRECT_URL` para o Postgres do seu projeto Supabase.
3. Execute `npm run db:push` para materializar o schema Prisma no Postgres do Supabase.
4. Rode o SQL de `supabase/migrations/20260326_140000_foundation_security.sql` no SQL Editor do Supabase ou via CLI.
5. Execute `npm run db:seed` para criar os dados demo e provisionar usuarios no Supabase Auth quando a service role estiver configurada.

O bucket de documentos fica em `agencies/{agency_id}/trips/{trip_id}/documents/{document_id}/{file_name}`.
Os admins autenticados acessam dados operacionais por agencia.
Passageiros autenticados acessam apenas as proprias jornadas, conversas e documentos vinculados.
