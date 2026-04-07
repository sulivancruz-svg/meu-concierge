'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatabaseZap, LoaderCircle, PlugZap, RefreshCw, Save, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';

type SyncLog = {
  id: string;
  status: string;
  imported: number;
  updated: number;
  skipped: number;
  durationMs: number | null;
  createdAt: string;
};

type Props = {
  initialData: {
    enabled: boolean;
    login: string | null;
    lastSyncAt: string | null;
    lastSyncStatus: string | null;
    lastSyncMeta: Record<string, unknown> | null;
    recentLogs: SyncLog[];
  };
};

function syncStatusTone(status: string) {
  if (status === 'success') return 'success' as const;
  if (status === 'partial') return 'warning' as const;
  return 'danger' as const;
}

function syncStatusLabel(status: string) {
  if (status === 'success') return 'Sucesso';
  if (status === 'partial') return 'Parcial';
  return 'Erro';
}

export function MondeIntegrationCard({ initialData }: Props) {
  const router = useRouter();

  // Credentials form
  const [login, setLogin] = useState(initialData.login ?? '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  // Test connection
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    errors: Array<{ mondeId: string; name: string; error: string }>;
  } | null>(null);
  const [syncError, setSyncError] = useState('');

  const isConfigured = initialData.enabled;

  async function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    setSaveError('');

    try {
      const res = await fetch('/api/admin/integrations/monde/credentials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setSaveError(data?.error ?? 'Erro ao salvar credenciais');
        return;
      }

      setSaveMsg('Credenciais salvas com sucesso');
      setPassword('');
      router.refresh();
    } catch {
      setSaveError('Erro de conexao');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveCredentials() {
    setSaving(true);
    setSaveMsg('');
    setSaveError('');

    try {
      await fetch('/api/admin/integrations/monde/credentials', { method: 'DELETE' });
      setLogin('');
      setPassword('');
      setSaveMsg('Credenciais removidas');
      router.refresh();
    } catch {
      setSaveError('Erro ao remover');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/admin/integrations/monde/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json().catch(() => null);

      if (data?.ok) {
        setTestResult({ ok: true, message: 'Conexao bem-sucedida! Monde acessivel.' });
      } else {
        setTestResult({ ok: false, message: data?.error ?? 'Falha na conexao' });
      }
    } catch {
      setTestResult({ ok: false, message: 'Erro de rede' });
    } finally {
      setTesting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError('');

    try {
      const res = await fetch('/api/admin/integrations/monde/sync', { method: 'POST' });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setSyncError(data?.error ?? 'Erro ao sincronizar');
        return;
      }

      setSyncResult(data);
      router.refresh();
    } catch {
      setSyncError('Erro de conexao');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SectionCard
      title="Integracao Monde"
      description="Sincronize passageiros do sistema Monde automaticamente. Os dados fluem apenas do Monde para o Concierge (leitura)."
    >
      <div className="space-y-6">
        {/* Credentials Form */}
        <div className="rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-5">
          <div className="mb-4 flex items-center gap-2">
            <PlugZap className="h-4 w-4 text-[#1f6b46]" />
            <p className="text-sm font-semibold text-[#142018]">Credenciais do Monde</p>
            {isConfigured && <StatusBadge tone="success">Configurado</StatusBadge>}
          </div>

          <form onSubmit={handleSaveCredentials} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="monde-login" className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-[#7b857b]">
                  Login (email Monde)
                </label>
                <input
                  id="monde-login"
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="usuario@agencia.monde.com.br"
                  className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46]"
                />
              </div>
              <div>
                <label htmlFor="monde-password" className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-[#7b857b]">
                  Senha
                </label>
                <input
                  id="monde-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isConfigured ? '••••••••' : 'Senha do Monde'}
                  className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving || !login.trim() || !password}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#1f6b46] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#173a27] disabled:opacity-50"
              >
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar credenciais
              </button>

              {isConfigured && (
                <>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#d9e2d5] bg-white px-4 py-2.5 text-sm font-semibold text-[#142018] transition hover:border-[#c3d1c1] disabled:opacity-50"
                  >
                    {testing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />}
                    Testar conexao
                  </button>

                  <button
                    type="button"
                    onClick={handleRemoveCredentials}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </button>
                </>
              )}
            </div>

            {saveMsg && <p className="text-sm text-[#1f6b46]">{saveMsg}</p>}
            {saveError && <p className="text-sm text-[#9b3528]">{saveError}</p>}
            {testResult && (
              <p className={`text-sm ${testResult.ok ? 'text-[#1f6b46]' : 'text-[#9b3528]'}`}>
                {testResult.message}
              </p>
            )}
          </form>
        </div>

        {/* Sync Section */}
        {isConfigured && (
          <div className="rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-5">
            <div className="mb-4 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-[#1f6b46]" />
              <p className="text-sm font-semibold text-[#142018]">Sincronizacao de passageiros</p>
            </div>

            <div className="space-y-4">
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#1f6b46] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#173a27] disabled:opacity-50"
              >
                {syncing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
              </button>

              {syncResult && (
                <div className="rounded-2xl border border-[#d9e2d5] bg-white p-4">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-[#1f6b46] font-semibold">{syncResult.imported} importados</span>
                    <span className="text-[#5b665d]">{syncResult.updated} atualizados</span>
                    <span className="text-[#7b857b]">{syncResult.skipped} ignorados</span>
                    {syncResult.errors.length > 0 && (
                      <span className="text-[#9b3528]">{syncResult.errors.length} erros</span>
                    )}
                  </div>
                  {syncResult.errors.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {syncResult.errors.slice(0, 5).map((err) => (
                        <p key={err.mondeId} className="text-xs text-[#9b3528]">
                          {err.name}: {err.error}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {syncError && <p className="text-sm text-[#9b3528]">{syncError}</p>}
            </div>
          </div>
        )}

        {/* Sync History */}
        {initialData.recentLogs.length > 0 && (
          <div className="rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-5">
            <p className="mb-4 text-sm font-semibold text-[#142018]">Historico de sincronizacoes</p>
            <div className="space-y-2">
              {initialData.recentLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e8ece5] bg-white p-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge tone={syncStatusTone(log.status)}>
                      {syncStatusLabel(log.status)}
                    </StatusBadge>
                    <span className="text-sm text-[#5b665d]">
                      {log.imported} imp · {log.updated} atu · {log.skipped} ign
                    </span>
                  </div>
                  <span className="text-xs text-[#7b857b]">
                    {format(new Date(log.createdAt), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
                    {log.durationMs != null && ` · ${(log.durationMs / 1000).toFixed(1)}s`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last sync info */}
        {initialData.lastSyncAt && (
          <p className="text-xs text-[#7b857b]">
            Ultima sincronizacao: {format(new Date(initialData.lastSyncAt), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
            {initialData.lastSyncStatus && (
              <> · <span className={initialData.lastSyncStatus === 'success' ? 'text-[#1f6b46]' : 'text-[#9b3528]'}>{syncStatusLabel(initialData.lastSyncStatus)}</span></>
            )}
          </p>
        )}
      </div>
    </SectionCard>
  );
}
