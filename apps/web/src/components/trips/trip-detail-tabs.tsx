'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

type Tab = 'resumo' | 'itinerario' | 'documentos' | 'comunicacao';

const TABS: { key: Tab; label: string; badge?: number }[] = [
  { key: 'resumo',      label: 'Resumo'      },
  { key: 'itinerario',  label: 'Itinerário'  },
  { key: 'documentos',  label: 'Documentos'  },
  { key: 'comunicacao', label: 'Comunicação' },
];

export function TripDetailTabs({
  resumo,
  itinerario,
  documentos,
  comunicacao,
  docCount,
  alertCount,
  convCount,
}: {
  resumo: ReactNode;
  itinerario: ReactNode;
  documentos: ReactNode;
  comunicacao: ReactNode;
  docCount?: number;
  alertCount?: number;
  convCount?: number;
}) {
  const [tab, setTab] = useState<Tab>('resumo');

  const badges: Partial<Record<Tab, number>> = {
    documentos:  docCount,
    comunicacao: (alertCount ?? 0) + (convCount ?? 0),
  };

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="border-b border-[#e8ece5]">
        <div className="-mb-px flex gap-1">
          {TABS.map(({ key, label }) => {
            const count = badges[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`relative px-5 py-3.5 text-sm font-semibold transition-colors ${
                  tab === key ? 'text-[#1f6b46]' : 'text-[#7b857b] hover:text-[#38463a]'
                }`}
              >
                <span className="flex items-center gap-2">
                  {label}
                  {count !== undefined && count > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold transition-colors ${
                        tab === key ? 'bg-[#ecf6ea] text-[#1f6b46]' : 'bg-[#eef2ec] text-[#7b857b]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </span>
                {tab === key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-[#1f6b46]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {tab === 'resumo'      && resumo}
        {tab === 'itinerario'  && itinerario}
        {tab === 'documentos'  && documentos}
        {tab === 'comunicacao' && comunicacao}
      </div>
    </div>
  );
}
