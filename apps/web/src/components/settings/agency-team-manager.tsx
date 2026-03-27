'use client';

import { useRouter } from 'next/navigation';
import { KeyRound, LoaderCircle, Plus, Trash2, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'AGENT';
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
};

type Props = {
  initialUsers: TeamMember[];
  currentUserId: string;
  currentUserRole: 'OWNER' | 'ADMIN' | 'AGENT';
};

const roleLabels: Record<TeamMember['role'], string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  AGENT: 'Agente',
};

function formatDate(value: string | null) {
  if (!value) {
    return 'Nunca entrou';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AgencyTeamManager({ initialUsers, currentUserId, currentUserRole }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'AGENT',
  });

  const allowedRoles = currentUserRole === 'OWNER'
    ? ['OWNER', 'ADMIN', 'AGENT']
    : ['ADMIN', 'AGENT'];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const apiError = typeof payload?.error === 'string'
          ? payload.error
          : payload?.error?.formErrors?.[0] || 'Nao foi possivel criar o usuario.';
        setError(apiError);
        return;
      }

      setForm({ name: '', email: '', password: '', role: 'AGENT' });
      setShowForm(false);
      setSuccess('Usuario criado no Supabase Auth e vinculado a agencia.');
      router.refresh();
    } catch {
      setError('Erro de comunicacao ao criar usuario.');
    } finally {
      setSaving(false);
    }
  }

  async function runUserAction(userId: string, body: Record<string, string>) {
    setRunningActionId(userId);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const apiError = typeof payload?.error === 'string'
          ? payload.error
          : payload?.error?.formErrors?.[0] || 'Nao foi possivel atualizar o usuario.';
        setError(apiError);
        return false;
      }

      router.refresh();
      return true;
    } catch {
      setError('Erro de comunicacao ao atualizar usuario.');
      return false;
    } finally {
      setRunningActionId(null);
    }
  }

  async function handleResetPassword(userId: string) {
    if (resetPassword.length < 8) {
      setError('A nova senha precisa ter pelo menos 8 caracteres.');
      setSuccess('');
      return;
    }

    const ok = await runUserAction(userId, {
      action: 'reset_password',
      password: resetPassword,
    });

    if (ok) {
      setSuccess('Senha redefinida no Supabase Auth.');
      setResetPassword('');
      setResettingUserId(null);
    }
  }

  async function handleToggleStatus(user: TeamMember) {
    const activating = user.status !== 'ACTIVE';
    const confirmed = window.confirm(
      activating
        ? `Reativar o acesso de ${user.name}?`
        : `Desativar o acesso de ${user.name}?`,
    );

    if (!confirmed) {
      return;
    }

    const ok = await runUserAction(user.id, {
      action: activating ? 'activate' : 'deactivate',
    });

    if (ok) {
      setSuccess(activating ? 'Usuario reativado com sucesso.' : 'Usuario desativado com sucesso.');
    }
  }

  async function handleDelete(user: TeamMember) {
    const confirmed = window.confirm(`Excluir ${user.name}? Essa acao remove o login no Supabase Auth e tira o usuario da equipe.`);

    if (!confirmed) {
      return;
    }

    const ok = await runUserAction(user.id, {
      action: 'delete',
    });

    if (ok) {
      setSuccess('Usuario excluido com sucesso.');
      if (resettingUserId === user.id) {
        setResettingUserId(null);
        setResetPassword('');
      }
    }
  }

  return (
    <SectionCard
      title="Equipe administrativa"
      description="Usuarios administrativos provisionados no Supabase Auth e vinculados a esta agencia."
      action={(
        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          className="inline-flex items-center gap-2 rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm font-semibold text-[#142018]"
        >
          <Plus className="h-4 w-4" />
          Novo usuario
        </button>
      )}
    >
      <div className="space-y-4">
        {(error || success) && (
          <div className={error
            ? 'rounded-2xl border border-[#f1c4bc] bg-[#fff3f0] px-4 py-3 text-sm text-[#9b3528]'
            : 'rounded-2xl border border-[#cfe1cc] bg-[#ecf6ea] px-4 py-3 text-sm text-[#163020]'}
          >
            {error || success}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#38463a]">Nome</span>
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm text-[#142018]"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[#38463a]">Email</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm text-[#142018]"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[#38463a]">Senha inicial</span>
                <input
                  required
                  minLength={8}
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm text-[#142018]"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[#38463a]">Perfil</span>
                <select
                  value={form.role}
                  onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                  className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm text-[#142018]"
                >
                  {allowedRoles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role as TeamMember['role']]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white disabled:bg-[#7ba78d]"
              >
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? 'Criando...' : 'Criar usuario'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm font-semibold text-[#142018]"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {initialUsers.map((user) => (
            <div key={user.id} className="rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#142018]">{user.name}</p>
                    <StatusBadge tone={user.role === 'OWNER' ? 'success' : user.role === 'ADMIN' ? 'info' : 'neutral'}>
                      {roleLabels[user.role]}
                    </StatusBadge>
                    {user.id === currentUserId && (
                      <StatusBadge tone="success">Voce</StatusBadge>
                    )}
                  </div>
                  <p className="text-sm text-[#5b665d]">{user.email}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-[#7b857b]">
                    <span>Criado em {formatDate(user.createdAt)}</span>
                    <span>Ultimo login: {formatDate(user.lastLoginAt)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={user.status === 'ACTIVE' ? 'success' : 'warning'}>
                    {user.status}
                  </StatusBadge>
                  <button
                    type="button"
                    disabled={runningActionId === user.id}
                    onClick={() => setResettingUserId((current) => current === user.id ? null : user.id)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm font-semibold text-[#142018] disabled:opacity-60"
                  >
                    {runningActionId === user.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    Senha
                  </button>
                  <button
                    type="button"
                    disabled={runningActionId === user.id}
                    onClick={() => handleToggleStatus(user)}
                    className={user.status === 'ACTIVE'
                      ? 'inline-flex items-center gap-2 rounded-2xl border border-[#f1c4bc] bg-white px-3 py-2 text-sm font-semibold text-[#9b3528] disabled:opacity-60'
                      : 'inline-flex items-center gap-2 rounded-2xl border border-[#cfe1cc] bg-white px-3 py-2 text-sm font-semibold text-[#1f6b46] disabled:opacity-60'}
                  >
                    {runningActionId === user.id ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : user.status === 'ACTIVE' ? (
                      <UserX className="h-4 w-4" />
                    ) : (
                      <UserCheck className="h-4 w-4" />
                    )}
                    {user.status === 'ACTIVE' ? 'Desativar' : 'Reativar'}
                  </button>
                  <button
                    type="button"
                    disabled={runningActionId === user.id}
                    onClick={() => handleDelete(user)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#f1c4bc] bg-white px-3 py-2 text-sm font-semibold text-[#9b3528] disabled:opacity-60"
                  >
                    {runningActionId === user.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Excluir
                  </button>
                </div>
              </div>

              {resettingUserId === user.id && (
                <div className="mt-4 rounded-2xl border border-[#d9e2d5] bg-white p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-[#38463a]">Nova senha para {user.name}</span>
                      <input
                        type="password"
                        minLength={8}
                        value={resetPassword}
                        onChange={(event) => setResetPassword(event.target.value)}
                        className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm text-[#142018]"
                      />
                    </label>
                    <div className="flex items-end gap-3">
                      <button
                        type="button"
                        disabled={runningActionId === user.id}
                        onClick={() => handleResetPassword(user.id)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white disabled:bg-[#7ba78d]"
                      >
                        {runningActionId === user.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                        Salvar senha
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResettingUserId(null);
                          setResetPassword('');
                        }}
                        className="rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm font-semibold text-[#142018]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
