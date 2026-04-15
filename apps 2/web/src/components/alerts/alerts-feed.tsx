'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { AlertListItem } from '@/modules/alerts/service';

function toneFromSeverity(severity: AlertListItem['severity']) {
  if (severity === 'CRITICAL') return 'danger' as const;
  if (severity === 'WARNING') return 'warning' as const;
  return 'info' as const;
}

export function AlertsFeed({
  items,
  emptyMessage,
  resolveEnabled = false,
}: {
  items: AlertListItem[];
  emptyMessage: string;
  resolveEnabled?: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  async function resolveAlert(alertId: string) {
    startTransition(async () => {
      try {
        setError('');
        setPendingId(alertId);
        const response = await fetch(`/api/admin/alerts/${alertId}/resolve`, {
          method: 'PATCH',
        });

        if (!response.ok) {
          throw new Error('Nao foi possivel marcar o alerta como resolvido.');
        }

        router.refresh();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Erro interno.');
      } finally {
        setPendingId('');
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#d9e2d5] bg-[#fbfcfa] p-8 text-center text-sm text-[#5b665d]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((alert) => (
        <div key={alert.id} className="rounded-[24px] border border-[#d9e2d5] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={toneFromSeverity(alert.severity)}>{alert.severity}</StatusBadge>
                <StatusBadge tone={alert.status === 'resolved' ? 'success' : 'neutral'}>
                  {alert.status === 'resolved' ? 'Resolvido' : 'Aberto'}
                </StatusBadge>
                <StatusBadge tone="info">{alert.typeLabel}</StatusBadge>
              </div>
              <p className="text-base font-semibold text-[#142018]">{alert.title}</p>
              <p className="text-sm leading-6 text-[#5b665d]">{alert.description}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.16em] text-[#7b857b]">
                {alert.trip && (
                  <Link href={`/dashboard/trips/${alert.trip.id}`} className="font-semibold text-[#1f6b46]">
                    {alert.trip.title}
                  </Link>
                )}
                {alert.relatedItemLabel && <span>{alert.relatedItemLabel}</span>}
                <span>{alert.createdAtRelative}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {alert.href && (
                <Link href={alert.href} className="rounded-2xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm font-semibold text-[#142018]">
                  Abrir item
                </Link>
              )}
              {resolveEnabled && alert.status === 'open' && (
                <button
                  type="button"
                  onClick={() => resolveAlert(alert.id)}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#1f6b46] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pendingId === alert.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Resolver
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {error && (
        <div className="rounded-[20px] border border-[#f1c8c0] bg-[#fff4f2] px-4 py-3 text-sm text-[#8f2d22]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
