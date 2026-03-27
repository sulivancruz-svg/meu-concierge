import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BedDouble,
  CarFront,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  PlaneLanding,
  PlaneTakeoff,
  ShieldCheck,
  Ticket,
  TrainFront,
  TramFront,
} from 'lucide-react';
import type { TripTimelineGroup, TripTimelineItem } from '@/modules/trips/timeline';

type TripTimelineProps = {
  groups: TripTimelineGroup[];
  emptyMessage: string;
  variant?: 'admin' | 'portal';
};

function getTimelineIcon(item: TripTimelineItem) {
  switch (item.kind) {
    case 'flight':
      return item.eventType?.toLowerCase().includes('chegada') ? PlaneLanding : PlaneTakeoff;
    case 'hotel':
      return BedDouble;
    case 'transport':
      return TramFront;
    case 'car_rental':
      return CarFront;
    case 'tour':
      return Ticket;
    case 'train':
      return TrainFront;
    case 'insurance':
      return ShieldCheck;
    case 'note':
      return FileText;
    default:
      return MapPin;
  }
}

type IconTone = {
  bg: string;
  text: string;
  ring: string;
};

function getIconTone(item: TripTimelineItem): IconTone {
  switch (item.kind) {
    case 'flight':
      return { bg: 'bg-[#dbeafe]', text: 'text-[#1d4ed8]', ring: 'ring-[#bfdbfe]' };
    case 'hotel':
      return { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]', ring: 'ring-[#fde68a]' };
    case 'transport':
    case 'car_rental':
      return { bg: 'bg-[#dcfce7]', text: 'text-[#166534]', ring: 'ring-[#bbf7d0]' };
    case 'tour':
      return { bg: 'bg-[#ffedd5]', text: 'text-[#9a3412]', ring: 'ring-[#fed7aa]' };
    case 'train':
      return { bg: 'bg-[#e0f2fe]', text: 'text-[#0369a1]', ring: 'ring-[#bae6fd]' };
    case 'insurance':
      return { bg: 'bg-[#dcfce7]', text: 'text-[#14532d]', ring: 'ring-[#bbf7d0]' };
    case 'note':
      return { bg: 'bg-[#f3f4f6]', text: 'text-[#374151]', ring: 'ring-[#e5e7eb]' };
    default:
      return { bg: 'bg-[#f3f4f6]', text: 'text-[#374151]', ring: 'ring-[#e5e7eb]' };
  }
}

function TimelineEvent({ item, isLast, variant }: { item: TripTimelineItem; isLast: boolean; variant: 'admin' | 'portal' }) {
  const Icon = getTimelineIcon(item);
  const tone = getIconTone(item);
  const isPortal = variant === 'portal';

  return (
    <div className="relative flex gap-4">
      {/* Left column: icon + connector line */}
      <div className="flex flex-col items-center">
        <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-4 ${tone.bg} ${tone.text} ${tone.ring}`}>
          <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-[#e4ebe2]" />}
      </div>

      {/* Right column: content */}
      <div className={`mb-4 min-w-0 flex-1 rounded-[22px] border ${isPortal ? 'border-[#e7ece5] bg-white/96' : 'border-[#edf1ea] bg-[#fbfcfa]'} p-4 shadow-[0_4px_16px_rgba(15,23,42,0.04)]`}>
        {/* Time + type row */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold tracking-tight text-[#142018] shadow-[inset_0_0_0_1px_rgba(217,226,213,0.8)]">
            {format(item.date, 'HH:mm', { locale: ptBR })}
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7b857b]">{item.eventType}</span>
          {item.status && (
            <span className="rounded-full bg-[#e8f2ff] px-2.5 py-0.5 text-[11px] font-semibold text-[#17406d]">{item.status}</span>
          )}
        </div>

        {/* Title */}
        <p className="text-sm font-semibold leading-snug text-[#142018]">{item.title}</p>

        {/* Location */}
        {item.location && (
          <div className="mt-1.5 flex items-start gap-1.5 text-xs text-[#5b665d]">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-[#7b857b]" />
            <span>{item.location}</span>
          </div>
        )}

        {/* Summary */}
        {item.summary && (
          <p className="mt-2 text-sm leading-6 text-[#5b665d]">{item.summary}</p>
        )}

        {/* Linked document */}
        {item.document && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#dde6db] bg-white px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ecf6ea] text-[#1f6b46]">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[#142018]">{item.document.title}</p>
              <p className="text-[11px] text-[#7b857b]">{item.document.categoryLabel}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {item.document.previewUrl && (
                <Link
                  href={item.document.previewUrl}
                  target="_blank"
                  title="Visualizar"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#7b857b] transition hover:bg-[#f0f2ee] hover:text-[#142018]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
              {item.document.url && (
                <Link
                  href={item.document.url}
                  target="_blank"
                  title="Baixar"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#7b857b] transition hover:bg-[#f0f2ee] hover:text-[#142018]"
                >
                  <Download className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TripTimeline({ groups, emptyMessage, variant = 'admin' }: TripTimelineProps) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-[#d9e2d5] bg-[#fbfcfa] py-12 text-center">
        <PlaneTakeoff className="h-8 w-8 text-[#c8d6c6]" />
        <p className="text-sm text-[#5b665d]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => {
        const docCount = group.items.filter(i => i.document).length;
        return (
          <div key={group.key}>
            {/* Day header */}
            <div className="mb-5 flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-[#d9e2d5] bg-white px-4 py-2 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                <span className="text-sm font-semibold text-[#142018]">
                  {format(group.date, "EEEE", { locale: ptBR })}
                </span>
                <span className="text-sm text-[#7b857b]">
                  {format(group.date, "d 'de' MMMM", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#eef2ec] px-2.5 py-1 text-[11px] font-semibold text-[#516053]">
                  {group.items.length} evento{group.items.length !== 1 ? 's' : ''}
                </span>
                {docCount > 0 && (
                  <span className="rounded-full bg-[#e8f2ff] px-2.5 py-1 text-[11px] font-semibold text-[#17406d]">
                    {docCount} doc{docCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="h-px flex-1 bg-[#e8ece5]" />
            </div>

            {/* Events */}
            <div className="pl-2">
              {group.items.map((item, idx) => (
                <TimelineEvent
                  key={item.key}
                  item={item}
                  isLast={idx === group.items.length - 1}
                  variant={variant}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
