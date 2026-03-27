'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Activity, LoaderCircle, Radar, Siren, Wifi } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';

type FlightHistoryItem = {
  id: string;
  statusCode: string;
  provider: string | null;
  summary: string | null;
  observedAtLabel: string | null;
};

type FlightMonitoringItem = {
  id: string;
  label: string;
  route: string;
  departureLabel: string | null;
  statusLabel: string;
  monitoringMode: 'configured' | 'mock' | null;
  monitoredFlightNumber: string;
  lastCheckedLabel: string | null;
  history: FlightHistoryItem[];
};

function actionButtonClass(isPrimary = false) {
  return isPrimary
    ? 'inline-flex items-center gap-2 rounded-2xl bg-[#173a27] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60'
    : 'inline-flex items-center gap-2 rounded-2xl border border-[#d9e2d5] bg-white px-3 py-2 text-xs font-semibold text-[#142018] disabled:opacity-60';
}

export function TripFlightMonitoringPanel({
  tripId,
  items,
}: {
  tripId: string;
  items: FlightMonitoringItem[];
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pendingKey, setPendingKey] = useState('');
  const [isPending, startTransition] = useTransition();

  function runAction(key: string, action: () => Promise<void>) {
    startTransition(async () => {
      try {
        setError('');
        setPendingKey(key);
        await action();
        router.refresh();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Erro interno.');
      } finally {
        setPendingKey('');
      }
    });
  }

  async function rearmMonitoring(flightId: string) {
    const response = await fetch(`/api/admin/trips/${tripId}/flights/${flightId}/monitoring`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Nao foi possivel rearmar o monitoramento.');
    }
  }

  async function simulateEvent(flightId: string, payload: Record<string, unknown>) {
    const response = await fetch(`/api/admin/trips/${tripId}/flights/${flightId}/monitoring/mock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Nao foi possivel simular o evento de voo.');
    }
  }

  return (
    <SectionCard title="Monitoramento de voos" description="Status atual salvo no banco, historico persistido e acoes de operacao para testar o pipeline.">
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-2xl bg-[#f6f7f2] px-4 py-4 text-sm text-[#5b665d]">Nenhum voo monitorado nesta viagem.</p>
        ) : items.map((segment) => (
          <div key={segment.id} className="rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#142018]">{segment.label}</p>
                  <StatusBadge tone="info">{segment.statusLabel}</StatusBadge>
                  <StatusBadge tone={segment.monitoringMode === 'configured' ? 'success' : 'neutral'}>
                    {segment.monitoringMode === 'configured' ? 'Webhook pronto' : 'Modo mock'}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-sm text-[#5b665d]">{segment.route} · {segment.departureLabel || 'Horario nao informado'}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#7b857b]">
                  {segment.monitoredFlightNumber} · {segment.lastCheckedLabel ? `ultimo evento ${segment.lastCheckedLabel}` : 'ainda sem evento de monitoramento'}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef5fb] text-[#225982]">
                <Activity className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-[#e3e9e1] pt-4">
              <button
                type="button"
                onClick={() => runAction(`rearm-${segment.id}`, () => rearmMonitoring(segment.id))}
                disabled={isPending}
                className={actionButtonClass()}
              >
                {pendingKey === `rearm-${segment.id}` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                Rearmar monitoramento
              </button>
              <button
                type="button"
                onClick={() => runAction(`delay-${segment.id}`, () => simulateEvent(segment.id, { status: 'DELAYED' }))}
                disabled={isPending}
                className={actionButtonClass()}
              >
                {pendingKey === `delay-${segment.id}` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
                Simular atraso
              </button>
              <button
                type="button"
                onClick={() => runAction(`gate-${segment.id}`, () => simulateEvent(segment.id, { status: 'ON_TIME', departureGate: 'A12', departureTerminal: '2' }))}
                disabled={isPending}
                className={actionButtonClass()}
              >
                {pendingKey === `gate-${segment.id}` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
                Simular portao
              </button>
              <button
                type="button"
                onClick={() => runAction(`cancel-${segment.id}`, () => simulateEvent(segment.id, { status: 'CANCELLED' }))}
                disabled={isPending}
                className={actionButtonClass(true)}
              >
                {pendingKey === `cancel-${segment.id}` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Siren className="h-4 w-4" />}
                Simular cancelamento
              </button>
            </div>

            {segment.history.length > 0 ? (
              <div className="mt-4 space-y-2">
                {segment.history.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-[#e7ece5] bg-white px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#142018]">{event.statusCode}</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#7b857b]">
                        {event.provider || 'Operacao'} · {event.observedAtLabel || '-'}
                      </p>
                    </div>
                    {event.summary && <p className="mt-2 text-sm text-[#5b665d]">{event.summary}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-[#5b665d]">
                Ainda nao houve retorno do monitoramento. Use as acoes acima para testar o pipeline agora.
              </p>
            )}
          </div>
        ))}

        {error && (
          <div className="rounded-[20px] border border-[#f1c8c0] bg-[#fff4f2] px-4 py-3 text-sm text-[#8f2d22]">
            {error}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
